import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import FlagMenu from '../components/FlagMenu';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { api } from '../api';

export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = makeStyles(colors);
  const { token, refresh } = useAuth();
  const { openSidebar } = useUI();
  const [plans, setPlans] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  useEffect(() => { (async () => {
    try {
      const [p, me] = await Promise.all([api.plans(), api.me(token)]);
      setPlans(p.plans || []);
      setCurrentId(me.subscription?.planId || null);
    } catch (_) {}
    setLoading(false);
  })(); }, []);

  async function choose(plan) {
    if (plan.id === currentId || busy) return;
    setBusy(plan.id);
    try {
      const d = await api.subscribe(plan.id, 'chapa', token);
      if (d.activated) { Alert.alert('Done', 'Plan activated.'); await refresh?.(); setCurrentId(plan.id); }
      else if (d.checkoutUrl) {
        const url = /^https?:/.test(d.checkoutUrl) ? d.checkoutUrl : undefined;
        if (url) await Linking.openURL(url);
        else Alert.alert('Payment', 'Complete the payment on the OZIRA website, then reopen the app.');
      }
    } catch (e) { Alert.alert('Error', e.message); }
    setBusy(null);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={24} />
        <Text style={styles.title}>Plans and Pricing</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
          <Text style={styles.sub}>Pay in Birr with Telebirr, Chapa, CBE Birr or SantimPay. Cancel anytime.</Text>
          {plans.map(p => {
            const current = p.id === currentId;
            const popular = p.id === 'pro';
            return (
              <View key={p.id} style={[styles.card, popular && { borderColor: colors.gold }, current && { borderColor: colors.primary }]}>
                {popular && <View style={styles.tag}><Text style={styles.tagTxt}>POPULAR</Text></View>}
                <Text style={styles.planName}>{p.nameEn}</Text>
                <Text style={styles.price}>
                  {p.priceETB === 0 ? 'Free' : Number(p.priceETB).toLocaleString() + ' ETB'}
                  {p.priceETB > 0 && <Text style={styles.perMo}> / month</Text>}
                </Text>
                <View style={styles.feature}><Ionicons name="checkmark" size={15} color={colors.primary} /><Text style={styles.featureTxt}>{Number(p.creditsPerMonth).toLocaleString()} credits / month</Text></View>
                <View style={styles.feature}><Ionicons name="checkmark" size={15} color={colors.primary} /><Text style={styles.featureTxt}>{p.tier === 'pro' ? 'Top-tier models for the hardest work' : 'Fast everyday models · saves credits'}</Text></View>
                <Pressable
                  style={[styles.btn, current && styles.btnCurrent]}
                  onPress={() => choose(p)}
                  disabled={current || busy === p.id}
                >
                  {busy === p.id
                    ? <ActivityIndicator color={colors.white} size="small" />
                    : <Text style={[styles.btnTxt, current && { color: colors.muted }]}>{current ? 'Current plan' : (p.priceETB === 0 ? 'Start free' : 'Upgrade')}</Text>}
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  sub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', marginBottom: 14, lineHeight: 19 },
  card: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.lg, padding: 18, marginBottom: 14,
  },
  tag: {
    alignSelf: 'flex-start', backgroundColor: colors.gold, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8,
  },
  tagTxt: { color: '#111', fontFamily: fonts.bold, fontSize: 10.5 },
  planName: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  price: { color: colors.text, fontFamily: fonts.bold, fontSize: 26, marginTop: 4, marginBottom: 10 },
  perMo: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginBottom: 6 },
  featureTxt: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, flex: 1, lineHeight: 18 },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12,
    alignItems: 'center', marginTop: 10,
  },
  btnCurrent: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  btnTxt: { color: colors.white, fontFamily: fonts.semibold, fontSize: 14 },
});
