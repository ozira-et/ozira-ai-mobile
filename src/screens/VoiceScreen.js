// Full-screen voice conversation mode. Brand-red page with an animated waveform
// so it's instantly recognisable ("this person is on a voice chat"). Flow:
//   tap mic -> record -> transcribe -> AI reply -> read the reply aloud.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { api } from '../api';
import { File } from 'expo-file-system';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { ensurePrepared, finalizeRecording } from '../audioSession';
import { speakText, stopSpeaking } from '../tts';

const RED = '#B3121B';
const RED_DK = '#7E0D14';
const ON = '#FFFFFF';
const DIM = 'rgba(255,255,255,0.75)';
const BARS = 7;

export default function VoiceScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(), []);
  const { token, user } = useAuth();
  const { lang, t } = useLang();
  const firstName = ((user?.name || '').trim().split(' ')[0]) || '';
  const LABEL = { idle: t('vIdle'), listening: t('vListening'), thinking: t('vThinking'), speaking: t('vSpeaking') };
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [status, setStatus] = useState('idle'); // idle | listening | thinking | speaking
  const [userText, setUserText] = useState('');
  const [aiText, setAiText] = useState('');
  const [error, setError] = useState('');
  const msgsRef = useRef([]);
  const bars = useRef([...Array(BARS)].map(() => new Animated.Value(0.35))).current;
  const loopsRef = useRef([]);

  useEffect(() => () => { stopSpeaking(); stopBars(); }, []);

  function startBars() {
    stopBars();
    loopsRef.current = bars.map((b, i) => {
      const up = 0.5 + Math.abs(((i % 4) - 1.5)) * 0.25; // vary peak per bar
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(b, { toValue: up + 0.25, duration: 260 + i * 55, useNativeDriver: true }),
        Animated.timing(b, { toValue: 0.35, duration: 260 + i * 55, useNativeDriver: true }),
      ]));
      loop.start();
      return loop;
    });
  }
  function stopBars() {
    loopsRef.current.forEach((l) => { try { l.stop(); } catch (_) {} });
    loopsRef.current = [];
    bars.forEach((b) => Animated.timing(b, { toValue: 0.35, duration: 180, useNativeDriver: true }).start());
  }

  async function onMic() {
    setError('');
    if (status === 'listening') return stopAndProcess();
    if (status === 'idle') return startListening();
    // thinking/speaking: interrupt speech and go back to idle
    if (status === 'speaking') { stopSpeaking(); stopBars(); setStatus('idle'); }
  }

  async function startListening() {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { setError('Microphone permission is needed for voice chat.'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await ensurePrepared(recorder);
      recorder.record();
      setUserText(''); setAiText('');
      setStatus('listening'); startBars();
    } catch (e) { setError(e.message || 'Could not start recording.'); setStatus('idle'); }
  }

  async function stopAndProcess() {
    setStatus('thinking'); stopBars();
    try {
      const { uri } = await finalizeRecording(recorder);
      if (!uri) throw new Error('No audio was captured. Try again.');
      const b64 = await new File(uri).base64();
      const d = await api.aiTranscribe(b64, Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4', token);
      const text = (d && d.text || '').trim();
      if (!text) { setError((d && (d.notice || d.error)) || "I didn't catch that. Try again."); setStatus('idle'); return; }
      setUserText(text);

      const convo = [...msgsRef.current, { role: 'user', content: text }];
      const sys = { role: 'system', content:
        'You are OZIRA, a warm, friendly voice assistant.'
        + (firstName ? ' The user\'s name is ' + firstName + '; greet them by name and address them personally.' : '')
        + ' Keep replies short and conversational, suitable to be read aloud.' };
      const r = await api.chat({ model: 'auto', tier: 'fast', effort: 'quick', skill: 'general', messages: [sys, ...convo], lang }, token);
      const answer = (r && r.reply || '').trim() || "Sorry, I couldn't answer that.";
      msgsRef.current = [...convo, { role: 'assistant', content: answer }];
      setAiText(answer);

      setStatus('speaking'); startBars();
      const res = await speakText(answer, token, () => { stopBars(); setStatus('idle'); });
      if (!res || !res.ok) { setError((res && res.message) || 'Could not play the reply.'); stopBars(); setStatus('idle'); }
    } catch (e) { setError(e.message || 'Something went wrong.'); stopBars(); setStatus('idle'); }
  }

  const active = status === 'listening' || status === 'speaking';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.header}>
        <Text style={styles.brand}>{t('voiceBrand')}</Text>
        <Pressable onPress={() => { stopSpeaking(); navigation.goBack(); }} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={26} color={ON} />
        </Pressable>
      </View>

      <View style={styles.center}>
        <View style={styles.waveWrap}>
          {bars.map((b, i) => (
            <Animated.View key={i} style={[styles.bar, { transform: [{ scaleY: b }], opacity: active ? 1 : 0.5 }]} />
          ))}
        </View>
        <Text style={styles.status}>{LABEL[status]}</Text>
        {!!userText && <Text style={styles.you} numberOfLines={3}>“{userText}”</Text>}
        {!!aiText && <Text style={styles.ai} numberOfLines={6}>{aiText}</Text>}
        {!!error && <Text style={styles.err}>{error}</Text>}
      </View>

      <View style={styles.controls}>
        <Pressable onPress={onMic} style={[styles.mic, status === 'listening' && styles.micLive]}>
          <Ionicons
            name={status === 'listening' ? 'stop' : status === 'speaking' ? 'volume-high' : status === 'thinking' ? 'ellipsis-horizontal' : 'mic'}
            size={36}
            color={RED}
          />
        </Pressable>
        <Text style={styles.hint}>
          {status === 'listening' ? t('tapToSend') : status === 'idle' ? t('tapToTalk') : ''}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: RED, paddingHorizontal: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: ON, fontFamily: fonts.bold, fontSize: 16, letterSpacing: 0.5 },
  close: { padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  waveWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 140 },
  bar: { width: 12, height: 120, borderRadius: 8, backgroundColor: ON },
  status: { color: ON, fontFamily: fonts.semibold, fontSize: 18 },
  you: { color: ON, fontFamily: fonts.medium, fontSize: 16, textAlign: 'center', marginTop: 4 },
  ai: { color: DIM, fontFamily: fonts.regular, fontSize: 14.5, textAlign: 'center', lineHeight: 21 },
  err: { color: '#FFE08A', fontFamily: fonts.medium, fontSize: 13.5, textAlign: 'center' },
  controls: { alignItems: 'center', gap: 12 },
  mic: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: ON,
    alignItems: 'center', justifyContent: 'center',
    ...(Platform.OS === 'ios' ? { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } } : { elevation: 8 }),
  },
  micLive: { backgroundColor: '#FFD7DA' },
  hint: { color: DIM, fontFamily: fonts.medium, fontSize: 13 },
});
