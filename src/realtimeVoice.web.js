import { api } from './api';

const RTC_CONFIG = {};

export async function createRealtimeVoiceSession({ token, lang, onEvent, signal }) {
  if (!globalThis.RTCPeerConnection || !navigator?.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support WebRTC microphone sessions.');
  }
  const pc = new globalThis.RTCPeerConnection(RTC_CONFIG);
  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const audio = document.createElement('audio');
  audio.autoplay = true;
  audio.playsInline = true;
  audio.style.display = 'none';
  document.body.appendChild(audio);
  const dataChannel = pc.createDataChannel('oai-events');
  let closed = false;

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  pc.ontrack = (event) => {
    audio.srcObject = event.streams[0];
    void audio.play().catch(() => {});
    onEvent?.({ type: 'ozira.remote_audio.ready' });
  };
  pc.onconnectionstatechange = () => onEvent?.({ type: 'ozira.connection', state: pc.connectionState });
  pc.oniceconnectionstatechange = () => onEvent?.({ type: 'ozira.ice', state: pc.iceConnectionState });
  dataChannel.onopen = () => onEvent?.({ type: 'ozira.data.open' });
  dataChannel.onclose = () => onEvent?.({ type: 'ozira.data.closed' });
  dataChannel.onerror = () => onEvent?.({ type: 'error', error: { message: 'Realtime data channel failed.' } });
  dataChannel.onmessage = (message) => {
    try { onEvent?.(JSON.parse(message.data)); }
    catch (_) {}
  };

  const close = () => {
    if (closed) return;
    closed = true;
    try { dataChannel.close(); } catch (_) {}
    try { localStream.getTracks().forEach((track) => track.stop()); } catch (_) {}
    try { pc.close(); } catch (_) {}
    try { audio.srcObject = null; audio.remove(); } catch (_) {}
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
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
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
