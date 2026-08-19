import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { clientPrincipalFromWhoami, deriveOrganizationContext, AppError } from 'ozira-app-core';
import { fonts, radius } from '../theme';
import { useColors } from '../context/ThemeContext';
import FlagMenu from '../components/FlagMenu';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { intelligenceClient, setIntelligenceToken } from '../intelligenceClient';

// Proves the shared app-core foundation end to end from mobile: real
// Supabase session -> the SAME generic API client used by apps/web ->
// ozira-ai's whoami/signals routes -> the SAME organization-context state
// machine. Read-only, matching the "one safe backend capability" scope
// (spec section 23) -- no writes are exposed here.
export default function IntelligenceScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAuth();
  const { openSidebar } = useUI();
  const [organization, setOrganization] = useState(() => deriveOrganizationContext({ sessionStatus: 'loading', principal: null }));
  const [signals, setSignals] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIntelligenceToken(token);
    if (!token) {
      setOrganization(deriveOrganizationContext({ sessionStatus: 'ready', principal: null }));
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const who = await intelligenceClient.call('/api/intelligence/whoami');
        if (cancelled) return;
        const principal = clientPrincipalFromWhoami(who.data);
        setOrganization(deriveOrganizationContext({ sessionStatus: 'ready', principal }));
        const list = await intelligenceClient.call('/api/intelligence/signals');
        if (!cancelled) setSignals(list.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof AppError ? err : new AppError('UNKNOWN'));
          setOrganization(deriveOrganizationContext({ sessionStatus: 'error', principal: null }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <FlagMenu onPress={openSidebar} size={24} />
        <Text style={styles.title}>Intelligence</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Scope</Text>
            <View style={styles.scopeRow}>
              <Ionicons
                name={organization.state === 'ORGANIZATION' ? 'people' : 'person'}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.scopeText}>
                {organization.state === 'ORGANIZATION' ? `Organization: ${organization.tenantId}` : organization.state === 'PERSONAL' ? 'Personal' : organization.state}
              </Text>
            </View>
          </View>

          <Text style={styles.section}>Recent signals</Text>
          <View style={styles.card}>
            {error ? <Text style={styles.error}>{error.message || 'Could not load signals.'}</Text> : null}
            {!error && signals && signals.count === 0 ? <Text style={styles.dim}>No signals yet.</Text> : null}
            {!error && signals && signals.count > 0 ? signals.signals.map((s) => (
              <View key={s.id} style={styles.signalRow}>
                <Text style={styles.signalTitle} numberOfLines={1}>{s.title || s.signal_type}</Text>
                <Text style={styles.signalStatus}>{s.status}</Text>
              </View>
            )) : null}
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
  sectionLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, marginBottom: 16 },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scopeText: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  signalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  signalTitle: { color: colors.text, fontFamily: fonts.regular, fontSize: 13.5, flex: 1, marginRight: 8 },
  signalStatus: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  dim: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
});
