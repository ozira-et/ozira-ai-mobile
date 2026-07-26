import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Linking, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import FlagMenu from '../components/FlagMenu';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { api } from '../api';

function mb(bytes) { return (bytes / (1024 * 1024)); }

export default function UsageScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAuth();
  const { openSidebar } = useUI();
  const [usage, setUsage] = useState(null);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try { const [u, s] = await Promise.all([api.usage(token), api.storage(token)]); setUsage(u); setStorage(s); } catch (_) {}
    setLoading(false);
  })(); }, []);

  function Bar({ label, used, cap, unit }) {
    const has = cap > 0;
    const pct = has ? Math.min(100, Math.round((used / cap) * 100)) : 0;
    const over = has && used >= cap;
    return (
      <View style={styles.barBlock}>
        <View style={styles.barTop}>
          <Text style={styles.barLabel}>{label}</Text>
          <Text style={[styles.barVal, over && { color: colors.danger }]}>
            {Math.round(used).toLocaleString()}{has ? ' / ' + cap.toLocaleString() : ''} {unit}
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: (has ? pct : 6) + '%', backgroundColor: over ? colors.danger : colors.primary }]} />
        </View>
        {!has ? <Text style={styles.unlimited}>Unlimited</Text> : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={24} />
        <Text style={styles.title}>Usage & Storage</Text>
        <Pressable onPress={() => Linking.openURL('https://support.ozira.ai').catch(() => {})} hitSlop={10}>
          <Ionicons name="help-circle-outline" size={24} color={colors.muted} />
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
          <Text style={styles.section}>Engine usage</Text>
          <View style={styles.card}>
            {usage ? (
              <>
                <Bar label="Today (24h)" used={usage.daily?.used || 0} cap={usage.daily?.cap || 0} unit="credits" />
                <Bar label="This week (7 days)" used={usage.weekly?.used || 0} cap={usage.weekly?.cap || 0} unit="credits" />
                {usage.monthly ? <Bar label="This month" used={usage.monthly.used || 0} cap={usage.monthly.quota || 0} unit="credits" /> : null}
              </>
            ) : <Text style={styles.dim}>Usage data isn't available yet. Deploy the usage endpoint to enable this.</Text>}
          </View>

          <Text style={styles.section}>Storage</Text>
          <View style={styles.card}>
            {storage ? (
              <>
                <Bar label="Total" used={mb(storage.totalBytes || 0)} cap={mb(storage.capBytes || 0)} unit="MB" />
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.primary }]} /><Text style={styles.legendTxt}>Images {mb(storage.imageBytes || 0).toFixed(1)} MB</Text></View>
                  <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.accent }]} /><Text style={styles.legendTxt}>Files {mb(storage.fileBytes || 0).toFixed(1)} MB</Text></View>
                </View>
              </>
            ) : <Text style={styles.dim}>Storage data isn't available yet.</Text>}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  section: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, marginTop: 8, marginBottom: 10 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, marginBottom: 16 },
  barBlock: { marginBottom: 16 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  barLabel: { color: colors.text, fontFamily: fonts.medium, fontSize: 13.5 },
  barVal: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5 },
  track: { height: 9, borderRadius: 5, backgroundColor: colors.card, overflow: 'hidden' },
  fill: { height: 9, borderRadius: 5 },
  unlimited: { color: colors.success, fontFamily: fonts.medium, fontSize: 11, marginTop: 4 },
  legendRow: { flexDirection: 'row', gap: 18, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendTxt: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5 },
  dim: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
});
