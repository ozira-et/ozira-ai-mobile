// Branded launch screen: the OZIRA logo animates in a white disc on brand red,
// shown for ~2s while the app boots. Calls onDone when its exit finishes.
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { fonts } from '../theme';
import Logo from './Logo';

const RED = '#B3121B';
const FLAG = { green: '#078930', yellow: '#FCDD09', red: '#DA121A' };

export default function Splash({ onDone }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 60 }),
      Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true })),
    ]).start();

    const t = setTimeout(() => {
      Animated.timing(fadeOut, { toValue: 0, duration: 350, useNativeDriver: true })
        .start(() => onDone && onDone());
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  const spin = ring.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={[styles.root, { opacity: fadeOut }]}>
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
        <View style={styles.disc}>
          <Animated.View style={[styles.ring, { transform: [{ rotate: spin }] }]} />
          <Logo size={82} />
        </View>
        <Text style={styles.brand}>OZIRA AI</Text>
        <View style={styles.dots}>
          <View style={[styles.dot, { backgroundColor: FLAG.green }]} />
          <View style={[styles.dot, { backgroundColor: FLAG.yellow }]} />
          <View style={[styles.dot, { backgroundColor: FLAG.red }]} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: RED, alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  disc: { width: 132, height: 132, borderRadius: 66, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 3, borderColor: 'rgba(255,255,255,0.55)', borderTopColor: 'transparent', borderRightColor: 'transparent' },
  brand: { color: '#FFFFFF', fontFamily: fonts.bold, fontSize: 26, letterSpacing: 1, marginTop: 20 },
  dots: { flexDirection: 'row', gap: 8, marginTop: 14 },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
