// Provider-neutral Gemini Live voice + optional camera frames. The permanent
// provider key stays on the OZIRA backend; this client sends authenticated PCM,
// text, and throttled JPEG frames over one OZIRA WebSocket protocol.
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {View, Text, StyleSheet, Pressable, Modal, Animated, Easing} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {CameraView, useCameraPermissions} from 'expo-camera';
import {fonts} from '../theme';
import Logo from './Logo';
import {createRealtimeVoiceSession} from '../realtimeVoice';
import {t as translate} from '../i18n';

const RED = '#B3121B';
const ON = '#FFFFFF';
const DIM = 'rgba(255,255,255,0.8)';
const HISTORY_TURNS = 8;

function errorMessage(event) {
  const value = event?.error?.message || event?.message || 'Live voice failed.';
  const message = String(value).replace(/\s+/g, ' ').trim();
  if (/quota|rate.?limit|billing|insufficient_quota/i.test(message)) return 'Gemini Live quota is unavailable. Check the Gemini project billing and limits.';
  if (/native module|audiostudio|null|not installed/i.test(message)) return 'OZIRA_REALTIME_BUILD';
  return message.length > 220 ? message.slice(0, 217) + '…' : message;
}

export default function VoiceOverlay({visible, onClose, token, lang = 'en', getHistory, onExchange}) {
  const styles = useMemo(() => makeStyles(), []);
  const [status, setStatus] = useState('idle');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const sessionRef = useRef(null);
  const abortRef = useRef(null);
  const epochRef = useRef(0);
  const historyRef = useRef([]);
  const userTextRef = useRef('');
  const answerTextRef = useRef('');
  const exchangeSavedRef = useRef(false);
  const cameraRef = useRef(null);
  const cameraBusyRef = useRef(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const tr = (key) => translate(lang, key);

  useEffect(() => {
    if (visible) void start();
    else void stop();
    return () => { void stop(); };
  }, [visible, lang]);

  useEffect(() => {
    if (!visible || !connected || !cameraOn || !cameraPermission?.granted) return undefined;
    const timer = setInterval(async () => {
      if (!cameraRef.current || cameraBusyRef.current) return;
      cameraBusyRef.current = true;
      try {
        const frame = await cameraRef.current.takePictureAsync({base64: true, quality: 0.35, skipProcessing: true, shutterSound: false});
        if (frame?.base64) sessionRef.current?.sendCameraFrame?.(frame.base64, 'image/jpeg');
      } catch (_) {}
      finally { cameraBusyRef.current = false; }
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, connected, cameraOn, cameraPermission?.granted]);

  useEffect(() => {
    const ringLoop = Animated.loop(Animated.timing(ring, {toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true}));
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, {toValue: 1, duration: 700, useNativeDriver: true}),
      Animated.timing(pulse, {toValue: 0, duration: 700, useNativeDriver: true}),
    ]));
    ringLoop.start(); pulseLoop.start();
    return () => { ringLoop.stop(); pulseLoop.stop(); };
  }, []);

  function resetTurn() {
    userTextRef.current = '';
    answerTextRef.current = '';
    exchangeSavedRef.current = false;
  }

  function saveExchange() {
    if (exchangeSavedRef.current) return;
    const user = userTextRef.current.trim();
    const answer = answerTextRef.current.trim();
    if (!user || !answer) return;
    exchangeSavedRef.current = true;
    onExchange?.(user, answer);
    historyRef.current = [...historyRef.current, {role: 'user', content: user}, {role: 'assistant', content: answer}].slice(-HISTORY_TURNS);
  }

  async function stop() {
    epochRef.current += 1;
    abortRef.current?.abort(); abortRef.current = null;
    const current = sessionRef.current; sessionRef.current = null;
    await current?.close?.();
    setConnected(false); setCameraOn(false); setStatus('idle');
  }

  async function start() {
    await stop();
    const epoch = ++epochRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    historyRef.current = (getHistory?.() || []).slice(-HISTORY_TURNS);
    resetTurn(); setError(''); setCaption(''); setStatus('connecting');
    try {
      const session = await createRealtimeVoiceSession({
        token, lang, signal: controller.signal,
        onEvent: (event) => { if (epoch === epochRef.current) handleEvent(event); },
      });
      if (epoch !== epochRef.current) { await session.close(); return; }
      sessionRef.current = session;
      session.sendContext?.(historyRef.current);
    } catch (event) {
      if (epoch !== epochRef.current || controller.signal.aborted) return;
      setError(errorMessage(event)); setStatus('idle');
    }
  }

  function handleEvent(event) {
    switch (event?.type) {
      case 'ready':
        setConnected(true); setStatus('listening'); setError('');
        break;
      case 'connection':
        if (event.state === 'connected') setConnected(true);
        if (event.state === 'failed') { setConnected(false); setError('OZIRA_REALTIME_INTERRUPTED'); setStatus('idle'); }
        break;
      case 'transcript': {
        const text = String(event.text || '').trim();
        if (!text) break;
        if (event.source === 'user') {
          if (exchangeSavedRef.current) resetTurn();
          userTextRef.current = text;
          setCaption('“' + text + '”'); setStatus('thinking');
        } else {
          answerTextRef.current = text;
          setCaption(text); setStatus('speaking'); saveExchange();
        }
        break;
      }
      case 'text_delta':
        answerTextRef.current += event.text || '';
        if (answerTextRef.current.trim()) { setCaption(answerTextRef.current.trim()); setStatus('speaking'); }
        break;
      case 'audio_delta':
        setStatus('speaking');
        break;
      case 'turn_complete':
        saveExchange(); setStatus('listening');
        break;
      case 'interrupted':
        saveExchange(); setStatus('listening');
        break;
      case 'reconnecting':
        setStatus('connecting'); setConnected(false);
        break;
      case 'session_expired':
        setError(event.message || 'Live session ended. Reopen it to continue.'); setStatus('idle'); setConnected(false);
        break;
      case 'error':
        setError(errorMessage(event)); setStatus(connected ? 'listening' : 'idle');
        break;
      default:
        break;
    }
  }

  async function toggleCamera() {
    if (!cameraOn && !cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) { setError(tr('vCameraPermission')); return; }
    }
    setCameraOn((value) => !value);
  }

  const ringScale = ring.interpolate({inputRange: [0, 1], outputRange: [1, 1.9]});
  const ringOpacity = ring.interpolate({inputRange: [0, 1], outputRange: [0.45, 0]});
  const active = status === 'listening' || status === 'speaking';
  const pulseScale = pulse.interpolate({inputRange: [0, 1], outputRange: [1, active ? 1.08 : 1.02]});

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, cameraOn && styles.cardCamera]}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('close')} hitSlop={12} style={styles.close}>
            <Ionicons name="close" size={20} color={ON} />
          </Pressable>
          {cameraOn && cameraPermission?.granted ? (
            <CameraView ref={cameraRef} style={styles.camera} facing="front" animateShutter={false} />
          ) : (
            <View style={styles.globeWrap}>
              <Animated.View style={[styles.ring, {transform: [{scale: ringScale}], opacity: active ? ringOpacity : 0}]} />
              <Animated.View style={[styles.ring2, {transform: [{scale: ringScale}], opacity: active ? ringOpacity : 0}]} />
              <Animated.View style={[styles.globe, {transform: [{scale: pulseScale}]}]}><Logo size={54} /></Animated.View>
            </View>
          )}
          <Text style={styles.status}>
            {status === 'connecting' ? tr('vConnecting') : status === 'listening' ? tr('vListening') : status === 'thinking' ? tr('vThinking') : status === 'speaking' ? tr('vSpeaking') : tr('vIdle')}
          </Text>
          {!!caption && <Text style={styles.caption} numberOfLines={4}>{caption}</Text>}
          {!!error && <Text style={styles.err}>{error === 'OZIRA_REALTIME_BUILD' ? tr('vRealtimeBuild') : error === 'OZIRA_REALTIME_INTERRUPTED' ? tr('vRealtimeInterrupted') : error}</Text>}
          <View style={styles.actions}>
            <Pressable onPress={toggleCamera} accessibilityRole="button" accessibilityLabel={cameraOn ? tr('vCameraOff') : tr('vCameraOn')} style={[styles.action, cameraOn && styles.actionOn]}>
              <Ionicons name={cameraOn ? 'videocam' : 'videocam-outline'} size={20} color={ON} />
            </Pressable>
          </View>
          <Text style={styles.hint}>{connected ? 'OZIRA · GEMINI LIVE' : ''}</Text>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = () => StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28},
  card: {width: 280, borderRadius: 28, backgroundColor: RED, alignItems: 'center', paddingTop: 26, paddingBottom: 20, paddingHorizontal: 20},
  cardCamera: {width: 320},
  close: {position: 'absolute', top: 12, right: 12, padding: 4, zIndex: 3},
  globeWrap: {width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginTop: 6},
  ring: {position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.25)'},
  ring2: {position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)'},
  globe: {width: 96, height: 96, borderRadius: 48, backgroundColor: ON, alignItems: 'center', justifyContent: 'center'},
  camera: {width: 272, height: 180, borderRadius: 18, overflow: 'hidden', marginTop: 8},
  status: {color: ON, fontFamily: fonts.semibold, fontSize: 17, marginTop: 16},
  caption: {color: DIM, fontFamily: fonts.regular, fontSize: 13.5, textAlign: 'center', marginTop: 10, lineHeight: 19},
  err: {color: '#FFE08A', fontFamily: fonts.medium, fontSize: 12.5, textAlign: 'center', marginTop: 8},
  actions: {flexDirection: 'row', marginTop: 12},
  action: {width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)'},
  actionOn: {backgroundColor: 'rgba(255,255,255,0.22)'},
  hint: {color: DIM, fontFamily: fonts.regular, fontSize: 11, marginTop: 10},
});
