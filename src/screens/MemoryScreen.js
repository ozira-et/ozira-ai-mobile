import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Switch, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import { rtlText, rtlIcon } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

// Unified memory: the list is store.memories as seen through the backend
// /v1/memories API. Chat capture writes here automatically (when enabled), the
// server embeds each row for semantic recall, and relevant rows are injected
// into future prompts server-side.
const CATEGORIES = ['preference', 'fact', 'note', 'workflow'];
const MAX_LEN = 500;
const CONSENT_KEYS = ['assistant.memory_enabled', 'privacy.memory_enabled'];

function slugKey(text) {
  const base = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'memory';
  return base + '_' + Date.now().toString(36);
}
const isOn = (s, key) => s?.[key]?.value === true && s?.[key]?.source === 'user';

export default function MemoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLang();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState('');
  const [memories, setMemories] = useState([]);
  const [settings, setSettings] = useState({});
  const [draft, setDraft] = useState('');
  const [category, setCategory] = useState('preference');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // { id, content }

  const load = useCallback(async () => {
    setError('');
    try {
      const [m, s] = await Promise.all([
        api.memories(token),
        api.memorySettings(token).catch(() => ({ settings: {} })),
      ]);
      setDisabled(false);
      setMemories((m.memories || []).filter(x => !x.deletedAt && !x.supersededBy));
      setSettings(s.settings || {});
    } catch (e) {
      if (e.code === 'FEATURE_DISABLED') setDisabled(true);
      else setError(e.message || t('memLoadError'));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const enabled = CONSENT_KEYS.every(k => isOn(settings, k));
  const autoCapture = settings['assistant.memory_auto_capture']?.value !== false;
  const reviewRequired = settings['assistant.memory_review_required']?.value === true;

  async function patchSettings(patch) {
    const prev = settings;
    setSettings(cur => { const next = { ...cur }; for (const k in patch) next[k] = { ...(cur[k] || {}), value: patch[k], source: 'user' }; return next; });
    try {
      const r = await api.saveMemorySettings(patch, token);
      if (r.rejected?.length) throw new Error(r.rejected.map(x => x.reason).join(' '));
      if (r.settings) setSettings(r.settings);
    } catch (e) {
      setSettings(prev);
      Alert.alert(t('memSettingsError'), e.message);
    }
  }
  const toggleEnabled = v => patchSettings(Object.fromEntries(CONSENT_KEYS.map(k => [k, v])));

  async function add() {
    const content = draft.trim();
    if (!content) return;
    setBusy(true);
    try {
      const r = await api.memoryCreate({ category, key: slugKey(content), content }, token);
      setMemories(prev => [r.memory, ...prev]);
      setDraft('');
    } catch (e) {
      Alert.alert(t('memSaveError'), e.code === 'SECRET_LIKE_CONTENT' ? t('memSecret') : e.message);
    } finally { setBusy(false); }
  }

  async function saveEdit() {
    const content = editing?.content?.trim();
    if (!content) return;
    setBusy(true);
    try {
      const r = await api.memoryCorrect(editing.id, content, 'Edited by user in mobile Memory screen', token);
      setMemories(prev => prev.map(m => (m.id === editing.id ? (r.new || m) : m)));
      setEditing(null);
    } catch (e) {
      Alert.alert(t('memSaveError'), e.code === 'SECRET_LIKE_CONTENT' ? t('memSecret') : e.message);
    } finally { setBusy(false); }
  }

  async function approve(m) {
    try {
      const r = await api.memoryApprove(m.id, token);
      setMemories(prev => prev.map(x => (x.id === m.id ? { ...x, ...(r.memory || {}), status: 'active' } : x)));
    } catch (e) { Alert.alert(t('memSaveError'), e.message); }
  }

  function remove(m) {
    Alert.alert(t('memDeleteTitle'), m.content, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('remove'), style: 'destructive', onPress: async () => {
        try { await api.memoryDelete(m.id, token); setMemories(prev => prev.filter(x => x.id !== m.id)); }
        catch (e) { Alert.alert(t('memSaveError'), e.message); }
      } },
    ]);
  }

  function removeAll() {
    Alert.alert(t('memDeleteAll'), t('memDeleteAllConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('remove'), style: 'destructive', onPress: async () => {
        try { await api.memoryDeleteAll(token); setMemories([]); }
        catch (e) { Alert.alert(t('memSaveError'), e.message); }
      } },
    ]);
  }

  const pending = memories.filter(m => m.status === 'pending_review');
  const active = memories.filter(m => m.status !== 'pending_review');
  const grouped = active.reduce((acc, m) => { const c = m.category || 'note'; (acc[c] ||= []).push(m); return acc; }, {});

  // Rendered as a plain function (not a nested component) so the inline edit
  // TextInput is not remounted, and does not lose focus, on every keystroke.
  const renderRow = (m, isPending) => (
    <View key={m.id} style={styles.memRow}>
      {editing?.id === m.id ? (
        <View style={{ flex: 1 }}>
          <TextInput style={[styles.input, styles.multi]} value={editing.content} maxLength={MAX_LEN} multiline autoFocus
            onChangeText={content => setEditing({ ...editing, content })} />
          <View style={styles.editActions}>
            <Pressable onPress={() => setEditing(null)} style={styles.ghostBtn}><Text style={styles.ghostTxt}>{t('cancel')}</Text></Pressable>
            <Pressable onPress={saveEdit} disabled={busy} style={styles.smallBtn}><Text style={styles.smallBtnTxt}>{t('memSave')}</Text></Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={{ flex: 1 }}>
            <Text style={[styles.memTxt, rtlText(rtl)]}>{m.content}</Text>
            <Text style={[styles.memMeta, rtlText(rtl)]}>{m.source === 'user_stated' ? t('memSourceYou') : t('memSourceChat')}{m.updatedAt ? ' · ' + new Date(m.updatedAt).toLocaleDateString() : ''}</Text>
          </View>
          {isPending ? (
            <Pressable hitSlop={8} onPress={() => approve(m)} accessibilityLabel={t('memApprove')}><Ionicons name="checkmark-circle" size={22} color={colors.success || colors.primary} /></Pressable>
          ) : (
            <Pressable hitSlop={8} onPress={() => setEditing({ id: m.id, content: m.content })} accessibilityLabel={t('memEdit')}><Ionicons name="create-outline" size={19} color={colors.muted} /></Pressable>
          )}
          <Pressable hitSlop={8} onPress={() => remove(m)} accessibilityLabel={t('remove')}><Ionicons name="trash-outline" size={19} color={colors.danger} /></Pressable>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name={rtlIcon('chevron-back', rtl)} size={26} color={colors.text} /></Pressable>
        <Text style={styles.title}>{t('mMemory')}</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : disabled ? (
        <View style={styles.empty}>
          <Ionicons name="bulb-outline" size={36} color={colors.muted} />
          <Text style={styles.emptyTxt}>{t('memUnavailable')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>
          <Text style={[styles.intro, rtlText(rtl)]}>{t('memIntro')}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, rtlText(rtl)]}>{t('memUse')}</Text>
                <Text style={[styles.sub, rtlText(rtl)]}>{t('memUseSub')}</Text>
              </View>
              <Switch value={enabled} onValueChange={toggleEnabled} trackColor={{ true: colors.primary }} />
            </View>
            {enabled ? (
              <>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, rtlText(rtl)]}>{t('memAuto')}</Text>
                    <Text style={[styles.sub, rtlText(rtl)]}>{t('memAutoSub')}</Text>
                  </View>
                  <Switch value={autoCapture} onValueChange={v => patchSettings({ 'assistant.memory_auto_capture': v })} trackColor={{ true: colors.primary }} />
                </View>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, rtlText(rtl)]}>{t('memReview')}</Text>
                    <Text style={[styles.sub, rtlText(rtl)]}>{t('memReviewSub')}</Text>
                  </View>
                  <Switch value={reviewRequired} onValueChange={v => patchSettings({ 'assistant.memory_review_required': v })} trackColor={{ true: colors.primary }} />
                </View>
              </>
            ) : null}
          </View>

          <Text style={[styles.section, rtlText(rtl)]}>{t('memAdd')}</Text>
          <View style={styles.card}>
            <View style={styles.chips}>
              {CATEGORIES.map(c => (
                <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipOn]}>
                  <Text style={[styles.chipTxt, category === c && { color: colors.white }]}>{t('memCat_' + c)}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={[styles.input, styles.multi]} value={draft} onChangeText={setDraft} maxLength={MAX_LEN} multiline
              placeholder={t('memAddPlaceholder')} placeholderTextColor={colors.muted} />
            <Pressable style={[styles.saveBtn, (!draft.trim() || busy) && { opacity: 0.5 }]} onPress={add} disabled={!draft.trim() || busy}>
              <Text style={styles.saveTxt}>{busy ? '…' : t('memSave')}</Text>
            </Pressable>
          </View>

          {pending.length ? (
            <>
              <Text style={[styles.section, rtlText(rtl)]}>{t('memPending')} ({pending.length})</Text>
              <View style={styles.card}>{pending.map(m => renderRow(m, true))}</View>
            </>
          ) : null}

          {active.length === 0 && !pending.length ? (
            <Text style={[styles.sub, { textAlign: 'center', marginTop: 24 }]}>{t('memEmpty')}</Text>
          ) : Object.keys(grouped).sort().map(cat => (
            <View key={cat}>
              <Text style={[styles.section, rtlText(rtl)]}>{t('memCat_' + cat) === 'memCat_' + cat ? cat : t('memCat_' + cat)}</Text>
              <View style={styles.card}>{grouped[cat].map(m => renderRow(m, false))}</View>
            </View>
          ))}

          {memories.length ? (
            <Pressable style={styles.dangerBtn} onPress={removeAll}>
              <Ionicons name="trash-outline" size={17} color={colors.danger} />
              <Text style={styles.dangerTxt}>{t('memDeleteAll')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  intro: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  error: { color: colors.danger, fontFamily: fonts.medium, fontSize: 13, marginBottom: 10 },
  section: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 18, marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  label: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14.5 },
  sub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, color: colors.text, fontFamily: fonts.regular, fontSize: 14.5 },
  multi: { minHeight: 72, textAlignVertical: 'top', paddingTop: 10, paddingBottom: 10 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  saveTxt: { color: colors.white, fontFamily: fonts.semibold, fontSize: 14.5 },
  memRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  memTxt: { color: colors.text, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  memMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11.5, marginTop: 3 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  smallBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 8 },
  smallBtnTxt: { color: colors.white, fontFamily: fonts.semibold, fontSize: 13 },
  ghostBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  ghostTxt: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger + '66' },
  dangerTxt: { color: colors.danger, fontFamily: fonts.semibold, fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 },
  emptyTxt: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
