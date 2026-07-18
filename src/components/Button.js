import React from 'react';
import { Text, Pressable, ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, fonts, radius } from '../theme';

// variant: 'primary' | 'secondary' | 'tertiary'
export default function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style }) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        variant === 'tertiary' && styles.tertiary,
        (disabled || loading) && { opacity: 0.55 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.white : colors.text} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[styles.text, isPrimary ? { color: colors.white } : { color: colors.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tertiary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontFamily: fonts.semibold, fontSize: 15.5 },
});
