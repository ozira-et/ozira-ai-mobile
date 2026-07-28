import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking, Alert, Switch, ImageBackground } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fonts, radius } from '../theme';
import { useColors, useThemeMode } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import { rtlText, rtlRow, rtlIcon, LANGUAGES } from '../i18n';
import FlagMenu from '../components/FlagMenu';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useNotify } from '../context/NotifyContext';
import { config } from '../config';
import { api } from '../api';
import { getSettings, setSettings as saveSettings, purgeAllHistory } from '../localStore';

const VOICES = [
  { label: 'Selam', voice: 'Kore' },
  { label: 'Abeba', voice: 'Aoede' },
  { label: 'Dawit', voice: 'Charon' },
  { label: 'Yonas', voice: 'Puck' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl, lang, setLang } = useLang();
  const { mode, resolved, cycle } = useThemeMode();
  const { user, token, signOut } = useAuth();
  const { openSidebar } = useUI();
  const { notify, setNotifyEnabled } = useNotify();
  const [st, setSt] = useState({ saveHistory: true, improveModel: false, voice: 'Kore', notify: true });

  useEffect(() => { (async () => {
    const local = await getSettings();
    let merged = local;
    try {
      const remote = await api.settings(token);
      merged = { ...local, ...(remote.settings || {}) };
      await saveSettings(merged);
    } catch (_) { /* Offline: the local copy remains available. */ }
    setSt({ saveHistory: merged.saveHistory !== false, improveModel: !!merged.improveModel, voice: merged.voice || 'Kore', notify: merged.notify !== false });
  })(); }, [token]);
  function update(patch) {
    setSt(prev => ({ ...prev, ...patch }));
    saveSettings(patch);
    api.saveSettings(patch, token).catch(() => {});
  }
  function purge() {
    Alert.alert('Purge all history', 'Permanently delete ALL your chats on this device? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Purge', style: 'destructive', onPress: async () => { await purgeAllHistory(); Alert.alert('Done', 'All chat history deleted.'); } },
    ]);
  }

  function open(url) { Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open the link.')); }

  function deleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently deletes your OZIRA account, chats and data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await api.deleteAccount(user?.email, token); Alert.alert('Deleted', 'Your account has been deleted.'); signOut(); }
          catch (e) { Alert.alert('Error', e.message); }
        } },
      ]
    );
  }

  const Row = ({ icon, label, value, onPress, danger }) => (
    <Pressable accessibilityRole={onPress ? "button" : undefined} style={({ pressed }) => [styles.row, onPress && pressed && styles.rowPressed]} onPress={onPress} disabled={!onPress}>
      <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.primary} />
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : (onPress ? <Ionicons name="chevron-forward" size={17} color={colors.muted} /> : null)}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={24} />
        <Text style={[styles.title, rtlText(rtl)]}>{t('settings')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
        <ImageBackground source={require('../../assets/sidebar-artistic-gradient.png')} style={styles.settingsHero} imageStyle={styles.settingsHeroArt}>
          <View style={styles.settingsHeroInner}>
            <Ionicons name="settings-outline" size={24} color="#FFD76A" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingsHeroTitle, rtlText(rtl)]}>{t('settings')}</Text>
              <Text style={[styles.settingsHeroSub, rtlText(rtl)]}>{t('preferences')}</Text>
            </View>
          </View>
        </ImageBackground>
        {/* PREFERENCES — language, theme, voice and alerts: everything that
            controls "how the app behaves for me", in one place. */}
        <Text style={[styles.section, rtlText(rtl)]}>{t('preferences')}</Text>
        <View style={styles.card}>
          <View style={[styles.row, { alignItems: 'flex-start' }]}>
            <Ionicons name="language" size={19} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, rtlText(rtl)]}>{t('language')}</Text>
              <View style={styles.langWrap}>
                {LANGUAGES.map(l => (
                  <Pressable key={l.code} onPress={() => setLang(l.code)} style={[styles.langPill, lang === l.code && styles.langOn]}>
                    <Text style={styles.langFlag}>{l.flag}</Text>
                    <Text style={[styles.langTxt, lang === l.code && { color: colors.white }]}>{l.native}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <Pressable style={styles.row} onPress={cycle}>
            <Ionicons name={mode === 'system' ? 'phone-portrait-outline' : (resolved === 'light' ? 'sunny' : 'moon')} size={19} color={colors.primary} />
            <Text style={[styles.rowLabel, rtlText(rtl)]}>{t('theme')}</Text>
            <Text style={styles.rowValue}>{mode === 'system' ? t('system') : (mode === 'light' ? t('light') : t('dark'))}</Text>
          </Pressable>
          <View style={[styles.row, { alignItems: 'flex-start' }]}>
            <Ionicons name="mic-outline" size={19} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, rtlText(rtl)]}>{t('voiceSection')}</Text>
              <Text style={[styles.rowSub, rtlText(rtl)]}>{t('voiceForReplies')}</Text>
              <View style={styles.voiceRow}>
                {VOICES.map(v => (
                  <Pressable key={v.voice} onPress={() => update({ voice: v.voice })} style={[styles.voicePill, st.voice === v.voice && styles.voiceOn]}>
                    <Text style={[styles.voiceTxt, st.voice === v.voice && { color: colors.white }]}>{v.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          {/* Alerts folded in here rather than a section of its own — it was one
              lone switch under its own heading. */}
          <View style={styles.row}>
            <Ionicons name="notifications-outline" size={19} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, rtlText(rtl)]}>{t('notifTasks')}</Text>
              <Text style={[styles.rowSub, rtlText(rtl)]}>{t('notifTasksSub')}</Text>
            </View>
            <Switch value={st.notify} onValueChange={v => { update({ notify: v }); setNotifyEnabled(v); if (v) notify(t('notifications'), t('notifTasksSub'), 'info'); }} trackColor={{ true: colors.primary }} />
          </View>
        </View>

        {/* PRIVACY & DATA */}
        <Text style={[styles.section, rtlText(rtl)]}>{t('dataPrivacy')}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="save-outline" size={19} color={colors.primary} />
            <Text style={[styles.rowLabel, rtlText(rtl)]}>{t('saveHistory')}</Text>
            <Switch value={st.saveHistory} onValueChange={v => update({ saveHistory: v })} trackColor={{ true: colors.primary }} />
          </View>
          <View style={styles.row}>
            <Ionicons name="analytics-outline" size={19} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, rtlText(rtl)]}>{t('helpImprove')}</Text>
              <Text style={[styles.rowSub, rtlText(rtl)]}>{t('helpImproveSub')}</Text>
            </View>
            <Switch value={st.improveModel} onValueChange={v => update({ improveModel: v })} trackColor={{ true: colors.primary }} />
          </View>
          <Pressable style={styles.row} onPress={purge}>
            <Ionicons name="trash-outline" size={19} color={colors.danger} />
            <Text style={[styles.rowLabel, { color: colors.danger }]}>{t('purgeHistory')}</Text>
            <Ionicons name={rtlIcon('chevron-forward', rtl)} size={17} color={colors.muted} />
          </Pressable>
        </View>

        {/* ABOUT & SUPPORT — account, links, legal and version all merged. These
            were four separate sections of 1-2 rows each; they're all "reference". */}
        <Text style={[styles.section, rtlText(rtl)]}>{t('aboutSupport')}</Text>
        <View style={styles.card}>
          <Row icon="person" label={t('signedInAs')} value={user?.email || '-'} />
          <Row icon="mail" label={t('sendFeedback')} onPress={() => open('mailto:feedback@ozira.ai?subject=OZIRA%20App%20Feedback')} />
          <Row icon="globe" label={t('website')} onPress={() => open(config.API_BASE)} />
          <Row icon="document-text" label={t('terms2')} onPress={() => open(config.API_BASE + '/terms.html')} />
          <Row icon="shield-checkmark" label={t('privacy')} onPress={() => open(config.API_BASE + '/privacy.html')} />
          <Row icon="pricetag" label={t('version')} value="1.0.0" />
        </View>

        <Text style={[styles.section, rtlText(rtl)]}>{t('dangerZone')}</Text>
        <View style={styles.card}>
          {/* Log out moved in here from a floating button below — same idea, one place. */}
          <Pressable style={styles.row} onPress={signOut}>
            <Ionicons name="log-out-outline" size={19} color={colors.muted} />
            <Text style={[styles.rowLabel, rtlText(rtl)]}>{t('logOut')}</Text>
            <Ionicons name={rtlIcon('chevron-forward', rtl)} size={17} color={colors.muted} />
          </Pressable>
          <Pressable style={styles.row} onPress={deleteAccount}>
            <Ionicons name="trash-outline" size={19} color={colors.danger} />
            <Text style={[styles.rowLabel, { color: colors.danger }]}>{t('deleteAccount')}</Text>
            <Ionicons name={rtlIcon('chevron-forward', rtl)} size={17} color={colors.muted} />
          </Pressable>
        </View>

        <Text style={[styles.note, rtlText(rtl)]}>{t('disclaimer')}</Text>
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
  settingsHero: { backgroundColor: '#250914', borderRadius: radius.lg, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: colors.primary + '66' },
  settingsHeroArt: { opacity: 0.88 },
  settingsHeroInner: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 15, backgroundColor: 'rgba(26,4,15,0.22)' },
  settingsHeroTitle: { color: colors.white, fontFamily: fonts.semibold, fontSize: 17 },
  settingsHeroSub: { color: 'rgba(255,255,255,0.78)', fontFamily: fonts.regular, fontSize: 12.5, marginTop: 1 },
  section: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 8 },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: 14, marginBottom: 16,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 56,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.cardAlt, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: radius.md },
  rowLabel: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, flex: 1 },
  rowValue: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, maxWidth: 170 },
  rowSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, marginTop: 2 },
  langWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  langPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  langOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  langFlag: { fontSize: 13 },
  langTxt: { color: colors.text, fontFamily: fonts.medium, fontSize: 12 },
  voiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  voicePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  voiceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  voiceTxt: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, paddingVertical: 12, marginTop: 4,
  },
  logoutTxt: { color: colors.danger, fontFamily: fonts.semibold, fontSize: 14 },
  note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11.5, textAlign: 'center', marginTop: 18, lineHeight: 16 },
});
