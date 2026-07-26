import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import FlagMenu from '../components/FlagMenu';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { api } from '../api';

export default function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = makeStyles(colors);
  const { token, user, refresh } = useAuth();
  const { openSidebar } = useUI();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function verify() {
    if (busy) return;
    if (!/^\d{6}$/.test(code)) return Alert.alert('Enter code', 'Type the 6-digit code from your email.');
    setBusy(true);
    try {
      const d = await api.verifyEmail(code, token);
      if (d.verified) { setDone(true); if (refresh) await refresh(); Alert.alert('Verified', 'Your email is verified. Paid plans are unlocked.'); }
    } catch (e) { Alert.alert('Could not verify', e.message); }
    setBusy(false);
  }
  async function resend() {
    setBusy(true);
    try {
      const d = await api.resendVerification(token);
      Alert.alert('Sent', d.demoCode ? ('Demo code: ' + d.demoCode) : 'A new code was sent to your email.');
    } catch (e) { Alert.alert('Error', e.message); }
    setBusy(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={24} />
        <Text style={styles.title}>Verify email</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        {done ? (
          <View style={styles.doneBox}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            <Text style={styles.doneTxt}>Email verified</Text>
            <Text style={styles.doneSub}>Paid plans and full features are unlocked.</Text>
          </View>
        ) : (
          <>
            <View style={styles.iconWrap}><Ionicons name="mail-open-outline" size={40} color={colors.primary} /></View>
            <Text style={styles.lead}>Verify your email</Text>
            <Text style={styles.intro}>We sent a 6-digit code to {user?.email || 'your email'}. Enter it below to unlock paid plans.</Text>

            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={t => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="______"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Pressable style={styles.btn} onPress={verify} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.btnTxt}>Verify</Text>}
            </Pressable>
            <Pressable style={styles.resend} onPress={resend} disabled={busy}>
              <Text style={styles.resendTxt}>Resend code</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  iconWrap: { alignItems: 'center', marginTop: 20, marginBottom: 14 },
  lead: { color: colors.text, fontFamily: fonts.bold, fontSize: 20, textAlign: 'center' },
  intro: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 8, marginBottom: 22, paddingHorizontal: 10 },
  codeInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, height: 60, textAlign: 'center', color: colors.text, fontFamily: fonts.bold, fontSize: 28, letterSpacing: 10, marginBottom: 14 },
  btn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  btnTxt: { color: colors.white, fontFamily: fonts.semibold, fontSize: 15 },
  resend: { alignItems: 'center', paddingVertical: 14 },
  resendTxt: { color: colors.primary, fontFamily: fonts.medium, fontSize: 14 },
  doneBox: { alignItems: 'center', marginTop: 60, gap: 10 },
  doneTxt: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  doneSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center' },
});
