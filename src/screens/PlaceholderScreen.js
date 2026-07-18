import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { useUI } from '../context/UIContext';

// Simple stub for sidebar destinations not built yet (Travel, Tools, Plans, etc.)
export default function PlaceholderScreen({ title, icon }) {
  const insets = useSafeAreaInsets();
  const { openSidebar } = useUI();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={openSidebar} hitSlop={10}><Ionicons name="menu" size={26} color={colors.text} /></Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 26 }} />
      </View>
      <View style={styles.center}>
        <Ionicons name={icon || 'construct'} size={44} color={colors.primary} />
        <Text style={styles.txt}>{title}</Text>
        <Text style={styles.sub}>Coming in the next build.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  txt: { color: colors.text, fontFamily: fonts.semibold, fontSize: 18, marginTop: 6 },
  sub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13.5 },
});
