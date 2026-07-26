import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { colors, fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import FlagMenu from '../components/FlagMenu';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { api } from '../api';

const SOURCES = [
  { id: 'chatgpt', label: 'ChatGPT', hint: 'conversations.json from your ChatGPT export' },
  { id: 'claude', label: 'Claude', hint: 'conversations.json from your Claude export' },
  { id: 'gemini', label: 'Gemini', hint: 'your Google Takeout / Gemini export' },
];

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = makeStyles(colors);
  const { token } = useAuth();
  const { openSidebar } = useUI();
  const [source, setSource] = useState('chatgpt');
  const [fileName, setFileName] = useState('');
  const [data, setData] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick() {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (r.canceled || !r.assets || !r.assets.length) return;
      const a = r.assets[0];
      const text = await new File(a.uri).text();
      if (!text) return Alert.alert('Empty file', 'Could not read that file. Pick your export JSON file.');
      setFileName(a.name || 'export');
      setData(text);
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function doImport() {
    if (!data || busy) return Alert.alert('Pick a file', 'Choose your export file first.');
    setBusy(true);
    try {
      const d = await api.importData(source, data, token);
      Alert.alert('Imported', 'Imported ' + (d.imported || 0) + ' conversations. Find them in your chat history.');
      setData(''); setFileName('');
    } catch (e) { Alert.alert('Could not import', e.message); }
    setBusy(false);
  }

  const cur = SOURCES.find(s => s.id === source);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={24} />
        <Text style={styles.title}>Import chats</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
        <Text style={styles.intro}>Bring your old conversations from ChatGPT, Claude or Gemini into OZIRA. Export your data from that app, then upload the file here.</Text>

        <Text style={styles.section}>Where are they from?</Text>
        <View style={styles.chips}>
          {SOURCES.map(s => (
            <Pressable key={s.id} onPress={() => setSource(s.id)} style={[styles.chip, source === s.id && styles.chipOn]}>
              <Text style={[styles.chipTxt, source === s.id && { color: colors.white }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>{cur ? cur.hint : ''}</Text>

        <Pressable style={styles.pick} onPress={pick}>
          <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
          <Text style={styles.pickTxt}>{fileName ? fileName : 'Choose export file'}</Text>
        </Pressable>

        <Pressable style={[styles.btn, (!data || busy) && { opacity: 0.5 }]} onPress={doImport} disabled={!data || busy}>
          {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.btnTxt}>Import conversations</Text>}
        </Pressable>

        <Text style={styles.note}>Your data stays in your OZIRA account. Up to 500 conversations per import.</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  intro: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, marginBottom: 16 },
  section: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, marginBottom: 10 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
  hint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 8, marginBottom: 16 },
  pick: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: radius.lg, paddingVertical: 22, marginBottom: 16 },
  pickTxt: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  btn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  btnTxt: { color: colors.white, fontFamily: fonts.semibold, fontSize: 14.5 },
  note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 17 },
});
