import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import FlagMenu from '../components/FlagMenu';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { api } from '../api';

export default function TeamScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = makeStyles(colors);
  const { token } = useAuth();
  const { openSidebar } = useUI();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try { const d = await api.team(token); setTeam(d.team); } catch (_) {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try { await api.teamCreate(name.trim(), token); setName(''); await load(); }
    catch (e) { Alert.alert('Error', e.message); }
    setBusy(false);
  }
  async function join() {
    if (!code.trim() || busy) return;
    setBusy(true);
    try { const d = await api.teamJoin(code.trim(), token); setCode(''); Alert.alert('Joined', 'You joined ' + (d.name || 'the team') + '.'); await load(); }
    catch (e) { Alert.alert('Error', e.message); }
    setBusy(false);
  }
  function leave() {
    Alert.alert('Leave team', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => { try { await api.teamLeave(token); await load(); } catch (e) { Alert.alert('Error', e.message); } } },
    ]);
  }
  async function remove(email) {
    try { await api.teamRemove(email, token); await load(); } catch (e) { Alert.alert('Error', e.message); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={24} />
        <Text style={styles.title}>Team</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
          {!team ? (
            <>
              <Text style={styles.intro}>Share one subscription with your team. Create a team or join with an invite code.</Text>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Create a team</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Team name" placeholderTextColor={colors.muted} />
                <Pressable style={styles.btn} onPress={create} disabled={busy}>
                  {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.btnTxt}>Create team</Text>}
                </Pressable>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Join a team</Text>
                <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="Invite code (OZ-XXXXXX)" placeholderTextColor={colors.muted} autoCapitalize="characters" />
                <Pressable style={[styles.btn, styles.btnAlt]} onPress={join} disabled={busy}>
                  <Text style={styles.btnTxt}>Join team</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.teamName}>{team.name}</Text>
                <Text style={styles.role}>You are {team.role === 'owner' ? 'the owner' : 'a member'}</Text>
                {team.role === 'owner' && team.inviteCode ? (
                  <Pressable style={styles.codePill} onPress={() => { Clipboard.setStringAsync(team.inviteCode); Alert.alert('Copied', 'Invite code copied.'); }}>
                    <Text style={styles.codeTxt}>{team.inviteCode}</Text>
                    <Ionicons name="copy-outline" size={15} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.section}>Members ({team.members.length})</Text>
              {team.members.map(m => (
                <View key={m.email} style={styles.member}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{m.name} {m.role === 'owner' ? '· owner' : ''}</Text>
                    <Text style={styles.memberEmail}>{m.email}</Text>
                  </View>
                  {team.role === 'owner' && m.role !== 'owner' ? (
                    <Pressable onPress={() => remove(m.email)} hitSlop={8}><Ionicons name="close-circle" size={20} color={colors.danger} /></Pressable>
                  ) : null}
                </View>
              ))}
              <Pressable style={styles.leave} onPress={leave}>
                <Ionicons name="exit-outline" size={18} color={colors.danger} />
                <Text style={styles.leaveTxt}>{team.role === 'owner' ? 'Dissolve team' : 'Leave team'}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  intro: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, marginBottom: 14 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, marginBottom: 14 },
  cardTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, marginBottom: 10 },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 46, color: colors.text, fontFamily: fonts.regular, fontSize: 14.5, marginBottom: 10 },
  btn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  btnAlt: { backgroundColor: colors.accent },
  btnTxt: { color: colors.white, fontFamily: fonts.semibold, fontSize: 14 },
  teamName: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  role: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  codePill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
  codeTxt: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14, letterSpacing: 1 },
  section: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, marginBottom: 10, marginTop: 4 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 13, marginBottom: 8 },
  memberName: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  memberEmail: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  leave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, paddingVertical: 12, marginTop: 10 },
  leaveTxt: { color: colors.danger, fontFamily: fonts.semibold, fontSize: 14 },
});
