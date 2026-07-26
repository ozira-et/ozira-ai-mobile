import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import FlagMenu from '../components/FlagMenu';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { api } from '../api';

export default function TravelScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = makeStyles(colors);
  const { token } = useAuth();
  const { openSidebar } = useUI();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const d = await api.travelListings({ ...(q ? { q } : {}), ...(type ? { type } : {}) }, token);
      setListings(d.listings || []);
    } catch (e) { Alert.alert('Error', e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [type]);

  async function askAI() {
    const text = question.trim();
    if (!text || asking) return;
    setAsking(true); setAnswer('');
    try {
      const d = await api.travelCompare(text, listings.map(l => l.id), token);
      setAnswer(d.answer);
    } catch (e) { setAnswer('Error: ' + e.message); }
    setAsking(false);
  }

  function requestBooking(l) {
    Alert.prompt
      ? Alert.prompt('Booking request', 'Dates, guests, questions for ' + l.name + ':', async (msg) => {
          try { await api.travelLead(l.id, msg || '', token); Alert.alert('Sent', 'The partner will contact you by email.'); }
          catch (e) { Alert.alert('Error', e.message); }
        })
      : (async () => {
          try { await api.travelLead(l.id, 'Booking request from the OZIRA app', token); Alert.alert('Sent', 'The partner will contact you by email.'); }
          catch (e) { Alert.alert('Error', e.message); }
        })();
  }

  const TYPES = [ { id: '', label: 'All' }, { id: 'hotel', label: 'Hotels' }, { id: 'tour', label: 'Tours' } ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={24} />
        <Text style={styles.title}>Travel Planner</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={q} onChangeText={setQ}
            placeholder="City, hotel, tour..."
            placeholderTextColor={colors.muted}
            onSubmitEditing={load}
            returnKeyType="search"
          />
        </View>

        <View style={styles.chips}>
          {TYPES.map(t => (
            <Pressable key={t.id} onPress={() => setType(t.id)} style={[styles.chip, type === t.id && styles.chipOn]}>
              <Text style={[styles.chipTxt, type === t.id && { color: colors.white }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.askBox}>
          <TextInput
            style={styles.askInput}
            value={question} onChangeText={setQuestion}
            placeholder="Ask AI: best option for a family weekend?"
            placeholderTextColor={colors.muted}
          />
          <Pressable onPress={askAI} style={styles.askBtn} disabled={asking}>
            {asking ? <ActivityIndicator color={colors.white} size="small" /> : <Ionicons name="sparkles" size={17} color={colors.white} />}
          </Pressable>
        </View>
        {answer ? <View style={styles.answer}><Text style={styles.answerTxt}>{answer}</Text></View> : null}

        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> :
          listings.map(l => (
            <View key={l.id} style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name={l.type === 'hotel' ? 'bed' : 'map'} size={18} color={colors.primary} />
                <Text style={styles.cardTitle} numberOfLines={1}>{l.name}</Text>
              </View>
              <Text style={styles.cardCity}>{l.city}</Text>
              <Text style={styles.cardPrice}>{Number(l.priceETB).toLocaleString()} ETB <Text style={styles.per}>{l.type === 'hotel' ? '/ night' : '/ person'}</Text></Text>
              {l.description ? <Text style={styles.cardDesc} numberOfLines={3}>{l.description}</Text> : null}
              <Pressable style={styles.bookBtn} onPress={() => requestBooking(l)}>
                <Text style={styles.bookTxt}>Request booking</Text>
              </Pressable>
            </View>
          ))}
        {!loading && listings.length === 0 && <Text style={styles.empty}>No listings match. Try a wider search.</Text>}
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
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, height: 46,
  },
  searchInput: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 14.5 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
  askBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingLeft: 12, paddingRight: 6, height: 48,
  },
  askInput: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 13.5 },
  askBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  answer: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: 12, marginTop: 10,
  },
  answerTxt: { color: colors.text, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 14, marginTop: 14,
  },
  cardTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15.5, flex: 1 },
  cardCity: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, marginTop: 2 },
  cardPrice: { color: colors.text, fontFamily: fonts.bold, fontSize: 18, marginTop: 6 },
  per: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  cardDesc: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  bookBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10,
    alignItems: 'center', marginTop: 12,
  },
  bookTxt: { color: colors.white, fontFamily: fonts.semibold, fontSize: 13.5 },
  empty: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13.5, textAlign: 'center', marginTop: 30 },
});
