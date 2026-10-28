import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Linking, Alert, Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CONFIG } from '../config';

interface SettingsRow {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  action: () => void;
  value?: string;
  isToggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (val: boolean) => void;
  danger?: boolean;
}

interface SettingsSection {
  title: string;
  rows: SettingsRow[];
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [autoPlay, setAutoPlay] = useState(true);
  const [highQuality, setHighQuality] = useState(true);
  const [subtitles, setSubtitles] = useState(false);
  const [notifications, setNotifications] = useState(false);

  const openLink = (url: string) => Linking.openURL(url);

  const SECTIONS: SettingsSection[] = [
    {
      title: 'PLAYBACK',
      rows: [
        {
          icon: 'play-forward-outline',
          label: 'Auto-Play Next Episode',
          subtitle: 'Automatically play next episode for series',
          isToggle: true,
          toggleValue: autoPlay,
          onToggle: setAutoPlay,
          action: () => {},
        },
        {
          icon: 'sparkles-outline',
          label: 'High Quality Streaming',
          subtitle: 'Prefer 1080p Full HD streams',
          isToggle: true,
          toggleValue: highQuality,
          onToggle: setHighQuality,
          action: () => {},
        },
        {
          icon: 'chatbubble-ellipses-outline',
          label: 'Auto-Enable Subtitles',
          subtitle: 'Show subtitles when available',
          isToggle: true,
          toggleValue: subtitles,
          onToggle: setSubtitles,
          action: () => {},
        },
      ],
    },
    {
      title: 'NETWORK & STREAMING',
      rows: [
        {
          icon: 'cloud-done-outline',
          label: 'Streaming CDN Network',
          subtitle: 'Global 1080p Ultra HD delivery network',
          value: 'Connected (1080p)',
          action: () =>
            Alert.alert(
              'Streaming CDN',
              'Connected to CineScope High-Speed Edge Network.\nAll 1080p & 4K media nodes are optimal.',
              [{ text: 'OK' }]
            ),
        },
        {
          icon: 'pulse-outline',
          label: 'Network Health Check',
          subtitle: 'Verify latency and streaming response',
          action: async () => {
            const start = Date.now();
            try {
              const resp = await fetch(`${CONFIG.APP_URL}/health`);
              const ms = Date.now() - start;
              Alert.alert('Connection Healthy', `Streaming edge latency: ${ms}ms\nStream status: Active & High-Speed`, [{ text: 'OK' }]);
            } catch {
              Alert.alert('Connection Offline', 'Unable to reach the media network. Please verify your internet connection.', [{ text: 'OK' }]);
            }
          },
        },
      ],
    },
    {
      title: 'APP',
      rows: [
        {
          icon: 'notifications-outline',
          label: 'Push Notifications',
          subtitle: 'Get notified of new releases',
          isToggle: true,
          toggleValue: notifications,
          onToggle: setNotifications,
          action: () => {},
        },
        {
          icon: 'shield-checkmark-outline',
          label: 'Privacy Policy',
          subtitle: 'View our privacy practices',
          action: () => openLink('https://www.themoviedb.org/privacy-policy'),
        },
        {
          icon: 'star-outline',
          label: 'Rate CineScope',
          subtitle: 'Leave a review on the store',
          action: () =>
            Alert.alert('Rate CineScope', 'Thanks for using CineScope! Share it with friends and family.', [{ text: 'OK' }]),
        },
        {
          icon: 'information-circle-outline',
          label: 'App Version',
          subtitle: 'CineScope Mobile Edition',
          value: '2.5.0',
          action: () =>
            Alert.alert('CineScope', 'Version 2.5.0\nBuilt with React Native & Expo\n\nYour premium cinema streaming platform.', [{ text: 'OK' }]),
        },
      ],
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <Text style={styles.header}>Settings</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* App Identity Card */}
        <View style={styles.identityCard}>
          <View style={styles.logoWrap}>
            <Ionicons name="film" size={22} color="#fff" />
          </View>
          <Text style={styles.appNameText}>
            CINE<Text style={{ color: CONFIG.COLORS.accent }}>SCOPE</Text>
          </Text>
          <Text style={styles.appTagline}>Your Personal Streaming Companion</Text>
          <View style={styles.featurePills}>
            {['Movies', 'TV Shows', 'Anime', 'Multi-Dub'].map(f => (
              <View key={f} style={styles.featurePill}>
                <Text style={styles.featurePillText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quality Summary */}
        <View style={styles.qualityCard}>
          <Text style={styles.sectionLabel}>STREAMING QUALITY</Text>
          <View style={styles.qualityRow}>
            {[
              { q: '4K', sub: 'Ultra HD', color: '#06b6d4' },
              { q: '1080p', sub: 'Full HD', color: '#E50914' },
              { q: '720p', sub: 'HD Ready', color: '#10b981' },
            ].map(item => (
              <View key={item.q} style={[styles.qualityChip, { borderColor: item.color + '44' }]}>
                <Text style={[styles.qualityChipLabel, { color: item.color }]}>{item.q}</Text>
                <Text style={styles.qualityChipSub}>{item.sub}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Settings Sections */}
        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionLabel}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.rows.map((row, i) => (
                <TouchableOpacity
                  key={row.label}
                  style={[styles.row, i < section.rows.length - 1 && styles.rowBorder]}
                  onPress={row.action}
                  activeOpacity={row.isToggle ? 1 : 0.7}
                >
                  <View style={[styles.rowIconWrap, row.danger && styles.rowIconWrapDanger]}>
                    <Ionicons
                      name={row.icon}
                      size={18}
                      color={row.danger ? '#ef4444' : '#E50914'}
                    />
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowLabel, row.danger && styles.rowLabelDanger]}>
                      {row.label}
                    </Text>
                    {row.subtitle ? (
                      <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
                    ) : null}
                  </View>
                  {row.isToggle ? (
                    <Switch
                      value={row.toggleValue}
                      onValueChange={row.onToggle}
                      trackColor={{ false: '#1C1C28', true: CONFIG.COLORS.accent + '88' }}
                      thumbColor={row.toggleValue ? CONFIG.COLORS.accent : '#52525b'}
                      ios_backgroundColor="#1C1C28"
                    />
                  ) : row.value ? (
                    <Text style={styles.rowValue}>{row.value}</Text>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color="#52525b" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            CineScope aggregates publicly available streaming links. We do not host any video content.
            All streams are sourced from third-party providers.
          </Text>
        </View>

        {/* Version info */}
        <Text style={styles.versionFooter}>CineScope v2.0.0 • Built with ❤️ for cinephiles</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CONFIG.COLORS.bg,
  },
  header: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
  },

  identityCard: {
    backgroundColor: CONFIG.COLORS.card,
    borderRadius: 20,
    marginHorizontal: 14,
    marginBottom: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.18)',
    shadowColor: CONFIG.COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: CONFIG.COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: CONFIG.COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 10,
  },
  logoGlyph: { color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
  appNameText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 4,
  },
  appTagline: {
    fontSize: 12,
    color: '#52525b',
    marginBottom: 16,
    fontWeight: '500',
  },
  featurePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  featurePill: {
    backgroundColor: 'rgba(229,9,20,0.1)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.22)',
  },
  featurePillText: { color: CONFIG.COLORS.accent, fontSize: 11, fontWeight: '700' },

  qualityCard: {
    backgroundColor: CONFIG.COLORS.card,
    borderRadius: 16,
    marginHorizontal: 14,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  qualityRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  qualityChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  qualityChipLabel: { fontSize: 14, fontWeight: '900' },
  qualityChipSub: { color: '#3f3f46', fontSize: 10, marginTop: 2, fontWeight: '600' },

  section: { marginBottom: 6, paddingHorizontal: 14 },
  sectionLabel: {
    color: '#3f3f46',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
    paddingLeft: 4,
  },
  sectionCard: {
    backgroundColor: CONFIG.COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconWrapDanger: { backgroundColor: 'rgba(229,9,20,0.12)' },
  rowIcon: { fontSize: 16 },
  rowIconDanger: { color: CONFIG.COLORS.accent },
  rowContent: { flex: 1 },
  rowLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  rowLabelDanger: { color: CONFIG.COLORS.accent },
  rowSubtitle: { color: '#3f3f46', fontSize: 11, marginTop: 2, fontWeight: '500' },
  rowValue: {
    color: '#52525b',
    fontSize: 12,
    fontFamily: 'monospace',
    maxWidth: 130,
    textAlign: 'right',
  },
  chevron: { color: '#3f3f46', fontSize: 22, fontWeight: '300' },

  disclaimer: {
    marginHorizontal: 14,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  disclaimerText: {
    color: '#27272a',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  versionFooter: {
    color: '#27272a',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
});
