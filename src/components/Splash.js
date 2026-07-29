// Exactly two seconds of OZIRA's African-heritage journey. The five local
// keyframes share one Africa silhouette, so short cross-fades read as a single
// continuous material transformation instead of a slideshow.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Asset } from 'expo-asset';
import { LinearGradient } from 'expo-linear-gradient';
import Logo from './Logo';

const BG = '#0B0B12';
const PRIMARY = '#E11D48';
const ACCENT = '#7C3AED';

const FRAMES = [
  require('../../assets/splash-journey/01-giza.jpg'),
  require('../../assets/splash-journey/02-djenne.jpg'),
  require('../../assets/splash-journey/03-lalibela.jpg'),
  require('../../assets/splash-journey/04-serengeti.jpg'),
  require('../../assets/splash-journey/05-victoria-falls.jpg'),
];

const SCENE_WINDOWS = [
  [0, 200, 380, 460],
  [360, 440, 600, 680],
  [580, 660, 820, 900],
  [800, 880, 1040, 1120],
  [1020, 1100, 1300, 1510],
];

// Particles converge around the official vector mark. The final logo is never
// generated or approximated: it is the same Logo component used by the app.
const PARTICLES = [
  [-170, -330, -42, -42, 4], [135, -310, -14, -44, 3],
  [-115, -245, 14, -44, 5], [185, -210, 42, -42, 3],
  [-205, -145, -43, -15, 4], [110, -155, -14, -15, 5],
  [-155, -70, 15, -15, 3], [210, -35, 43, -15, 4],
  [-185, 35, -43, 14, 5], [150, 65, -14, 14, 3],
  [-95, 120, 15, 14, 4], [205, 155, 43, 14, 5],
  [-175, 210, -43, 42, 3], [115, 245, -14, 43, 4],
  [-65, 310, 15, 43, 5], [180, 330, 43, 42, 3],
  [-250, -20, -28, -29, 3], [245, 15, 28, -29, 4],
  [-225, 275, -28, 29, 5], [235, -275, 28, 29, 3],
  [-45, -360, 0, -29, 4], [40, 365, 0, 29, 5],
  [-265, -235, -29, 0, 3], [270, 230, 29, 0, 4],
];

export default function Splash({ onDone }) {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  // The source artwork is 9:16, while many modern phones are 9:19.5 or
  // taller. A soft full-bleed copy extends the scene to the physical screen
  // and the sharp copy remains at its native ratio, avoiding both stretching
  // and accidental cropping of the landmarks.
  const screenRatio = height > 0 ? width / height : 9 / 16;
  const needsRatioExtension = screenRatio < 0.54;

  useEffect(() => {
    let active = true;
    let animation;

    // Decode the bundled keyframes first; the measured animation that follows
    // is always exactly 2000ms, independent of device/storage speed.
    Asset.loadAsync(FRAMES)
      .catch(() => undefined)
      .then(() => {
        if (!active) return;
        progress.setValue(0);
        animation = Animated.timing(progress, {
          toValue: 2000,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        });
        animation.start(({ finished }) => {
          if (finished && active && onDone) onDone();
        });
      });

    return () => {
      active = false;
      if (animation) animation.stop();
    };
  }, [onDone, progress]);

  const rootOpacity = progress.interpolate({
    inputRange: [0, 1900, 2000],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });
  const mistOpacity = progress.interpolate({
    inputRange: [1200, 1370, 1580],
    outputRange: [0, 0.58, 0],
    extrapolate: 'clamp',
  });
  const particleOpacity = progress.interpolate({
    inputRange: [1260, 1380, 1780, 1900],
    outputRange: [0, 1, 0.85, 0],
    extrapolate: 'clamp',
  });
  const particleScale = progress.interpolate({
    inputRange: [1300, 1740],
    outputRange: [1.5, 0.65],
    extrapolate: 'clamp',
  });
  const logoOpacity = progress.interpolate({
    inputRange: [1520, 1710, 1900],
    outputRange: [0, 1, 1],
    extrapolate: 'clamp',
  });
  const logoScale = progress.interpolate({
    inputRange: [1480, 1730],
    outputRange: [0.68, 1],
    extrapolate: 'clamp',
  });
  const haloScale = progress.interpolate({
    inputRange: [1450, 1820],
    outputRange: [0.65, 1.35],
    extrapolate: 'clamp',
  });
  const haloOpacity = progress.interpolate({
    inputRange: [1450, 1640, 1870],
    outputRange: [0, 0.45, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.root, { opacity: rootOpacity }]}>
      <Animated.View
        style={StyleSheet.absoluteFillObject}
      >
        {FRAMES.map((source, index) => {
          const [fadeIn, visible, fadeOut, gone] = SCENE_WINDOWS[index];
          const opacity = progress.interpolate({
            inputRange: [fadeIn, visible, fadeOut, gone],
            outputRange: [0, 1, 1, 0],
            extrapolate: 'clamp',
          });
          return (
            <React.Fragment key={index}>
              <Animated.Image
                source={source}
                resizeMode="cover"
                blurRadius={needsRatioExtension ? 18 : 0}
                fadeDuration={0}
                style={[
                  StyleSheet.absoluteFillObject,
                  styles.sceneExtension,
                  { opacity },
                ]}
              />
              <Animated.Image
                source={source}
                resizeMode={needsRatioExtension ? 'contain' : 'cover'}
                fadeDuration={0}
                style={[StyleSheet.absoluteFillObject, { opacity }]}
              />
            </React.Fragment>
          );
        })}
        {needsRatioExtension && <View style={styles.ratioBlend} />}
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: mistOpacity }]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(234,226,255,0.88)', 'rgba(225,29,72,0.18)']}
          locations={[0.18, 0.56, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <View style={StyleSheet.absoluteFillObject}>
        {PARTICLES.map(([startX, startY, endX, endY, size], index) => {
          const translateX = progress.interpolate({
            inputRange: [1300, 1740],
            outputRange: [startX, endX],
            extrapolate: 'clamp',
          });
          const translateY = progress.interpolate({
            inputRange: [1300, 1740],
            outputRange: [startY, endY],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={index}
              style={[
                styles.particle,
                {
                  width: size,
                  height: size,
                  borderRadius: size,
                  backgroundColor: index % 2 ? ACCENT : PRIMARY,
                  opacity: particleOpacity,
                  transform: [{ translateX }, { translateY }, { scale: particleScale }],
                },
              ]}
            />
          );
        })}
      </View>

      <Animated.View
        style={[
          styles.halo,
          { opacity: haloOpacity, transform: [{ scale: haloScale }] },
        ]}
      />
      <Animated.View
        style={[
          styles.logoDisc,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Logo size={86} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },
  sceneExtension: {
    transform: [{ scale: 1.035 }],
  },
  ratioBlend: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,11,18,0.08)',
  },
  particle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  halo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(225,29,72,0.12)',
  },
  logoDisc: {
    width: 124,
    height: 124,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: PRIMARY,
    shadowOpacity: 0.48,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
});
