import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image, Switch, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import FlagMenu from '../components/FlagMenu';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { getProfile, setProfile } from '../localStore';
import { zodiacFor, isValidBirthday } from '../zodiac';

const INTERESTS = ['Business', 'Technology', 'Travel', 'Sports', 'Health', 'Education', 'Entertainment', 'News', 'Faith', 'Cooking', 'Fashion', 'Finance'];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useLang();
  const { user } = useAuth();
  const { openSidebar } = useUI();

  const [avatar, setAvatar] = useState(null);
  const [birthday, setBirthday] = useState('');
  const [showZodiac, setShowZodiac] = useState(true);
  const [city, setCity] = useState('');
  const [gender, setGender] = useState('');
  const [interests, setInterests] = useState([]);
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => {
    const p = await getProfile();
    setAvatar(p.avatar || null);
    setBirthday(p.birthday || '');
    setShowZodiac(p.showZodiac !== false);
    setCity(p.city || '');
    setGender(p.gender || '');
    setInterests(p.interests || []);
    setInstructions(p.customInstructions || '');
  })(); }, []);

  const zodiac = zodiacFor(birthday);

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access to set an avatar.');
    const r = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.4, allowsEditing: true, aspect: [1, 1] });
    if (r.canceled || !r.assets || !r.assets.length) return;
    const a = r.assets[0];
    setAvatar('data:' + (a.mimeType || 'image/jpeg') + ';base64,' + a.base64);
  }

  function toggleInterest(it) {
    setInterests(prev => prev.includes(it) ? prev.filter(x => x !== it) : [...prev, it]);
  }

  async function save() {
    if (birthday && !isValidBirthday(birthday)) return Alert.alert('Check the date', 'Use the format YYYY-MM-DD, e.g. 1996-06-14.');
    setSaving(true);
    await setProfile({ avatar, birthday, showZodiac, city, gender, interests, customInstructions: instructions });
    setSaving(false);
    Alert.alert('Saved', 'Your profile is updated.');
  }

  const initial = (user?.name || user?.email || 'O').trim().charAt(0).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={24} />
        <Text style={styles.title}>Profile</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarWrap}>
          <Pressable onPress={pickAvatar}>
            {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={styles.avatar}><Text style={styles.avatarTxt}>{initial}</Text></View>}
            <View style={styles.camBadge}><Ionicons name="camera" size={15} color={colors.white} /></View>
          </Pressable>
          <Text style={styles.name}>{user?.name || 'OZIRA user'}</Text>
          {showZodiac && zodiac ? <Text style={styles.sign}>{zodiac.emoji} {zodiac.name}</Text> : <Text style={styles.email}>{user?.email || ''}</Text>}
        </View>

        <Text style={styles.section}>Birthday</Text>
        <View style={styles.card}>
          <TextInput style={styles.input} value={birthday} onChangeText={setBirthday} placeholder="YYYY-MM-DD (e.g. 1996-06-14)" placeholderTextColor={colors.muted} keyboardType="numbers-and-punctuation" />
          {zodiac ? <Text style={styles.zodiacLine}>Your sign: {zodiac.emoji} {zodiac.name}</Text> : null}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Show my sign under my name</Text>
            <Switch value={showZodiac} onValueChange={setShowZodiac} trackColor={{ true: colors.primary }} />
          </View>
          <Text style={styles.hint}>Optional. We'll add a birthday greeting and a daily horoscope if you turn this on.</Text>
        </View>

        <Text style={styles.section}>About you</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>City</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Addis Ababa" placeholderTextColor={colors.muted} />
          {/* Language lives in Settings only — this screen used to have its own
              English/Amharic picker, which fought with the real 8-language setting. */}
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>{t('gender')}</Text>
          <View style={styles.langRow}>
            {[
              { v: 'female', icon: 'woman', label: t('female') },
              { v: 'male', icon: 'man', label: t('male') },
              { v: '', icon: 'person', label: t('skip') },
            ].map(g => (
              <Pressable key={g.v || 'na'} onPress={() => setGender(g.v)} style={[styles.langPill, gender === g.v && styles.langOn]}>
                <Ionicons name={g.icon} size={14} color={gender === g.v ? colors.white : colors.muted} />
                <Text style={[styles.langTxt, gender === g.v && { color: colors.white }]}>{g.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.section}>Interests</Text>
        <View style={styles.chips}>
          {INTERESTS.map(it => (
            <Pressable key={it} onPress={() => toggleInterest(it)} style={[styles.chip, interests.includes(it) && styles.chipOn]}>
              <Text style={[styles.chipTxt, interests.includes(it) && { color: colors.white }]}>{it}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Custom instructions</Text>
        <View style={styles.card}>
          <TextInput style={[styles.input, { height: 96, textAlignVertical: 'top', paddingTop: 12 }]} value={instructions} onChangeText={setInstructions} placeholder="Tell the AI how to respond — your job, tone, language preference, anything it should always remember." placeholderTextColor={colors.muted} multiline />
          <Text style={styles.hint}>The AI keeps these in mind on every chat.</Text>
        </View>

        <Pressable style={styles.saveBtn} onPress={save} disabled={saving}>
          <Text style={styles.saveTxt}>{saving ? 'Saving…' : 'Save profile'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  avatarWrap: { alignItems: 'center', marginVertical: 14 },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: colors.white, fontFamily: fonts.bold, fontSize: 38 },
  camBadge: { position: 'absolute', right: 0, bottom: 26, backgroundColor: colors.accent, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 19, marginTop: 10 },
  sign: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 14, marginTop: 2 },
  email: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  section: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, marginTop: 12, marginBottom: 10 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14 },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 46, color: colors.text, fontFamily: fonts.regular, fontSize: 14.5 },
  zodiacLine: { color: colors.primary, fontFamily: fonts.medium, fontSize: 13.5, marginTop: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  switchLabel: { color: colors.text, fontFamily: fonts.regular, fontSize: 14, flex: 1 },
  hint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11.5, marginTop: 8, lineHeight: 16 },
  fieldLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12.5, marginBottom: 6 },
  langRow: { flexDirection: 'row', gap: 8 },
  langPill: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  langOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  langTxt: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTxt: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveTxt: { color: colors.white, fontFamily: fonts.semibold, fontSize: 15 },
});
