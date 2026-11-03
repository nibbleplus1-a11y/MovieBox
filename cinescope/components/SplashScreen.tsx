import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated,
  Dimensions
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { CONFIG } from '../config';
import { RemoteConfigService } from '../services/remoteConfig';

const { width } = Dimensions.get('window');

interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  const logoScale    = useRef(new Animated.Value(0.7)).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const textOpacity  = useRef(new Animated.Value(0)).current;
  const textSlide    = useRef(new Animated.Value(18)).current;
  const barWidth     = useRef(new Animated.Value(0)).current;
  const glowScale    = useRef(new Animated.Value(0.6)).current;
  const glowOpacity  = useRef(new Animated.Value(0)).current;
  const [statusText, setStatusText] = useState('Initializing…');

  useEffect(() => {
    // ── 1. Start server config fetch in the background immediately ──
    const configPromise = RemoteConfigService.init().then(() => {
      setStatusText('Ready');
    }).catch(() => {
      setStatusText('Ready');
    });

    // ── 2. Run all animations in parallel (total ~1.6s) ──
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1, friction: 6, tension: 90, useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1, duration: 350, useNativeDriver: true,
      }),
      Animated.spring(glowScale, {
        toValue: 1.2, friction: 4, tension: 50, useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: 0.7, duration: 600, useNativeDriver: true,
      }),
    ]).start(() => {
      // Text fades in after logo lands
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1, duration: 300, useNativeDriver: true,
        }),
        Animated.timing(textSlide, {
          toValue: 0, duration: 350, useNativeDriver: true,
        }),
      ]).start();
    });

    // Progress bar fills over 1.4s
    Animated.timing(barWidth, {
      toValue: width * 0.6,
      duration: 1400,
      useNativeDriver: false,
    }).start();

    // Finish after 1.7s regardless of config fetch
    const timer = setTimeout(async () => {
      await configPromise.catch(() => {});
      onFinish();
    }, 1700);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden />

      {/* Background gradient */}
      <LinearGradient
        colors={['#0A0A0F', '#12081A', '#0A0A0F']}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow behind logo */}
      <Animated.View
        style={[
          styles.glow,
          { opacity: glowOpacity, transform: [{ scale: glowScale }] }
        ]}
      />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <LinearGradient
          colors={['#FF2E55', '#8B1A2A']}
          style={styles.logoCircle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.logoIcon}>▶</Text>
        </LinearGradient>
      </Animated.View>

      {/* App name + tagline */}
      <Animated.View
        style={{
          opacity: textOpacity,
          transform: [{ translateY: textSlide }],
          alignItems: 'center',
          marginTop: 24,
        }}
      >
        <Text style={styles.appName}>
          Cine<Text style={styles.appNameAccent}>Scope</Text>
        </Text>
        <Text style={styles.tagline}>{CONFIG.APP_TAGLINE}</Text>
      </Animated.View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: barWidth }]} />
      </View>

      {/* Status text */}
      <Animated.Text style={[styles.statusText, { opacity: textOpacity }]}>
        {statusText}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 46, 85, 0.18)',
  },
  logoContainer: {
    marginBottom: 0,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF2E55',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 24,
  },
  logoIcon: {
    fontSize: 44,
    color: '#FFFFFF',
    marginLeft: 4,
  },
  appName: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  appNameAccent: {
    color: '#FF2E55',
  },
  tagline: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 3.5,
  },
  barTrack: {
    position: 'absolute',
    bottom: 70,
    width: width * 0.6,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#FF2E55',
    shadowColor: '#FF2E55',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  statusText: {
    position: 'absolute',
    bottom: 50,
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 0.5,
  },
});
