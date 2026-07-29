// Live voice mode — a small rounded "globe" overlay (not full screen). It listens
// hands-free, sends when you pause (mic metering) or when you tap, speaks the
// reply, then listens again. Every turn is also written into the chat as text.
// Auto-closes after a stretch of silence.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Animated, Easing, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import Logo from './Logo';
import { api } from '../api';
import { File } from 'expo-file-system';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { ensurePrepared, releaseRecorder } from '../audioSession';
import { speakText, stopSpeaking } from '../tts';
import { t as translate } from '../i18n';

const RED = '#B3121B';
const ON = '#FFFFFF';
const DIM = 'rgba(255,255,255,0.8)';

// Latency matters more than anything here — a live conversation dies if the reply
// lags. These are tuned to cut the dead air after you stop talking.
const SPEAK_DB = -48;        // sensitive enough for a phone held at normal distance
const SILENCE_MS = 1200;     // allow a natural pause without cutting the sentence
const POLL_MS = 100;         // how often we check the mic level
const MIN_TURN_MS = 1800;    // never upload a startup click or a very short noise
const MAX_TURN_MS = 14000;   // hard cap per turn
const NO_SPEECH_MS = 9000;   // if nothing said this long, count as idle
const AUTO_CLOSE_MS = 150000; // ~2.5 min of no real exchange -> close
const HISTORY_TURNS = 6;     // shorter context = faster model response

// Expo's LOW_QUALITY Android preset records unsupported 3GP/AMR audio. Use the
// known-good HIGH_QUALITY preset unchanged so each native device records a
// standards-compliant MPEG-4/AAC clip; Addis mixes stereo down when necessary.
const SPEECH_RECORDING = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

function recordedMimeType(uri) {
  return Platform.OS === 'web' || /\.webm(?:$|\?)/i.test(String(uri || ''))
    ? 'audio/webm'
    : 'audio/mp4';
}

function friendlySpeechError(value) {
  const message = String(value || '').trim();
  if (/quota|rate.?limit|resource_exhausted|limit:\s*0/i.test(message)) {
    return 'The backup speech service has no available quota. Please try again.';
  }
  return message.length > 180 ? message.slice(0, 177) + '…' : message;
}

export default function VoiceOverlay({ visible, onClose, token, lang = 'en', userName = '', getHistory, onExchange }) {
  const styles = useMemo(() => makeStyles(), []);
  const recorder = useAudioRecorder(SPEECH_RECORDING);
  const [status, setStatus] = useState('idle'); // idle | listening | thinking | speaking
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [timing, setTiming] = useState({}); // { stt, ai, tts } ms — shows what's slow

  const convoRef = useRef([]);
  const pollRef = useRef(null);
  const turnStartRef = useRef(0);
  const lastVoiceRef = useRef(0);
  const hadSpeechRef = useRef(false);
  const speechFramesRef = useRef(0);
  const lastExchangeRef = useRef(0);
  const meteringOkRef = useRef(true);
  const runningRef = useRef(false);
  const readyRef = useRef(false);   // mic permission + audio mode done once
  const sessionRef = useRef(0);     // invalidates async work from an older open/close cycle
  const preparingRef = useRef(false);
  const transitionRef = useRef(false);
  const preparedRef = useRef(false);
  const releasePromiseRef = useRef(null);

  // Globe animation
  const pulse = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  const tr = (k) => translate(lang, k);

  useEffect(() => {
    if (visible) start(); else stop();
    return () => stop();
  }, [visible]);

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    loop.start(); p.start();
    return () => { loop.stop(); p.stop(); };
  }, []);

  async function start() {
    const session = ++sessionRef.current;
    setError(''); setCaption('');
    convoRef.current = (getHistory ? getHistory() : []).slice(-HISTORY_TURNS);
    lastExchangeRef.current = Date.now();
    runningRef.current = true;
    // Ask for the mic + configure audio ONCE per session, not once per turn —
    // doing it every turn added a visible pause between replies.
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (session !== sessionRef.current || !runningRef.current) return;
      if (!perm.granted) { setError('Microphone permission is needed.'); setStatus('idle'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (session !== sessionRef.current || !runningRef.current) return;
      readyRef.current = true;
    } catch (e) { setError(e.message || 'Mic error'); setStatus('idle'); return; }
    await listen(session);
  }

  function stop() {
    sessionRef.current += 1;
    runningRef.current = false;
    transitionRef.current = false;
    clearInterval(pollRef.current); pollRef.current = null;
    void releaseRecorderSession();
    stopSpeaking();
    setStatus('idle');
  }

  async function releaseRecorderSession() {
    if (releasePromiseRef.current) return releasePromiseRef.current;
    releasePromiseRef.current = (async () => {
      await releaseRecorder(recorder);
      preparedRef.current = false;
    })();
    try { await releasePromiseRef.current; }
    finally { releasePromiseRef.current = null; }
  }

  async function listen(session = sessionRef.current) {
    // preparedRef is deliberately NOT a bail-out condition: when it drifted true
    // the overlay stopped listening entirely and never recovered. Re-entrancy is
    // covered by preparingRef/transitionRef, and ensurePrepared() handles the
    // already-prepared case.
    if (session !== sessionRef.current || !runningRef.current || !readyRef.current
      || preparingRef.current || transitionRef.current) return;
    preparingRef.current = true;
    try {
      // TTS changes the native audio mode back to playback. Also release any
      // prepared recorder left behind by a fast refresh or interrupted turn.
      await releaseRecorderSession();
      if (session !== sessionRef.current || !runningRef.current) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (session !== sessionRef.current || !runningRef.current) return;
      await ensurePrepared(recorder);
      preparedRef.current = true;
      if (session !== sessionRef.current || !runningRef.current) {
        await releaseRecorderSession();
        return;
      }
      recorder.record();
    } catch (e) { setError(e.message || 'Mic error'); setStatus('idle'); return; }
    finally { preparingRef.current = false; }

    setStatus('listening');
    turnStartRef.current = Date.now();
    lastVoiceRef.current = Date.now();
    hadSpeechRef.current = false;
    speechFramesRef.current = 0;

    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      const now = Date.now();
      let level;
      try { const st = recorder.getStatus ? recorder.getStatus() : null; level = st && (st.metering != null ? st.metering : undefined); } catch (_) {}
      if (typeof level === 'number') {
        if (level > SPEAK_DB) {
          speechFramesRef.current += 1;
          hadSpeechRef.current = speechFramesRef.current >= 3;
          lastVoiceRef.current = now;
        }
      } else {
        meteringOkRef.current = false; // device gives no metering -> rely on caps/tap
      }
      // auto-close if nothing meaningful happens for a long time
      if (now - lastExchangeRef.current > AUTO_CLOSE_MS) { setCaption(''); onClose && onClose(); return; }

      if (meteringOkRef.current) {
        if (hadSpeechRef.current && now - turnStartRef.current >= MIN_TURN_MS && now - lastVoiceRef.current > SILENCE_MS) return endTurn();
        if (!hadSpeechRef.current && now - turnStartRef.current > NO_SPEECH_MS) return restartListen();
      }
      if (now - turnStartRef.current > MAX_TURN_MS) return endTurn();
    }, POLL_MS);
  }

  async function restartListen() {
    if (transitionRef.current) return;
    const session = sessionRef.current;
    transitionRef.current = true;
    // No speech captured this window — quietly start a fresh listening window.
    clearInterval(pollRef.current); pollRef.current = null;
    await releaseRecorderSession();
    transitionRef.current = false;
    if (session === sessionRef.current && runningRef.current) await listen(session);
  }

  async function endTurn() {
    if (transitionRef.current || !runningRef.current) return;
    const session = sessionRef.current;
    transitionRef.current = true;
    clearInterval(pollRef.current); pollRef.current = null;
    const resumeListening = async () => {
      transitionRef.current = false;
      if (session === sessionRef.current && runningRef.current) await listen(session);
    };
    // Clear the previous turn only when new speech is being processed. Doing
    // this in listen() would erase a useful failure immediately.
    setError('');
    setStatus('hearing');
    let currentStage = 'Speech recognition';
    try {
      const t0 = Date.now();
      await releaseRecorderSession();
      if (session !== sessionRef.current || !runningRef.current) {
        transitionRef.current = false;
        return;
      }
      const uri = recorder.uri;
      if (!uri) return resumeListening();
      const b64 = await new File(uri).base64();
      const d = await api.aiTranscribe(b64, recordedMimeType(uri), token);
      setTiming(x => ({ ...x, stt: Date.now() - t0 }));
      const text = (d && d.text || '').trim();
      if (!text) {
        // Show why nothing happened instead of looping in silence: a real error
        // (STT down, not configured) is different from just not hearing speech.
        const why = d && (d.error || d.notice);
        if (why) setError('Speech recognition: ' + friendlySpeechError(why));
        return resumeListening();
      }
      setCaption('“' + text + '”');
      setStatus('thinking');
      currentStage = 'AI reply';
      const t1 = Date.now();

      // Brevity is the single biggest latency lever: the whole reply has to be
      // synthesised to audio before playback starts, so long answers = long waits.
      const sys = { role: 'system', content:
        'You are OZIRA, a warm, friendly voice assistant in a LIVE spoken conversation.'
        + (userName ? ' The user\'s name is ' + userName + '; greet them by name and speak personally.' : '')
        + ' Reply in at most 2 short sentences (under 30 words). Be direct and conversational,'
        + ' like speech — no lists, no markdown, no headings. Only give a longer answer if'
        + ' explicitly asked for detail.' };
      const history = [...convoRef.current, { role: 'user', content: text }];
      const r = await api.chat({ model: 'auto', tier: 'fast', effort: 'quick', skill: 'general', messages: [sys, ...history], lang }, token);
      const answer = (r && r.reply || '').trim() || '…';
      setTiming(x => ({ ...x, ai: Date.now() - t1 }));
      convoRef.current = [...history, { role: 'assistant', content: answer }].slice(-HISTORY_TURNS);
      lastExchangeRef.current = Date.now();
      onExchange && onExchange(text, answer);       // write both turns into the chat
      setCaption(answer);

      if (session !== sessionRef.current || !runningRef.current) {
        transitionRef.current = false;
        return;
      }
      setStatus('speaking');
      currentStage = 'Voice playback';
      const t2 = Date.now();
      const spoken = await speakText(answer, token, () => { void resumeListening(); });
      setTiming(x => ({ ...x, tts: Date.now() - t2 }));
      if (!spoken?.ok) {
        setError('Voice playback: ' + (spoken?.message || 'Could not play the spoken reply.'));
        return resumeListening();
      }
    } catch (e) {
      setError(currentStage + ': ' + friendlySpeechError(e.message || 'Voice error'));
      return resumeListening();
    }
  }

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const active = status === 'listening' || status === 'speaking';
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, active ? 1.08 : 1.02] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
            <Ionicons name="close" size={20} color={ON} />
          </Pressable>

          <Pressable onPress={() => { if (status === 'listening') endTurn(); }} style={styles.globeWrap}>
            <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }], opacity: active ? ringOpacity : 0 }]} />
            <Animated.View style={[styles.ring2, { transform: [{ scale: ringScale }], opacity: active ? ringOpacity : 0 }]} />
            <Animated.View style={[styles.globe, { transform: [{ scale: pulseScale }] }]}>
              <Logo size={54} />
            </Animated.View>
          </Pressable>

          <Text style={styles.status}>
            {status === 'listening' ? tr('vListening')
              : status === 'hearing' ? 'Hearing you…'
              : status === 'thinking' ? tr('vThinking')
              : status === 'speaking' ? tr('vSpeaking') : tr('vIdle')}
          </Text>
          {!!caption && <Text style={styles.caption} numberOfLines={3}>{caption}</Text>}
          {!!error && <Text style={styles.err}>{error}</Text>}
          {/* Per-step timings so it's obvious which call is the slow one. */}
          {(timing.stt || timing.ai) ? (
            <Text style={styles.hint}>
              {'voice ' + (timing.stt || 0) + 'ms · ai ' + (timing.ai || 0) + 'ms' + (timing.tts ? ' · talk ' + timing.tts + 'ms' : '')}
            </Text>
          ) : (
            <Text style={styles.hint}>{status === 'listening' ? tr('tapToSend') : ''}</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = () => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: 280, borderRadius: 28, backgroundColor: RED, alignItems: 'center', paddingTop: 26, paddingBottom: 24, paddingHorizontal: 20 },
  close: { position: 'absolute', top: 12, right: 12, padding: 4 },
  globeWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.25)' },
  ring2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  globe: { width: 96, height: 96, borderRadius: 48, backgroundColor: ON, alignItems: 'center', justifyContent: 'center' },
  status: { color: ON, fontFamily: fonts.semibold, fontSize: 17, marginTop: 18 },
  caption: { color: DIM, fontFamily: fonts.regular, fontSize: 13.5, textAlign: 'center', marginTop: 10, lineHeight: 19 },
  err: { color: '#FFE08A', fontFamily: fonts.medium, fontSize: 12.5, textAlign: 'center', marginTop: 8 },
  hint: { color: DIM, fontFamily: fonts.regular, fontSize: 12, marginTop: 12 },
});
