// Slide-in sidebar overlay — uses React Native's built-in Animated (no Reanimated).
import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { navigate } from '../navigation/navigationRef';

const WIDTH = Math.min(300, Dimensions.get('window').width * 0.82);

const ITEMS = [
  { label: 'Chat Home', icon: 'chatbubble-ellipses', route: 'ChatHome' },
  { label: 'Travel Planner', icon: 'airplane', route: 'Travel' },
  { label: 'AI Tools', icon: 'grid', route: 'Tools' },
  { label: 'Plans & Pricing', icon: 'pricetag', route: 'Plans' },
  { label: 'API & Developer', icon: 'code-slash', route: 'Developer' },
  { label: 'Account', icon: 'person', route: 'Account' },
  { label: 'Settings', icon: 'settings', route: 'Settings' },
];

export default function Sidebar() {
  const { sidebarOpen, closeSidebar } = useUI();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const tx = useRef(new Animated.Value(-WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(tx, { toValue: sidebarOpen ? 0 : -WIDTH, duration: 220, useNativeDriver: true }),
      Animated.timing(fade, { toValue: sidebarOpen ? 1 : 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [sidebarOpen]);

  function go(route) { navigate(route); closeSidebar(); }

  return (
    <View pointerEvents={sidebarOpen ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={{ flex: 1 }} onPress={closeSidebar} />
      </Animated.View>

      <Animated.View style={[styles.panel, { width: WIDTH, paddingTop: insets.top + 12, transform: [{ translateX: tx }] }]}>
        <View style={styles.profile}>
          <View style={styles.avatar}><Text style={styles.avatarTxt}>{(user?.name || 'U').slice(0, 1).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{user?.name || 'Guest'}</Text>
            <Text style={styles.plan}>Free Plan</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 10 }}>
          {ITEMS.map((it) => (
            <Pressable key={it.route} onPress={() => go(it.route)} style={styles.item}>
              <Ionicons name={it.icon} size={20} color={colors.muted} />
              <Text style={styles.itemTxt}>{it.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.upgrade}>
          <Text style={styles.upgradeTitle}>⭐ Upgrade to Premium</Text>
          <Text style={styles.upgradeSub}>Unlock all features & tools</Text>
          <Pressable style={styles.upgradeBtn} onPress={() => go('Plans')}>
            <Text style={styles.upgradeBtnTxt}>Upgrade Now</Text>
          </Pressable>
        </View>

        <Pressable style={[styles.item, { marginBottom: insets.bottom + 6 }]} onPress={() => { signOut(); closeSidebar(); }}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={[styles.itemTxt, { color: colors.danger }]}>Log Out</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.surface, paddingHorizontal: 14, borderRightWidth: 1, borderRightColor: colors.border },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 6 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: colors.white, fontFamily: fonts.bold, fontSize: 18 },
  name: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15.5 },
  plan: { color: colors.gold, fontFamily: fonts.medium, fontSize: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 12, borderRadius: radius.md },
  itemTxt: { color: colors.muted, fontFamily: fonts.medium, fontSize: 15 },
  upgrade: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginVertical: 10, borderWidth: 1, borderColor: colors.border },
  upgradeTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  upgradeSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2, marginBottom: 10 },
  upgradeBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  upgradeBtnTxt: { color: colors.white, fontFamily: fonts.semibold, fontSize: 13.5 },
});
