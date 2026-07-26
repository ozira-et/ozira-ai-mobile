import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import FlagMenu from '../components/FlagMenu';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { api } from '../api';

export default function SchedulesScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = makeStyles(colors);
  const { token } = useAuth();
  const { openSidebar } = useUI();
  const [items, setItems] = useState([]);
  const [tgLinked, setTgLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try { const d = await api.schedules(token); setItems(d.schedules || []); setTgLinked(!!d.telegramLinked); } catch (_) {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (busy) return;
    if (!prompt.trim()) return Alert.alert('Missing', 'Enter what the AI should do.');
    if (!/^\d{2}:\d{2}$/.test(time)) return Alert.alert('Missing', 'Enter a time as HH:MM (Ethiopian time), e.g. 07:30.');
    setBusy(true);
    try {
      await api.scheduleCreate({ title: title.trim(), prompt: prompt.trim(), time, effort: 'quick' }, token);
      setTitle(''); setPrompt(''); setTime(''); await load();
    } catch (e) { Alert.alert('Error', e.message); }
    setBusy(false);
  }
  function del(id) {
    Alert.alert('Delete task', 'Remove this scheduled task?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.scheduleDelete(id, token); await load(); } catch (e) { Alert.alert('Error', e.message); } } },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={24} />
        <Text style={styles.title}>Scheduled tasks</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>OZIRA can run a task for you every day at a set time (Ethiopian time) and send the result{tgLinked ? ' to your Telegram' : ' — link Telegram in Connectors to get it on your phone'}.</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>New daily task</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Title (optional), e.g. Morning news" placeholderTextColor={colors.muted} />
            <TextInput style={[styles.input, { height: 84, textAlignVertical: 'top' }]} value={prompt} onChangeText={setPrompt} placeholder="What should the AI do? e.g. Summarize today's top Ethiopian business news" placeholderTextColor={colors.muted} multiline />
            <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="Time HH:MM (e.g. 07:30)" placeholderTextColor={colors.muted} keyboardType="numbers-and-punctuation" />
            <Pressable style={styles.btn} onPress={create} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.btnTxt}>Add task</Text>}
            </Pressable>
          </View>

          <Text style={styles.section}>Your tasks ({items.length})</Text>
          {items.length === 0 ? <Text style={styles.empty}>No scheduled tasks yet.</Text> : items.map(s => (
            <View key={s.id} style={styles.item}>
              <View style={styles.timeBadge}><Text style={styles.timeTxt}>{s.time}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>{s.title || 'Daily task'}</Text>
                <Text style={styles.itemPrompt} numberOfLines={2}>{s.prompt}</Text>
              </View>
              <Pressable onPress={() => del(s.id)} hitSlop={8}><Ionicons name="trash-outline" size={19} color={colors.danger} /></Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  intro: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, marginBottom: 14 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, marginBottom: 16 },
  cardTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, marginBottom: 10 },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 46, color: colors.text, fontFamily: fonts.regular, fontSize: 14.5, marginBottom: 10 },
  btn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  btnTxt: { color: colors.white, fontFamily: fonts.semibold, fontSize: 14 },
  section: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, marginBottom: 10 },
  empty: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13.5, textAlign: 'center', marginTop: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  timeBadge: { backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  timeTxt: { color: colors.primary, fontFamily: fonts.bold, fontSize: 13 },
  itemTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  itemPrompt: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 1, lineHeight: 16 },
});
