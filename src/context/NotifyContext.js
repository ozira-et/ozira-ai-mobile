// In-app popup notifications ("widget" toasts). Any screen can call
//   const { notify } = useNotify();
//   notify('Image ready', 'Your image finished generating.', 'success');
// and a card slides down from the top, then dismisses itself.
//
// NOTE: these are IN-APP popups, shown while OZIRA is open. Real push
// notifications (delivered when the app is closed) need expo-notifications plus
// a development build — Expo Go dropped push support — so that's a separate step.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import { useColors } from '../context/ThemeContext';
import { getSettings } from '../localStore';

const NotifyContext = createContext(null);
export const useNotify = () => useContext(NotifyContext) || { notify: () => {} };

const KIND = {
  success: { icon: 'checkmark-circle', color: '#078930' },
  info:    { icon: 'information-circle', color: '#2563EB' },
  warn:    { icon: 'alert-circle', color: '#B45309' },
  error:   { icon: 'close-circle', color: '#B3121B' },
};

export function NotifyProvider({ children }) {
  const [queue, setQueue] = useState([]);   // [{ id, title, body, kind }]
  const enabledRef = useRef(true);
  const idRef = useRef(0);

  // Respect the "Popup alerts" switch in Settings.
  useEffect(() => {
    (async () => {
      try { const s = await getSettings(); enabledRef.current = s.notify !== false; } catch (_) {}
    })();
  }, []);

  const notify = useCallback((title, body, kind = 'info') => {
    if (!enabledRef.current) return;
    const id = ++idRef.current;
    setQueue(q => [...q.slice(-2), { id, title, body, kind }]);   // keep at most 3
  }, []);

  const dismiss = useCallback((id) => setQueue(q => q.filter(n => n.id !== id)), []);
  // Let Settings flip it without a reload.
  const setNotifyEnabled = useCallback((v) => { enabledRef.current = !!v; }, []);

  return (
    <NotifyContext.Provider value={{ notify, setNotifyEnabled }}>
      {children}
      <Host queue={queue} dismiss={dismiss} />
    </NotifyContext.Provider>
  );
}

function Host({ queue, dismiss }) {
  const insets = useSafeAreaInsets();
  if (!queue.length) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      {queue.map(n => <Toast key={n.id} data={n} onDone={() => dismiss(n.id)} />)}
    </View>
  );
}

function Toast({ data, onDone }) {
  const colors = useColors();
  const slide = useRef(new Animated.Value(-120)).current;
  const k = KIND[data.kind] || KIND.info;

  useEffect(() => {
    let killed = false;
    Animated.spring(slide, { toValue: 0, useNativeDriver: true, tension: 70, friction: 11 }).start();
    const timer = setTimeout(() => close(), 4000);
    function close() {
      if (killed) return;
      Animated.timing(slide, { toValue: -140, duration: 200, useNativeDriver: true })
        .start(() => { if (!killed) onDone(); });
    }
    return () => { killed = true; clearTimeout(timer); };
  }, []);

  return (
    <Animated.View style={[
      styles.card,
      { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ translateY: slide }] },
      Platform.OS === 'ios'
        ? { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } }
        : { elevation: 6 },
    ]}>
      <Pressable style={styles.inner} onPress={onDone}>
        <View style={[styles.iconWrap, { backgroundColor: k.color + '22' }]}>
          <Ionicons name={k.icon} size={19} color={k.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{data.title}</Text>
          {!!data.body && <Text style={[styles.body, { color: colors.muted }]} numberOfLines={2}>{data.body}</Text>}
        </View>
        <Ionicons name="close" size={16} color={colors.muted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 12, right: 12, zIndex: 999, gap: 8 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, paddingHorizontal: 13 },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.semibold, fontSize: 14.5 },
  body: { fontFamily: fonts.regular, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
});
