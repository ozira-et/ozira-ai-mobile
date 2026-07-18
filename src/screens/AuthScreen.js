import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../theme';
import Button from '../components/Button';
import Input from '../components/Input';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(''); setBusy(true);
    try {
      if (mode === 'register') await signUp(name.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}><Ionicons name="sparkles" size={34} color={colors.white} /></View>
        <Text style={styles.brand}>OZIRA <Text style={{ color: colors.primary }}>AI</Text></Text>
        <Text style={styles.tag}>Your AI Assistant & All-in-One Tools</Text>

        {err ? <View style={styles.err}><Text style={styles.errTxt}>{err}</Text></View> : null}

        {mode === 'register' && (
          <Input icon="person-outline" placeholder="Full name" value={name} onChangeText={setName} autoCapitalize="words" style={{ marginBottom: spacing.md }} />
        )}
        <Input icon="mail-outline" placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" style={{ marginBottom: spacing.md }} />
        <Input icon="lock-closed-outline" placeholder="Password" secure value={password} onChangeText={setPassword} style={{ marginBottom: spacing.lg }} />

        <Button title={mode === 'register' ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} />

        <Pressable onPress={() => { setErr(''); setMode(m => (m === 'login' ? 'register' : 'login')); }} style={{ marginTop: 18 }}>
          <Text style={styles.switch}>
            {mode === 'login' ? 'New to OZIRA AI? ' : 'Already have an account? '}
            <Text style={{ color: colors.primary, fontFamily: fonts.semibold }}>{mode === 'login' ? 'Create one' : 'Sign in'}</Text>
          </Text>
        </Pressable>

        <Text style={styles.terms}>By continuing you agree to our Terms of Service and Privacy Policy.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 24 },
  logo: { alignSelf: 'center', width: 76, height: 76, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  brand: { textAlign: 'center', color: colors.text, fontFamily: fonts.bold, fontSize: 30 },
  tag: { textAlign: 'center', color: colors.muted, fontFamily: fonts.regular, fontSize: 13.5, marginTop: 6, marginBottom: 26 },
  err: { backgroundColor: 'rgba(229,72,77,0.12)', borderColor: 'rgba(229,72,77,0.4)', borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 14 },
  errTxt: { color: '#ff9aa0', fontFamily: fonts.regular, fontSize: 13 },
  switch: { textAlign: 'center', color: colors.muted, fontFamily: fonts.regular, fontSize: 14 },
  terms: { textAlign: 'center', color: colors.muted, fontFamily: fonts.regular, fontSize: 11.5, marginTop: 24, lineHeight: 17 },
});
