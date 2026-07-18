import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { useAuth } from '../context/AuthContext';

const ITEMS = [
  { label: 'Chat Home', icon: 'chatbubble-ellipses', route: 'Chat' },
  { label: 'Travel Planner', icon: 'airplane', route: 'Travel' },
  { label: 'AI Tools', icon: 'grid', route: 'Tools' },
  { label: 'Plans & Pricing', icon: 'pricetag', route: 'Plans' },
  { label: 'API & Developer', icon: 'code-slash', route: 'Developer' },
  { label: 'Account', icon: 'person', route: 'Account' },
  { label: 'Settings', icon: 'settings', route: 'Settings' },
];

export default function DrawerContent({ navigation, state }) {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const activeRoute = state?.routeNames?.[state.index];

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
      {/* profile header */}
      <View style={styles.profile}>
        <View style={styles.avatar}><Text style={styles.avatarTxt}>{(user?.name || 'U').slice(0, 1).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{user?.name || 'Guest'}</Text>
          <Text style={styles.plan}>Free Plan</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 10 }}>
        {ITEMS.map((it) => {
          const active = activeRoute === it.route;
          return (
            <Pressable key={it.route} onPress={() => navigation.navigate(it.route)} style={[styles.item, active && styles.itemActive]}>
              <Ionicons name={it.icon} size={20} color={active ? colors.white : colors.muted} />
              <Text style={[styles.itemTxt, active && { color: colors.white }]}>{it.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* upgrade card */}
      <View style={styles.upgrade}>
        <Text style={styles.upgradeTitle}>⭐ Upgrade to Premium</Text>
        <Text style={styles.upgradeSub}>Unlock all features & tools</Text>
        <Pressable style={styles.upgradeBtn} onPress={() => navigation.navigate('Plans')}>
          <Text style={styles.upgradeBtnTxt}>Upgrade Now</Text>
        </Pressable>
      </View>

      <Pressable style={[styles.item, { marginBottom: insets.bottom + 6 }]} onPress={signOut}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={[styles.itemTxt, { color: colors.danger }]}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 14 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 6 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: colors.white, fontFamily: fonts.bold, fontSize: 18 },
  name: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15.5 },
  plan: { color: colors.gold, fontFamily: fonts.medium, fontSize: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 12, borderRadius: radius.md },
  itemActive: { backgroundColor: colors.primary },
  itemTxt: { color: colors.muted, fontFamily: fonts.medium, fontSize: 15 },
  upgrade: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginVertical: 10, borderWidth: 1, borderColor: colors.border },
  upgradeTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  upgradeSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2, marginBottom: 10 },
  upgradeBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  upgradeBtnTxt: { color: colors.white, fontFamily: fonts.semibold, fontSize: 13.5 },
});
