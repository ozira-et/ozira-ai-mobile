import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fonts, spacing } from '../theme';
import { setProfile } from '../localStore';
import { useColors } from '../context/ThemeContext';
import Logo from '../components/Logo';
import Button from '../components/Button';
import Input from '../components/Input';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { rtlText } from '../i18n';
import { LANGUAGES } from '../i18n';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = makeStyles(colors);
  const { signIn, signUp, sendResetCode, resetPassword } = useAuth();
  const { lang, setLang, t, rtl } = useLang();
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'reset'
  const [resetStep, setResetStep] = useState('email'); // 'email' | 'code'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [gender, setGender] = useState('');

  async function submit() {
    setErr(''); setMsg(''); setBusy(true);
    try {
      if (mode === 'register') { await signUp(name.trim(), email.trim(), password, lang, gender); await setLang(lang);
        try { await setProfile({ gender }); } catch (_) {} }
      else await signIn(email.trim(), password);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  async function sendCode() {
    setErr(''); setMsg(''); setBusy(true);
    try {
      await sendResetCode(email.trim());
      setResetStep('code');
      setMsg('We sent a 6-digit code to ' + email.trim() + '.');
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  async function doReset() {
    setErr(''); setMsg(''); setBusy(true);
    try {
      await resetPassword(email.trim(), code.trim(), password);
      setMsg('Password updated. You are now signed in.');
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  function goLogin() { setErr(''); setMsg(''); setMode('login'); setResetStep('email'); setCode(''); }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Logo size={88} style={{ alignSelf: 'center', marginBottom: 12 }} />
        <Text style={styles.brand}>OZIRA <Text style={{ color: colors.primary }}>AI</Text></Text>
        <Text style={styles.tag}>{t('tagline')}</Text>

        {/* Language selector — sets the whole app's language, and the one the AI answers in. */}
        <Text style={[styles.langLabel, rtlText(rtl)]}>{t('chooseLanguage')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langRow}>
          {LANGUAGES.map(l => (
            <Pressable key={l.code} onPress={() => setLang(l.code)} style={[styles.langChip, lang === l.code && styles.langChipOn]}>
              <Text style={styles.langFlag}>{l.flag}</Text>
              <Text style={[styles.langTxt, lang === l.code && { color: colors.white }]}>{l.native}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {err ? <View style={styles.err}><Text style={styles.errTxt}>{err}</Text></View> : null}
        {msg ? <View style={styles.ok}><Text style={styles.okTxt}>{msg}</Text></View> : null}

        {mode === 'reset' ? (
          <>
            <Input icon="mail-outline" placeholder={t('email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={{ marginBottom: spacing.md }} editable={resetStep === 'email'} />
            {resetStep === 'code' && (
              <>
                <Input icon="keypad-outline" placeholder={t('code')} value={code} onChangeText={setCode} keyboardType="number-pad" style={{ marginBottom: spacing.md }} />
                <Input icon="lock-closed-outline" placeholder={t('newPassword')} secure value={password} onChangeText={setPassword} style={{ marginBottom: spacing.lg }} />
              </>
            )}
            {resetStep === 'email'
              ? <Button title={t('sendCode')} onPress={sendCode} loading={busy} />
              : <Button title={t('setNewPassword')} onPress={doReset} loading={busy} />}
            <Pressable onPress={goLogin} style={{ marginTop: 18 }}>
              <Text style={styles.switch}>{t('backToSignIn')}<Text style={{ color: colors.primary, fontFamily: fonts.semibold }}>{t('signInLink')}</Text></Text>
            </Pressable>
          </>
        ) : (
          <>
            {mode === 'register' && (
              <>
                <Input icon="person-outline" placeholder={t('fullName')} value={name} onChangeText={setName} autoCapitalize="words" style={{ marginBottom: spacing.md }} />
                {/* Gender — picks the profile icon shown in the sidebar. */}
                <View style={styles.genderRow}>
                  {[
                    { v: 'female', icon: 'woman', label: t('female') },
                    { v: 'male', icon: 'man', label: t('male') },
                    { v: '', icon: 'person', label: t('skip') },
                  ].map(g => (
                    <Pressable key={g.v || 'na'} onPress={() => setGender(g.v)} style={[styles.genderPill, gender === g.v && styles.genderOn]}>
                      <Ionicons name={g.icon} size={15} color={gender === g.v ? colors.white : colors.muted} />
                      <Text style={[styles.genderTxt, gender === g.v && { color: colors.white }]} numberOfLines={1}>{g.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            <Input icon="mail-outline" placeholder={t('email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={{ marginBottom: spacing.md }} />
            <Input icon="lock-closed-outline" placeholder={t('password')} secure value={password} onChangeText={setPassword} style={{ marginBottom: mode === 'login' ? spacing.sm : spacing.lg }} />

            {mode === 'login' && (
              <Pressable onPress={() => { setErr(''); setMsg(''); setMode('reset'); setResetStep('email'); }} style={{ alignSelf: 'flex-end', marginBottom: spacing.md }}>
                <Text style={styles.forgot}>{t('forgot')}</Text>
              </Pressable>
            )}

            <Button title={mode === 'register' ? t('createAccount') : t('signIn')} onPress={submit} loading={busy} />

            <Pressable onPress={() => { setErr(''); setMsg(''); setMode(m => (m === 'login' ? 'register' : 'login')); }} style={{ marginTop: 18 }}>
              <Text style={styles.switch}>
                {mode === 'login' ? t('newToOzira') : t('alreadyHave')}
                <Text style={{ color: colors.primary, fontFamily: fonts.semibold }}>{mode === 'login' ? t('createOne') : t('signIn')}</Text>
              </Text>
            </Pressable>
          </>
        )}

        <Text style={[styles.terms, rtlText(rtl)]}>{t('terms')}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  genderRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  genderPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 6 },
  genderOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderTxt: { color: colors.text, fontFamily: fonts.medium, fontSize: 11.5 },
  wrap: { paddingHorizontal: 24 },
  brand: { textAlign: 'center', color: colors.text, fontFamily: fonts.bold, fontSize: 30 },
  tag: { textAlign: 'center', color: colors.muted, fontFamily: fonts.regular, fontSize: 13.5, marginTop: 6, marginBottom: 18 },
  langLabel: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  langRow: { gap: 8, paddingBottom: 4, marginBottom: 18 },
  langChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  langChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  langFlag: { fontSize: 15 },
  langTxt: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  err: { backgroundColor: 'rgba(229,72,77,0.12)', borderColor: 'rgba(229,72,77,0.4)', borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 14 },
  errTxt: { color: '#ff9aa0', fontFamily: fonts.regular, fontSize: 13 },
  ok: { backgroundColor: 'rgba(7,137,48,0.12)', borderColor: 'rgba(7,137,48,0.4)', borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 14 },
  okTxt: { color: '#5fd08a', fontFamily: fonts.regular, fontSize: 13 },
  forgot: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13 },
  switch: { textAlign: 'center', color: colors.muted, fontFamily: fonts.regular, fontSize: 14 },
  terms: { textAlign: 'center', color: colors.muted, fontFamily: fonts.regular, fontSize: 11.5, marginTop: 24, lineHeight: 17 },
});
