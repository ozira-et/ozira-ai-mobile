import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { useLang } from '../context/LanguageContext';
import { rtlText, rtlRow } from '../i18n';

// Shared text field. Mirrors itself for RTL languages (Arabic) so every screen
// using <Input> gets right-to-left behaviour for free.
export default function Input({ icon, secure, value, onChangeText, placeholder, keyboardType, autoCapitalize, style }) {
  const [hidden, setHidden] = useState(!!secure);
  const { rtl } = useLang();
  return (
    <View style={[styles.wrap, rtlRow(rtl), style]}>
      {icon ? <Ionicons name={icon} size={18} color={colors.muted} style={rtl ? { marginLeft: 8 } : { marginRight: 8 }} /> : null}
      <TextInput
        style={[styles.input, rtlText(rtl)]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={hidden}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'none'}
        autoCorrect={false}
      />
      {secure ? (
        <Pressable onPress={() => setHidden(h => !h)} hitSlop={10}>
          <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, height: 52,
  },
  input: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 15 },
});
