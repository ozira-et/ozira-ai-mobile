import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import FlagMenu from '../components/FlagMenu';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { api } from '../api';

// Integrations. `live: true` works today; the rest are honest "coming soon"
// until the OAuth backend (Phase 2) is built.
const CONNECTORS = [
  { id: 'telegram', name: 'Telegram', sub: 'Get answers & daily tasks in Telegram', icon: 'paper-plane', color: '#229ED9', live: true },
  { id: 'gdrive', name: 'Google Drive', sub: 'Let OZIRA read your documents', icon: 'logo-google', color: '#1FA855', live: false },
  { id: 'gmail', name: 'Gmail', sub: 'Summarize and draft emails', icon: 'mail', color: '#E5484D', live: false },
  { id: 'gcal', name: 'Google Calendar', sub: 'Check and add events', icon: 'calendar', color: '#7C3AED', live: false },
  { id: 'whatsapp', name: 'WhatsApp', sub: 'Chat with OZIRA on WhatsApp', icon: 'logo-whatsapp', color: '#25D366', live: false },
];

export default function ConnectorsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = makeStyles(colors);
  const { token } = useAuth();
  const { openSidebar } = useUI();
  const [tgLinked, setTgLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [linkCode, setLinkCode] = useState(null);
  const [bot, setBot] = useState(null);

  async function refresh() {
    try {
      const d = await api.schedules(token); // returns telegramLinked
      setTgLinked(!!d.telegramLinked);
    } catch (_) {}
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function connectTelegram() {
    try {
      const d = await api.telegramLinkCode(token);
      setLinkCode(d.code);
      setBot(d.botUsername || null);
    } catch (e) { Alert.alert('Error', e.message); }
  }

  function onTap(c) {
    if (!c.live) return Alert.alert('Coming soon', c.name + ' will be available once account connections are enabled.');
    if (c.id === 'telegram') {
      if (tgLinked) Alert.alert('Connected', 'Your Telegram is already linked to OZIRA.');
      else connectTelegram();
    }
  }

  const connected = CONNECTORS.filter(c => c.id === 'telegram' && tgLinked);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={24} />
        <Text style={styles.title}>Connectors</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
          <Text style={styles.intro}>Connect your accounts so OZIRA can help across the apps you already use.</Text>

          {linkCode ? (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Link your Telegram</Text>
              <Text style={styles.code}>{linkCode}</Text>
              <Text style={styles.codeSteps}>
                1. Open {bot ? '@' + bot : 'the OZIRA bot'} in Telegram{'\n'}
                2. Send:  /link {linkCode}{'\n'}
                3. Come back and pull to refresh
              </Text>
              <Pressable style={styles.refreshBtn} onPress={() => { setLinkCode(null); refresh(); }}>
                <Text style={styles.refreshTxt}>Done / Refresh</Text>
              </Pressable>
            </View>
          ) : null}

          {connected.length > 0 && (
            <>
              <Text style={styles.section}>Connected</Text>
              {connected.map(c => (
                <View key={c.id} style={styles.row}>
                  <View style={[styles.icon, { backgroundColor: c.color + '22' }]}><Ionicons name={c.icon} size={19} color={c.color} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{c.name}</Text>
                    <Text style={[styles.rowSub, { color: colors.success }]}>Connected</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                </View>
              ))}
            </>
          )}

          <Text style={styles.section}>Add connector</Text>
          {CONNECTORS.map(c => {
            const isOn = c.id === 'telegram' && tgLinked;
            return (
              <Pressable key={c.id} style={styles.row} onPress={() => onTap(c)}>
                <View style={[styles.icon, { backgroundColor: c.color + '22' }]}><Ionicons name={c.icon} size={19} color={c.color} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{c.name}</Text>
                  <Text style={styles.rowSub}>{c.sub}</Text>
                </View>
                {isOn ? <Text style={[styles.tag, { color: colors.success, borderColor: colors.success }]}>Connected</Text>
                  : c.live ? <Text style={[styles.tag, { color: colors.primary, borderColor: colors.primary }]}>Connect</Text>
                  : <Text style={styles.tag}>Soon</Text>}
              </Pressable>
            );
          })}

          <Text style={styles.note}>More connectors are on the way. Connected accounts can be managed here anytime.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  intro: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, marginBottom: 14 },
  section: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, marginTop: 8, marginBottom: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 13, marginBottom: 10,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowName: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14.5 },
  rowSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  tag: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  codeBox: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.lg, padding: 16, marginBottom: 16,
  },
  codeLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12.5 },
  code: { color: colors.text, fontFamily: fonts.bold, fontSize: 30, letterSpacing: 4, marginVertical: 6 },
  codeSteps: { color: colors.text, fontFamily: fonts.regular, fontSize: 13, lineHeight: 21 },
  refreshBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', marginTop: 12 },
  refreshTxt: { color: colors.white, fontFamily: fonts.semibold, fontSize: 13.5 },
  note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 17 },
});
