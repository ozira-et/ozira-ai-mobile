import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import FlagMenu from '../components/FlagMenu';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { api } from '../api';
import { config } from '../config';

export default function DeveloperScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = makeStyles(colors);
  const { token } = useAuth();
  const { openSidebar } = useUI();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setData(await api.devKeys(token)); } catch (_) {}
  }
  useEffect(() => { load(); }, []);

  async function createKey() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const d = await api.devKeyCreate(name.trim(), token);
      setNewKey(d.key);
      setName('');
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    setBusy(false);
  }

  async function copyKey() {
    try { await Clipboard.setStringAsync(newKey); Alert.alert('Copied', 'Key copied to clipboard. Save it now - it is shown only once.'); } catch (_) {}
  }

  function revoke(k) {
    Alert.alert('Revoke key?', 'Apps using "' + k.name + '" will stop working.', [
      { text: 'Cancel' },
      { text: 'Revoke', style: 'destructive', onPress: async () => { try { await api.devKeyRevoke(k.id, token); load(); } catch (e) { Alert.alert('Error', e.message); } } },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={24} />
        <Text style={styles.title}>API and Developer</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>OZIRA Developer API</Text>
          <Text style={styles.cardSub}>OpenAI-compatible. Point any SDK at {config.API_BASE}/v1 and pay in Birr.</Text>
          <View style={styles.balRow}>
            <Text style={styles.balLabel}>API credit balance</Text>
            <Text style={styles.balVal}>{data ? Number(data.balance || 0).toLocaleString() : '-'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>API keys</Text>
          <View style={styles.createRow}>
            <TextInput
              style={styles.input}
              value={name} onChangeText={setName}
              placeholder="Key name, e.g. my-telegram-bot"
              placeholderTextColor={colors.muted}
            />
            <Pressable style={styles.createBtn} onPress={createKey} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.createTxt}>Create</Text>}
            </Pressable>
          </View>

          {newKey ? (
            <Pressable style={styles.newKey} onPress={copyKey}>
              <Text style={styles.newKeyWarn}>Save this key now - shown only once. Tap to copy:</Text>
              <Text style={styles.newKeyVal}>{newKey}</Text>
            </Pressable>
          ) : null}

          {(data?.keys || []).map(k => (
            <View key={k.id} style={styles.keyRow}>
              <Ionicons name="key" size={16} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.keyName}>{k.name} <Text style={styles.keyPrefix}>({k.prefix})</Text></Text>
                <Text style={styles.keyStats}>{k.requests} requests - {k.credits} credits</Text>
              </View>
              <Pressable onPress={() => revoke(k)} hitSlop={8}><Ionicons name="close-circle" size={20} color={colors.danger} /></Pressable>
            </View>
          ))}
          {data && (data.keys || []).length === 0 && !newKey && (
            <Text style={styles.empty}>No keys yet. First key includes 25 free credits.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 16, marginBottom: 14,
  },
  cardTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15.5, marginBottom: 6 },
  cardSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
  balRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13.5 },
  balVal: { color: colors.gold, fontFamily: fonts.bold, fontSize: 20 },
  createRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  input: {
    flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 12, height: 44,
    color: colors.text, fontFamily: fonts.regular, fontSize: 13.5,
  },
  createBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  createTxt: { color: colors.white, fontFamily: fonts.semibold, fontSize: 13.5 },
  newKey: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.gold,
    borderRadius: radius.md, padding: 12, marginBottom: 10,
  },
  newKeyWarn: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginBottom: 6 },
  newKeyVal: { color: colors.gold, fontFamily: fonts.medium, fontSize: 12.5 },
  keyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  keyName: { color: colors.text, fontFamily: fonts.medium, fontSize: 13.5 },
  keyPrefix: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  keyStats: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11.5, marginTop: 1 },
  empty: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5 },
});
