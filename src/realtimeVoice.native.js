import { api } from './api';

const RTC_CONFIG = {};

function loadWebRtc() {
  try { return require('react-native-webrtc'); }
  catch (_) {
    throw new Error('WebRTC native module is not installed in this app build. Use the OZIRA development build, not Expo Go.');
  }
}

/**
 * Open a microphone-to-model WebRTC session.
 *
 * The permanent OpenAI key never reaches the phone. The authenticated OZIRA
 * backend combines the SDP offer with the trusted session configuration and
 * returns only OpenAI's SDP answer.
 */
export async function createRealtimeVoiceSession({ token, lang, onEvent, signal }) {
  const {
    mediaDevices,
    MediaStream,
    RTCPeerConnection,
    RTCSessionDescription,
  } = loadWebRtc();
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const localStream = await mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
  const remoteStream = new MediaStream();
  const dataChannel = pc.createDataChannel('oai-events');
  let closed = false;

  localStream.getAudioTracks().forEach((track) => pc.addTrack(track, localStream));
  pc.ontrack = (event) => {
    const tracks = event.streams?.[0]?.getTracks?.() || (event.track ? [event.track] : []);
    tracks.forEach((track) => {
      try { remoteStream.addTrack(track); } catch (_) {}
      track.enabled = true;
    });
    onEvent?.({ type: 'ozira.remote_audio.ready' });
  };
  pc.onconnectionstatechange = () => {
    onEvent?.({ type: 'ozira.connection', state: pc.connectionState });
  };
  pc.oniceconnectionstatechange = () => {
    onEvent?.({ type: 'ozira.ice', state: pc.iceConnectionState });
  };
  dataChannel.onopen = () => onEvent?.({ type: 'ozira.data.open' });
  dataChannel.onclose = () => onEvent?.({ type: 'ozira.data.closed' });
  dataChannel.onerror = (event) => {
    onEvent?.({ type: 'error', error: { message: event?.message || 'Realtime data channel failed.' } });
  };
  dataChannel.onmessage = (message) => {
    try { onEvent?.(JSON.parse(message.data)); }
    catch (_) {}
  };

  const close = () => {
    if (closed) return;
    closed = true;
    try { dataChannel.close(); } catch (_) {}
    try { localStream.getTracks().forEach((track) => track.stop()); } catch (_) {}
    try { remoteStream.getTracks().forEach((track) => track.stop()); } catch (_) {}
    try { pc.close(); } catch (_) {}
  };

  if (signal) {
    if (signal.aborted) {
      close();
      throw new Error('Realtime connection cancelled.');
    }
    signal.addEventListener('abort', close, { once: true });
  }

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const answerSdp = await api.aiRealtime(offer.sdp, lang, token, signal);
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
  } catch (error) {
    close();
    throw error;
  }

  return {
    close,
    send(event) {
      if (dataChannel.readyState !== 'open') return false;
      dataChannel.send(JSON.stringify(event));
      return true;
    },
    sendContext(history) {
      const turns = (history || []).slice(-8);
      if (!turns.length || dataChannel.readyState !== 'open') return;
      const context = turns.map((turn) => {
        const speaker = turn.role === 'assistant' ? 'OZIRA' : 'User';
        return `${speaker}: ${String(turn.content || '').slice(0, 800)}`;
      }).join('\n');
      dataChannel.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{
            type: 'input_text',
            text: `Earlier conversation context. Use it only as context; do not answer it again:\n${context}`,
          }],
        },
      }));
    },
  };
}
