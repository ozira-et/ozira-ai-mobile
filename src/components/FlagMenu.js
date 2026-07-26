import React from 'react';
import { Pressable, View } from 'react-native';

// Menu (hamburger) button in the Ethiopian flag colours: green / yellow / red.
const FLAG = { green: '#078930', yellow: '#FCDD09', red: '#DA121A' };

export default function FlagMenu({ onPress, size = 24 }) {
  const barH = Math.max(2.5, size / 8);
  const bar = (color) => ({ width: size, height: barH, borderRadius: barH, backgroundColor: color });
  return (
    <Pressable onPress={onPress} hitSlop={12} style={{ justifyContent: 'center', gap: barH * 1.5 }}>
      <View style={bar(FLAG.green)} />
      <View style={bar(FLAG.yellow)} />
      <View style={bar(FLAG.red)} />
    </Pressable>
  );
}
