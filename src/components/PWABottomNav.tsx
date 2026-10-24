import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useSegments, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

export function PWABottomNav() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const path = (pathname || '').toLowerCase();

  // Hide on auth routes or when unauthenticated
  const segs = segments as string[];
  const isAuthRoute =
    !isAuthenticated ||
    segs.some((s) => s === '(auth)' || s === 'login' || s === 'register' || s === 'modal') ||
    path.includes('/(auth)');

  if (isAuthRoute || isKeyboardVisible) {
    return null;
  }

  // Active state matching PWA bottom-nav.blade.php
  const isFarmActive =
    path === '/farm' ||
    path.startsWith('/(tabs)/farm') ||
    path.startsWith('/farm-') ||
    path.startsWith('/crop-cycle-view') ||
    path.startsWith('/activity-view') ||
    path.startsWith('/expense-view') ||
    path.startsWith('/(tabs)/crop-cycles') ||
    path.startsWith('/(tabs)/expenses');

  const isStaffActive =
    path === '/staff' ||
    path.startsWith('/(tabs)/staff') ||
    path.startsWith('/staff-');

  const isNotesActive =
    path === '/notes' ||
    path.startsWith('/(tabs)/notes') ||
    path.startsWith('/note-view');

  const isMoreActive =
    path === '/more' ||
    path.startsWith('/(tabs)/more') ||
    path.startsWith('/sales') ||
    path.startsWith('/sale-view') ||
    path.startsWith('/agro-shop') ||
    path.startsWith('/consultant-visits') ||
    path === '/crops' ||
    path.startsWith('/crops') ||
    path.startsWith('/agro-input-products') ||
    path.startsWith('/activities') ||
    path.startsWith('/buyers') ||
    path.startsWith('/reports');

  const isHomeActive =
    !isFarmActive && !isStaffActive && !isNotesActive && !isMoreActive;

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 8);

  const navigateTo = (route: string) => {
    router.navigate(route as any);
  };

  return (
    <View style={[styles.navContainer, { paddingBottom: bottomPadding }]}>
      {/* 1. Farm Tab */}
      <TouchableOpacity
        style={[styles.navItem, isFarmActive && styles.navItemActive]}
        activeOpacity={0.7}
        onPress={() => navigateTo('/(tabs)/farm')}
      >
        <Ionicons
          name={isFarmActive ? 'grid' : 'grid-outline'}
          size={21}
          color={isFarmActive ? '#1f2937' : '#475569'}
        />
        <Text style={[styles.navLabel, isFarmActive && styles.navLabelActive]}>
          FARM
        </Text>
        <View style={styles.navDivider} />
      </TouchableOpacity>

      {/* 2. Staff Tab */}
      <TouchableOpacity
        style={[styles.navItem, isStaffActive && styles.navItemActive]}
        activeOpacity={0.7}
        onPress={() => navigateTo('/(tabs)/staff')}
      >
        <Ionicons
          name={isStaffActive ? 'people' : 'people-outline'}
          size={21}
          color={isStaffActive ? '#1f2937' : '#475569'}
        />
        <Text style={[styles.navLabel, isStaffActive && styles.navLabelActive]}>
          STAFF
        </Text>
        <View style={styles.navDivider} />
      </TouchableOpacity>

      {/* 3. Home Tab (Center, larger icon, no label - exact PWA fs-nav-item--home parity) */}
      <TouchableOpacity
        style={[styles.navItem, styles.homeNavItem, isHomeActive && styles.navItemActive]}
        activeOpacity={0.7}
        onPress={() => navigateTo('/(tabs)')}
      >
        <Ionicons
          name={isHomeActive ? 'home' : 'home-outline'}
          size={26}
          color={isHomeActive ? '#1f2937' : '#475569'}
        />
        <View style={styles.navDivider} />
      </TouchableOpacity>

      {/* 4. Notes Tab */}
      <TouchableOpacity
        style={[styles.navItem, isNotesActive && styles.navItemActive]}
        activeOpacity={0.7}
        onPress={() => navigateTo('/(tabs)/notes')}
      >
        <Ionicons
          name={isNotesActive ? 'clipboard' : 'clipboard-outline'}
          size={21}
          color={isNotesActive ? '#1f2937' : '#475569'}
        />
        <Text style={[styles.navLabel, isNotesActive && styles.navLabelActive]}>
          NOTES
        </Text>
        <View style={styles.navDivider} />
      </TouchableOpacity>

      {/* 5. More Tab - directly opens profile screen /(tabs)/more */}
      <TouchableOpacity
        style={[styles.navItem, isMoreActive && styles.navItemActive]}
        activeOpacity={0.7}
        onPress={() => navigateTo('/(tabs)/more')}
      >
        <Ionicons
          name={isMoreActive ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'}
          size={21}
          color={isMoreActive ? '#1f2937' : '#475569'}
        />
        <Text style={[styles.navLabel, isMoreActive && styles.navLabelActive]}>
          MORE
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  navContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.3)',
    paddingTop: 6,
    paddingHorizontal: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    borderRadius: 14,
    position: 'relative',
    gap: 3,
  },
  homeNavItem: {
    paddingVertical: 10,
    gap: 0,
  },
  navItemActive: {
    backgroundColor: '#f59e0b',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  navLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: '#475569',
  },
  navLabelActive: {
    color: '#1f2937',
    fontWeight: '800',
  },
  navDivider: {
    position: 'absolute',
    right: 0,
    top: 12,
    bottom: 12,
    width: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
  },
});
