// Text-to-speech playback: asks the backend for WAV audio, writes it to a cache
// file, and plays it. One player at a time.
import { createAudioPlayer } from 'expo-audio';
import { writeAsStringAsync, cacheDirectory, EncodingType } from 'expo-file-system/legacy';
import { api } from './api';
import { getSettings } from './localStore';

let player = null;

export function stopSpeaking() {
  if (player) {
    try { player.pause(); player.remove(); } catch (_) {}
    player = null;
  }
}

export async function speakText(text, token, onEnd) {
  const clean = (text || '').trim();
  if (!clean) return { ok: false, message: 'Nothing to read.' };
  let voice = 'Kore';
  try { const s = await getSettings(); voice = s.voice || 'Kore'; } catch (_) {}
  let d;
  try { d = await api.aiSpeak(clean.slice(0, 4000), token, voice); }
  catch (e) { return { ok: false, message: e.message }; }
  if (!d || !d.audio) return { ok: false, message: (d && (d.notice || d.error)) || 'Voice output is not available yet.' };
  try {
    const b64 = d.audio.split(',')[1];
    const uri = cacheDirectory + 'ozira-tts-' + Date.now() + '.wav';
    await writeAsStringAsync(uri, b64, { encoding: EncodingType.Base64 });
    stopSpeaking();
    player = createAudioPlayer(uri);
    if (typeof onEnd === 'function') {
      try {
        const sub = player.addListener('playbackStatusUpdate', (st) => {
          if (st && st.didJustFinish) { try { sub.remove(); } catch (_) {} onEnd(); }
        });
      } catch (_) {}
    }
    player.play();
    return { ok: true };
  } catch (e) {
    return { ok: false, message: 'Could not play audio: ' + e.message };
  }
}
