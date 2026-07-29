// True realtime voice mode. Microphone audio and model audio travel continuously
// over one WebRTC connection; no recorded MP4, STT upload, chat call or TTS
// download is used here. Normal voice messages remain file-based elsewhere.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import Logo from './Logo';
import { createRealtimeVoiceSession } from '../realtimeVoice';
import { t as translate } from '../i18n';

const RED = '#B3121B';
const ON = '#FFFFFF';
const DIM = 'rgba(255,255,255,0.8)';
const HISTORY_TURNS = 8;
const TRANSCRIPT_GROUNDED_LANGUAGES = new Set(['am', 'om', 'ti', 'ha']);

function errorMessage(event) {
  const value = event?.error?.message || event?.message || 'Realtime voice failed.';
  const message = String(value).replace(/\s+/g, ' ').trim();
  if (/quota|rate.?limit|billing|insufficient_quota/i.test(message)) {
    return 'OpenAI realtime quota is unavailable. Check the OpenAI project billing and limits.';
  }
  if (/native module|webrtc.*null|not found.*webrtc/i.test(message)) return 'OZIRA_REALTIME_BUILD';
  return message.length > 220 ? message.slice(0, 217) + '…' : message;
}

function responseTranscript(event) {
  const output = event?.response?.output || [];
  for (const item of output) {
    for (const part of item?.content || []) {
      const text = part?.transcript || part?.text;
      if (text) return String(text).trim();
    }
  }
  return '';
}

export default function VoiceOverlay({
  visible,
  onClose,
  token,
  lang = 'en',
  getHistory,
  onExchange,
}) {
  const styles = useMemo(() => makeStyles(), []);
  const [status, setStatus] = useState('idle');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  const sessionRef = useRef(null);
  const abortRef = useRef(null);
  const epochRef = useRef(0);
  const historyRef = useRef([]);
  const contextSentRef = useRef(false);
  const userPartialRef = useRef(new Map());
  const userTextRef = useRef('');
  const answerTextRef = useRef('');
  const exchangeSavedRef = useRef(false);
  const responseRequestedRef = useRef(false);
  const flushTimerRef = useRef(null);

  const pulse = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const tr = (key) => translate(lang, key);

  useEffect(() => {
    if (visible) void start();
    else stop();
    return stop;
  }, [visible, lang]);

  useEffect(() => {
    const ringLoop = Animated.loop(Animated.timing(
      ring,
      { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true },
    ));
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    ringLoop.start();
    pulseLoop.start();
    return () => { ringLoop.stop(); pulseLoop.stop(); };
  }, []);

  function resetTurn() {
    userPartialRef.current.clear();
    userTextRef.current = '';
    answerTextRef.current = '';
    exchangeSavedRef.current = false;
    responseRequestedRef.current = false;
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
  }

  function stop() {
    epochRef.current += 1;
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    sessionRef.current?.close?.();
    sessionRef.current = null;
    setConnected(false);
    setStatus('idle');
  }

  async function start() {
    stop();
    const epoch = ++epochRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    historyRef.current = (getHistory?.() || []).slice(-HISTORY_TURNS);
    contextSentRef.current = false;
    resetTurn();
    setError('');
    setCaption('');
    setStatus('connecting');

    try {
      const session = await createRealtimeVoiceSession({
        token,
        lang,
        signal: controller.signal,
        onEvent: (event) => {
          if (epoch === epochRef.current) handleEvent(event);
        },
      });
      if (epoch !== epochRef.current) {
        session.close();
        return;
      }
      sessionRef.current = session;
      if (!contextSentRef.current) {
        session.sendContext?.(historyRef.current);
        contextSentRef.current = true;
      }
    } catch (event) {
      if (epoch !== epochRef.current || controller.signal.aborted) return;
      setError(errorMessage(event));
      setStatus('idle');
    }
  }

  function maybeSaveExchange(wait = true) {
    if (exchangeSavedRef.current) return;
    const user = userTextRef.current.trim();
    const answer = answerTextRef.current.trim();
    if (user && answer) {
      exchangeSavedRef.current = true;
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
      onExchange?.(user, answer);
      historyRef.current = [...historyRef.current,
        { role: 'user', content: user },
        { role: 'assistant', content: answer },
      ].slice(-HISTORY_TURNS);
      return;
    }
    if (wait && answer && !flushTimerRef.current) {
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        maybeSaveExchange(false);
      }, 2500);
    }
  }

  function beginUserTurn() {
    maybeSaveExchange(false);
    resetTurn();
    setError('');
    setCaption('');
    setStatus('listening');
  }

  function handleEvent(event) {
    switch (event?.type) {
      case 'ozira.data.open':
        setConnected(true);
        setStatus('listening');
        if (!contextSentRef.current && sessionRef.current) {
          sessionRef.current.sendContext?.(historyRef.current);
          contextSentRef.current = true;
        }
        break;
      case 'ozira.connection':
        if (event.state === 'connected') {
          setConnected(true);
          setStatus((value) => value === 'connecting' ? 'listening' : value);
        } else if (event.state === 'failed' || event.state === 'disconnected') {
          setConnected(false);
          setError('OZIRA_REALTIME_INTERRUPTED');
          setStatus('idle');
        }
        break;
      case 'input_audio_buffer.speech_started':
        beginUserTurn();
        break;
      case 'input_audio_buffer.speech_stopped':
        setStatus('thinking');
        break;
      case 'conversation.item.input_audio_transcription.delta': {
        const itemId = event.item_id || 'current';
        const next = (userPartialRef.current.get(itemId) || '') + (event.delta || '');
        userPartialRef.current.set(itemId, next);
        if (next.trim()) setCaption('“' + next.trim() + '”');
        break;
      }
      case 'conversation.item.input_audio_transcription.completed': {
        const text = String(event.transcript || '').trim();
        if (text) {
          userTextRef.current = text;
          setCaption('“' + text + '”');
          if (TRANSCRIPT_GROUNDED_LANGUAGES.has(lang) && !responseRequestedRef.current) {
            responseRequestedRef.current = true;
            setStatus('thinking');
            sessionRef.current?.respondToTranscript?.(event.item_id, text);
          }
          maybeSaveExchange();
        }
        break;
      }
      case 'conversation.item.input_audio_transcription.failed':
        if (TRANSCRIPT_GROUNDED_LANGUAGES.has(lang) && !responseRequestedRef.current) {
          responseRequestedRef.current = true;
          setStatus('thinking');
          sessionRef.current?.respondToLatestAudio?.();
        }
        break;
      case 'response.created':
        setStatus('thinking');
        break;
      case 'response.output_audio_transcript.delta':
        answerTextRef.current += event.delta || '';
        if (answerTextRef.current.trim()) {
          setCaption(answerTextRef.current.trim());
          setStatus('speaking');
        }
        break;
      case 'response.output_audio_transcript.done': {
        const text = String(event.transcript || answerTextRef.current || '').trim();
        if (text) {
          answerTextRef.current = text;
          setCaption(text);
          setStatus('speaking');
          maybeSaveExchange();
        }
        break;
      }
      case 'response.done': {
        const text = responseTranscript(event) || answerTextRef.current;
        if (text) {
          answerTextRef.current = text;
          setCaption(text);
          maybeSaveExchange();
        }
        if (event?.response?.status === 'failed') {
          setError(errorMessage(event.response.status_details));
          setStatus('listening');
        }
        break;
      }
      case 'output_audio_buffer.stopped':
        maybeSaveExchange();
        setStatus('listening');
        break;
      case 'response.cancelled':
        maybeSaveExchange(false);
        setStatus('listening');
        break;
      case 'error':
        setError(errorMessage(event));
        setStatus(connected ? 'listening' : 'idle');
        break;
      default:
        break;
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

          <View style={styles.globeWrap}>
            <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }], opacity: active ? ringOpacity : 0 }]} />
            <Animated.View style={[styles.ring2, { transform: [{ scale: ringScale }], opacity: active ? ringOpacity : 0 }]} />
            <Animated.View style={[styles.globe, { transform: [{ scale: pulseScale }] }]}>
              <Logo size={54} />
            </Animated.View>
          </View>

          <Text style={styles.status}>
            {status === 'connecting' ? tr('vConnecting')
              : status === 'listening' ? tr('vListening')
                : status === 'thinking' ? tr('vThinking')
                  : status === 'speaking' ? tr('vSpeaking') : tr('vIdle')}
          </Text>
          {!!caption && <Text style={styles.caption} numberOfLines={4}>{caption}</Text>}
          {!!error && <Text style={styles.err}>
            {error === 'OZIRA_REALTIME_BUILD' ? tr('vRealtimeBuild')
              : error === 'OZIRA_REALTIME_INTERRUPTED' ? tr('vRealtimeInterrupted') : error}
          </Text>}
          <Text style={styles.hint}>{connected ? 'OZIRA · LIVE' : ''}</Text>
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
