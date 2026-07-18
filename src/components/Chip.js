import React from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../theme';

export default function Chip({ label, active, onPress, color }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: (color || colors.primary) + '22', borderColor: color || colors.primary }]}>
      <Text style={[styles.text, active && { color: color || colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  text: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12.5 },
});
