import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getProfile } from '../localStore';
import { zodiacFor } from '../zodiac';
import { useLang } from '../context/LanguageContext';
import { rtlText, rtlRow, rtlIcon } from '../i18n';

// Grouped the same way as the web app's menu and this app's settings: a label
// owns the block under it, so eleven destinations read as three short lists.
const GROUPS = [
  { title: 'menuWorkspace', items: [
    { key: 'mTools', icon: 'grid', color: colors.primary, route: 'Tools' },
    { key: 'mLibrary', icon: 'images', color: colors.secondary, route: 'Library' },
  ] },
  { title: 'menuTools', items: [
    { key: 'mSchedules', icon: 'alarm', color: colors.primary, route: 'Schedules' },
    { key: 'mConnectors', icon: 'git-network', color: colors.accent, route: 'Connectors' },
    { key: 'mImport', icon: 'download', color: colors.secondary, route: 'Import' },
    { key: 'mDev', icon: 'code-slash', color: colors.success, route: 'Developer' },
  ] },
  { title: 'menuAccount', items: [
    { key: 'mPlans', icon: 'pricetag', color: colors.gold, route: 'Plans' },
    { key: 'mUsage', icon: 'speedometer', color: colors.success, route: 'Usage' },
    { key: 'mTeam', icon: 'people', color: colors.accent, route: 'Team' },
    { key: 'mAccount', icon: 'person', color: colors.muted, route: 'Account' },
    { key: 'mSettings', icon: 'settings', color: colors.muted, route: 'Settings' },
  ] },
];

export default function MenuScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user } = useAuth();
  const { t, rtl } = useLang();
  const [profile, setProfileState] = useState({});
  useFocusEffect(useCallback(() => { (async () => setProfileState(await getProfile()))(); }, []));
  const zodiac = zodiacFor(profile.birthday);
  const initial = (user?.name || user?.email || 'O').trim().charAt(0).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name={rtlIcon('chevron-back', rtl)} size={26} color={colors.text} /></Pressable>
        <Text style={styles.title}>{t('menu')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
        <Pressable style={styles.profile} onPress={() => navigation.navigate('Profile')}>
          {profile.avatar ? <Image source={{ uri: profile.avatar }} style={styles.avatar} /> : <View style={styles.avatar}><Text style={styles.avatarTxt}>{initial}</Text></View>}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{user?.name || 'OZIRA user'}</Text>
            {profile.showZodiac !== false && zodiac ? <Text style={styles.sign}>{zodiac.emoji} {zodiac.name}</Text> : <Text style={styles.email} numberOfLines={1}>{user?.email || ''}</Text>}
          </View>
          <Ionicons name="create-outline" size={18} color={colors.muted} />
        </Pressable>

        {GROUPS.map(g => (
          <View key={g.title}>
            <Text style={[styles.group, rtlText(rtl)]}>{t(g.title)}</Text>
            {g.items.map(it => (
              <Pressable key={it.route} style={[styles.row, rtlRow(rtl)]} onPress={() => navigation.navigate(it.route)}>
                <View style={[styles.icon, { backgroundColor: it.color + '22' }]}><Ionicons name={it.icon} size={19} color={it.color} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, rtlText(rtl)]}>{t(it.key)}</Text>
                  <Text style={[styles.rowSub, rtlText(rtl)]}>{t(it.key + 'Sub')}</Text>
                </View>
                <Ionicons name={rtlIcon('chevron-forward', rtl)} size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, marginBottom: 16 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: colors.white, fontFamily: fonts.bold, fontSize: 22 },
  name: { color: colors.text, fontFamily: fonts.semibold, fontSize: 16 },
  email: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  sign: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 13, marginTop: 2 },
  // Matches the section label in SettingsScreen so both screens group alike.
  group: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 13, marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14.5 },
  rowSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
});
