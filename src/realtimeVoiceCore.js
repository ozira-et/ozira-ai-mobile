import {Platform} from 'react-native';
import {LegacyEventEmitter} from 'expo-modules-core';
import {AudioStudioModule} from '@siteed/audio-studio';
import {createAudioPlayer, setAudioModeAsync} from 'expo-audio';
import {cacheDirectory, EncodingType, writeAsStringAsync} from 'expo-file-system/legacy';
import {liveSocketConfig} from './api';

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const MAX_RECONNECTS = 3;

function bytesToBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000)));
  }
  return globalThis.btoa(binary);
}

function base64ToBytes(value) {
  const binary = globalThis.atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function floatsToPcm16Base64(input) {
  const floats = input instanceof Float32Array ? input : Float32Array.from(input || []);
  const bytes = new Uint8Array(floats.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < floats.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, floats[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return bytesToBase64(bytes);
}

function pcmBase64FromEvent(event) {
  if (typeof event?.encoded === 'string' && event.encoded) return event.encoded;
  if (event?.pcmFloat32) return floatsToPcm16Base64(event.pcmFloat32);
  if (event?.buffer) return floatsToPcm16Base64(event.buffer);
  return '';
}

function wavBytes(chunks, sampleRate = OUTPUT_RATE) {
  const decoded = chunks.map(base64ToBytes);
  const size = decoded.reduce((total, item) => total + item.length, 0);
  const bytes = new Uint8Array(44 + size);
  const view = new DataView(bytes.buffer);
  const write = (offset, value) => { for (let i = 0; i < value.length; i += 1) bytes[offset + i] = value.charCodeAt(i); };
  write(0, 'RIFF'); view.setUint32(4, 36 + size, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, size, true);
  let offset = 44;
  decoded.forEach((item) => { bytes.set(item, offset); offset += item.length; });
  return bytes;
}

async function playPcmTurn(chunks, state) {
  if (!chunks.length || state.closed) return;
  const bytes = wavBytes(chunks);
  let source;
  if (Platform.OS === 'web') source = 'data:audio/wav;base64,' + bytesToBase64(bytes);
  else {
    source = cacheDirectory + 'ozira-live-' + Date.now() + '.wav';
    await writeAsStringAsync(source, bytesToBase64(bytes), {encoding: EncodingType.Base64});
    await setAudioModeAsync({allowsRecording: true, playsInSilentMode: true, shouldRouteThroughEarpiece: false});
  }
  try { state.player?.remove?.(); } catch (_) {}
  state.player = createAudioPlayer(source);
  try {
    const subscription = state.player.addListener('playbackStatusUpdate', async (status) => {
      if (!status?.didJustFinish || state.closed) return;
      try { subscription.remove(); } catch (_) {}
      try { state.player?.remove?.(); } catch (_) {}
      state.player = null;
    });
  } catch (_) {}
  state.player.play();
}

function createRecorder(state) {
  const module = Platform.OS === 'web' ? AudioStudioModule({}) : AudioStudioModule;
  const emitter = new LegacyEventEmitter(AudioStudioModule);
  const subscription = emitter.addListener('AudioData', async (event) => {
    if (state.closed || !state.recording) return;
    const data = pcmBase64FromEvent(event);
    if (data) state.send({type: 'audio', data, mimeType: `audio/pcm;rate=${INPUT_RATE}`});
  });
  return {
    async start() {
      const permission = await AudioStudioModule.requestPermissionsAsync();
      if (!permission?.granted) throw new Error('Microphone permission is required for Live voice.');
      if (Platform.OS !== 'web') await setAudioModeAsync({allowsRecording: true, playsInSilentMode: true, shouldRouteThroughEarpiece: false});
      await module.startRecording({
        sampleRate: INPUT_RATE,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 100,
        bufferDurationSeconds: 0.1,
        streamFormat: 'raw',
        keepAwake: false,
        showNotification: false,
        audioFocusStrategy: 'communication',
        output: {primary: {enabled: false}},
      });
      state.recording = true;
    },
    async stop() {
      if (state.recording) {
        state.recording = false;
        try { await module.stopRecording(); } catch (_) {}
        state.send({type: 'audio_end'});
      }
      try { subscription.remove(); } catch (_) {}
    },
  };
}

export async function createProviderNeutralLiveSession({token, lang, onEvent, signal}) {
  const socketConfig = liveSocketConfig(token);
  const state = {
    socket: null, closed: false, recording: false, reconnects: 0,
    audioChunks: [], player: null, ready: false, pending: [], recorder: null,
    send(event) {
      if (state.socket?.readyState === WebSocket.OPEN && state.ready) {
        state.socket.send(JSON.stringify(event)); return true;
      }
      if (!['audio', 'video'].includes(event.type)) state.pending.push(event);
      return false;
    },
  };
  state.recorder = createRecorder(state);

  const close = async () => {
    if (state.closed) return;
    state.closed = true;
    state.ready = false;
    await state.recorder.stop();
    try { state.socket?.close(1000, 'client closed'); } catch (_) {}
    try { state.player?.remove?.(); } catch (_) {}
    state.player = null;
  };
  if (signal) {
    if (signal.aborted) throw new Error('Live connection cancelled.');
    signal.addEventListener('abort', () => { void close(); }, {once: true});
  }

  let resolveReady;
  let rejectReady;
  const readyPromise = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  let readySettled = false;

  const connect = () => {
    if (state.closed) return;
    const socket = new WebSocket(socketConfig.url, socketConfig.protocols);
    state.socket = socket;
    onEvent?.({type: 'connection', state: state.reconnects ? 'reconnecting' : 'connecting'});
    socket.onopen = () => onEvent?.({type: 'connection', state: 'connected'});
    socket.onmessage = async (message) => {
      let event;
      try { event = JSON.parse(message.data); } catch (_) { return; }
      if (event.type === 'ready') {
        state.ready = true;
        state.reconnects = 0;
        while (state.pending.length) state.send(state.pending.shift());
        try { if (!state.recording) await state.recorder.start(); } catch (error) {
          if (!readySettled) { readySettled = true; rejectReady(error); }
          onEvent?.({type: 'error', code: 'microphone_failed', message: error.message});
          return;
        }
        onEvent?.(event);
        if (!readySettled) { readySettled = true; resolveReady(); }
        return;
      }
      if (event.type === 'audio_delta' && event.data) state.audioChunks.push(event.data);
      if (event.type === 'interrupted') {
        state.audioChunks = [];
        try { state.player?.pause?.(); state.player?.remove?.(); } catch (_) {}
        state.player = null;
      }
      if (event.type === 'turn_complete') {
        const turn = state.audioChunks.splice(0);
        void playPcmTurn(turn, state).catch((error) => onEvent?.({type: 'error', code: 'playback_failed', message: error.message}));
      }
      onEvent?.(event);
    };
    socket.onerror = () => onEvent?.({type: 'error', code: 'socket_error', message: 'Live connection failed.', retryable: true});
    socket.onclose = (event) => {
      state.ready = false;
      if (state.closed || event.code === 1000) return;
      if (!readySettled && event.code === 4401) { readySettled = true; rejectReady(new Error('Live authentication failed. Sign in again.')); return; }
      if (state.reconnects < MAX_RECONNECTS) {
        const delay = 500 * (2 ** state.reconnects++);
        onEvent?.({type: 'reconnecting', attempt: state.reconnects});
        setTimeout(connect, delay);
      } else {
        onEvent?.({type: 'connection', state: 'failed'});
        if (!readySettled) { readySettled = true; rejectReady(new Error('Live connection could not be established.')); }
      }
    };
  };
  connect();
  await readyPromise;

  return {
    close,
    send: state.send,
    sendText(text) { return state.send({type: 'text', text: String(text || '')}); },
    sendContext(history) {
      const context = (history || []).slice(-8).map((turn) => ({role: turn.role === 'assistant' ? 'model' : 'user', text: String(turn.content || '').slice(0, 1200)}));
      if (context.length) state.send({type: 'context', turns: context, lang});
    },
    sendCameraFrame(data, mimeType = 'image/jpeg') { return state.send({type: 'video', data, mimeType}); },
    interrupt() { return state.send({type: 'interrupt'}); },
  };
}

export const __liveProtocolTest = {floatsToPcm16Base64, wavBytes, pcmBase64FromEvent};
