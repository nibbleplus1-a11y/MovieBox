/**
 * TVApp — Android TV / Android Box root layout.
 *
 * Layout:
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │  [Sidebar]  │                 [Main Content]                    │
 *  │  Logo       │                                                   │
 *  │  Home   ◄── │   TVHomeScreen / TVSearchScreen / ...             │
 *  │  Search     │                                                   │
 *  │  Downloads  │                                                   │
 *  │  My List    │                                                   │
 *  │  Settings   │                                                   │
 *  └─────────────────────────────────────────────────────────────────┘
 *
 * The sidebar auto-collapses to icon-only mode.
 * Detail and Player screens push over the entire layout (full-screen).
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Dimensions, Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NavigationContainer, DefaultTheme, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CONFIG } from '../../config';

import TVHomeScreen    from './TVHomeScreen';
import TVSearchScreen  from './TVSearchScreen';
import DetailScreen    from '../DetailScreen';
import PlayerScreen    from '../PlayerScreen';
import DownloadsScreen from '../DownloadsScreen';
import WatchlistScreen from '../WatchlistScreen';
import SettingsScreen  from '../SettingsScreen';
import { UpdateModal } from '../../components/UpdateModal';
import { checkForAppUpdate, UpdateInfo } from '../../services/updateService';

const SIDEBAR_FULL  = 220;
const SIDEBAR_MINI  = 72;

const Stack = createNativeStackNavigator();

type NavTab = 'Home' | 'Search' | 'Downloads' | 'Watchlist' | 'Settings';

const NAV_ITEMS: { id: NavTab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'Home',      label: 'Home',      icon: 'home-outline',      activeIcon: 'home' },
  { id: 'Search',    label: 'Search',    icon: 'search-outline',    activeIcon: 'search' },
  { id: 'Downloads', label: 'Downloads', icon: 'download-outline',  activeIcon: 'download' },
  { id: 'Watchlist', label: 'My List',   icon: 'bookmark-outline',  activeIcon: 'bookmark' },
  { id: 'Settings',  label: 'Settings',  icon: 'settings-outline',  activeIcon: 'settings' },
];

// DownloadsScreen explicitly requires a navigation prop
function DownloadsTab() {
  const navigation = useNavigation<any>();
  return <DownloadsScreen navigation={navigation} />;
}

function renderTab(tab: NavTab) {
  switch (tab) {
    case 'Home':      return <TVHomeScreen />;
    case 'Search':    return <TVSearchScreen />;
    case 'Downloads': return <DownloadsTab />;
    case 'Watchlist': return <WatchlistScreen />;
    case 'Settings':  return <SettingsScreen />;
  }
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function TVSidebar({
  active,
  onSelect,
}: {
  active: NavTab;
  onSelect: (tab: NavTab) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const anim = useRef(new Animated.Value(SIDEBAR_MINI)).current;

  const toggleSidebar = () => {
    const target = expanded ? SIDEBAR_MINI : SIDEBAR_FULL;
    Animated.spring(anim, { toValue: target, useNativeDriver: false, speed: 18, bounciness: 2 }).start();
    setExpanded(!expanded);
  };

  return (
    <Animated.View style={[styles.sidebar, { width: anim }]}>
      {/* Branding / toggle */}
      <TouchableOpacity style={styles.sidebarLogo} onPress={toggleSidebar} activeOpacity={0.8}>
        <View style={styles.logoIcon}>
          <Ionicons name="play-circle" size={30} color={CONFIG.COLORS.accent} />
        </View>
        {expanded && (
          <Text style={styles.logoText} numberOfLines={1}>
            {CONFIG.APP_NAME}
          </Text>
        )}
      </TouchableOpacity>

      {/* Nav Items */}
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === active;
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.navItem, isActive && styles.navItemActive]}
            onPress={() => onSelect(item.id)}
            activeOpacity={0.75}
          >
            {isActive && <View style={styles.navActiveBar} />}
            <Ionicons
              name={isActive ? item.activeIcon : item.icon}
              size={24}
              color={isActive ? '#fff' : 'rgba(255,255,255,0.45)'}
            />
            {expanded && (
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]} numberOfLines={1}>
                {item.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Spacer + version */}
      <View style={{ flex: 1 }} />
      {expanded && (
        <Text style={styles.versionText}>v{CONFIG.APP_VERSION}</Text>
      )}
    </Animated.View>
  );
}

// ─── Main tabs host ───────────────────────────────────────────────────────────
function TVTabHost() {
  const [activeTab, setActiveTab] = useState<NavTab>('Home');

  return (
    <View style={styles.tabHost}>
      <TVSidebar active={activeTab} onSelect={setActiveTab} />
      <View style={styles.tabContent}>
        {renderTab(activeTab)}
      </View>
    </View>
  );
}

// ─── TV App root ──────────────────────────────────────────────────────────────
const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: CONFIG.COLORS.bg,
    card: CONFIG.COLORS.nav,
    border: 'transparent',
    text: CONFIG.COLORS.text,
    primary: CONFIG.COLORS.accent,
    notification: CONFIG.COLORS.accent,
  },
};

export default function TVApp() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    checkForAppUpdate().then((info) => {
      if (info?.available) setUpdateInfo(info);
    }).catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={NavTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="TVMain" component={TVTabHost} />
          <Stack.Screen
            name="Detail"
            component={DetailScreen}
            options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
          />
          <Stack.Screen
            name="Player"
            component={PlayerScreen}
            options={{ animation: 'fade', gestureEnabled: false }}
          />
        </Stack.Navigator>

        {updateInfo && (
          <UpdateModal updateInfo={updateInfo} onDismiss={() => setUpdateInfo(null)} />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  tabHost: {
    flex: 1, flexDirection: 'row', backgroundColor: '#0A0A0F',
  },

  // Sidebar
  sidebar: {
    backgroundColor: '#0D0D16',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 24,
    overflow: 'hidden',
  },
  sidebarLogo: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, marginBottom: 20,
    gap: 12,
  },
  logoIcon: { width: 32, alignItems: 'center' },
  logoText: {
    fontSize: 18, fontWeight: '900', color: '#fff',
    letterSpacing: 1,
  },
  navItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16,
    marginHorizontal: 8, borderRadius: 10,
    gap: 14, position: 'relative',
  },
  navItemActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  navActiveBar: {
    position: 'absolute', left: 0, top: 10, bottom: 10,
    width: 4, borderRadius: 2,
    backgroundColor: CONFIG.COLORS.accent,
  },
  navLabel: {
    fontSize: 15, color: 'rgba(255,255,255,0.45)',
    fontWeight: '600',
  },
  navLabelActive: {
    color: '#fff', fontWeight: '800',
  },
  versionText: {
    color: 'rgba(255,255,255,0.2)', fontSize: 12,
    textAlign: 'center', marginBottom: 12,
  },

  // Content
  tabContent: { flex: 1 },
});
