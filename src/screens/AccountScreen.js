import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import FlagMenu from '../components/FlagMenu';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { api } from '../api';

export default function AccountScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, token, signOut } = useAuth();
  const { openSidebar } = useUI();
  const [me, setMe] = useState(null);
  const [tg, setTg] = useState(null);

  useEffect(() => { (async () => {
    try { setMe(await api.me(token)); } catch (_) {}
  })(); }, []);

  async function linkTelegram() {
    try {
      const d = await api.telegramLinkCode(token);
      setTg(d);
    } catch (e) { Alert.alert('Error', e.message); }
  }

  const sub = me?.subscription;
  const pct = sub ? Math.min(100, Math.round((sub.used / sub.quota) * 100)) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={24} />
        <Text style={styles.title}>Account</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
        <View style={styles.profile}>
          <View style={styles.avatar}><Text style={styles.avatarTxt}>{(user?.name || 'U').slice(0, 1).toUpperCase()}</Text></View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.kv}><Text style={styles.k}>Plan</Text><Text style={styles.v}>{sub?.planName || '-'}</Text></View>
          <View style={styles.kv}><Text style={styles.k}>Renews</Text><Text style={styles.v}>{sub ? new Date(sub.expiresAt).toLocaleDateString() : '-'}</Text></View>
          <View style={[styles.kv, { borderBottomWidth: 0 }]}><Text style={styles.k}>Credits used</Text><Text style={styles.v}>{sub ? sub.used + ' / ' + sub.quota : '-'}</Text></View>
          <View style={styles.bar}><View style={[styles.barFill, { width: pct + '%' }]} /></View>
          <Pressable style={styles.upgradeBtn} onPress={() => navigation.navigate('Plans')}>
            <Text style={styles.upgradeTxt}>Upgrade plan</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Telegram bot</Text>
          <Text style={styles.cardSub}>Chat with OZIRA inside Telegram using your subscription.</Text>
          {tg ? (
            <View style={styles.tgBox}>
              <Text style={styles.tgHint}>Send this to the bot{tg.botUsername ? ' @' + tg.botUsername : ''} within 10 minutes:</Text>
              <Text style={styles.tgCode}>/link {tg.code}</Text>
            </View>
          ) : (
            <Pressable style={styles.tgBtn} onPress={linkTelegram}>
              <Ionicons name="paper-plane" size={16} color={colors.text} />
              <Text style={styles.tgBtnTxt}>Get Telegram link code</Text>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.logout} onPress={signOut}>
          <Ionicons name="log-out-outline" size={19} color={colors.danger} />
          <Text style={styles.logoutTxt}>Log out</Text>
        </Pressable>
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
  profile: { alignItems: 'center', marginBottom: 18 },
  avatar: {
    width: 74, height: 74, borderRadius: 37, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  avatarTxt: { color: colors.white, fontFamily: fonts.bold, fontSize: 28 },
  name: { color: colors.text, fontFamily: fonts.semibold, fontSize: 18 },
  email: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 16, marginBottom: 14,
  },
  cardTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  cardSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, marginTop: 4, marginBottom: 10 },
  kv: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  k: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13.5 },
  v: { color: colors.text, fontFamily: fonts.medium, fontSize: 13.5 },
  bar: { height: 8, backgroundColor: colors.bg, borderRadius: 99, overflow: 'hidden', marginTop: 4 },
  barFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 99 },
  upgradeBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 11,
    alignItems: 'center', marginTop: 14,
  },
  upgradeTxt: { color: colors.white, fontFamily: fonts.semibold, fontSize: 13.5 },
  tgBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 11,
  },
  tgBtnTxt: { color: colors.text, fontFamily: fonts.medium, fontSize: 13.5 },
  tgBox: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 12 },
  tgHint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5 },
  tgCode: { color: colors.gold, fontFamily: fonts.bold, fontSize: 20, marginTop: 6 },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, paddingVertical: 12,
  },
  logoutTxt: { color: colors.danger, fontFamily: fonts.semibold, fontSize: 14 },
});
