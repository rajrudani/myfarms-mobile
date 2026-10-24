import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Keyboard,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useSegments, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors, radius, shadows, typography } from '../theme/tokens';
import { getAbsoluteImageUrl } from '../api/client';

export function PWABottomNav() {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Close more panel on route change
  useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname]);

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
    isMoreOpen ||
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

  // More panel sub-item active states
  const isCropsActive = path === '/crops' || path.startsWith('/crops');
  const isAgroInputActive = path.startsWith('/agro-input-products');
  const isActivitiesActive = path.startsWith('/activities');
  const isBuyersActive = path.startsWith('/buyers');
  const isShopActive = path.startsWith('/agro-shop');
  const isSalesActive = path.startsWith('/sales') || path.startsWith('/sale-view');
  const isConsultantActive = path.startsWith('/consultant-visits');
  const isReportsActive = path.startsWith('/reports');

  const currentUserName = user?.name?.trim() || 'Profile';
  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'U';

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 8);
  const navHeight = 52 + bottomPadding;

  const navigateTo = (route: string) => {
    setIsMoreOpen(false);
    router.navigate(route as any);
  };

  return (
    <>
      {/* PWA More Popup Panel Modal */}
      <Modal
        visible={isMoreOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMoreOpen(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setIsMoreOpen(false)}
        >
          <View
            style={[styles.morePanel, { bottom: navHeight + 8 }]}
            onStartShouldSetResponder={() => true}
          >
            {/* Profile Row */}
            <TouchableOpacity
              style={styles.profileRow}
              activeOpacity={0.8}
              onPress={() => navigateTo('/(tabs)/more')}
            >
              <View style={styles.profileAvatar}>
                {user?.profile_photo_path ? (
                  <Image
                    source={{ uri: getAbsoluteImageUrl(user.profile_photo_path) }}
                    style={styles.avatarImg}
                  />
                ) : (
                  <Text style={styles.avatarInitial}>{userInitials}</Text>
                )}
              </View>
              <Text style={styles.profileName} numberOfLines={1}>
                {currentUserName}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#64748b" />
            </TouchableOpacity>

            <View style={styles.panelDivider} />

            {/* Masters Section */}
            <Text style={styles.panelHeading}>MASTERS</Text>
            <View style={styles.mastersStack}>
              {/* Crops */}
              <TouchableOpacity
                style={[styles.stackItem, isCropsActive && styles.activeItem]}
                activeOpacity={0.7}
                onPress={() => navigateTo('/crops')}
              >
                <Ionicons
                  name="grid-outline"
                  size={19}
                  color={isCropsActive ? '#1f2937' : '#475569'}
                />
                <Text style={[styles.stackItemText, isCropsActive && styles.activeItemText]}>
                  Crops
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={isCropsActive ? '#1f2937' : '#94a3b8'}
                />
              </TouchableOpacity>

              {/* Agro Input Products */}
              <TouchableOpacity
                style={[styles.stackItem, isAgroInputActive && styles.activeItem]}
                activeOpacity={0.7}
                onPress={() => navigateTo('/agro-input-products')}
              >
                <Ionicons
                  name="beaker-outline"
                  size={19}
                  color={isAgroInputActive ? '#1f2937' : '#475569'}
                />
                <Text style={[styles.stackItemText, isAgroInputActive && styles.activeItemText]}>
                  Agro Input Products
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={isAgroInputActive ? '#1f2937' : '#94a3b8'}
                />
              </TouchableOpacity>

              {/* Activities Master */}
              <TouchableOpacity
                style={[styles.stackItem, isActivitiesActive && styles.activeItem]}
                activeOpacity={0.7}
                onPress={() => navigateTo('/activities')}
              >
                <Ionicons
                  name="clipboard-outline"
                  size={19}
                  color={isActivitiesActive ? '#1f2937' : '#475569'}
                />
                <Text style={[styles.stackItemText, isActivitiesActive && styles.activeItemText]}>
                  Activities
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={isActivitiesActive ? '#1f2937' : '#94a3b8'}
                />
              </TouchableOpacity>

              {/* Buyers */}
              <TouchableOpacity
                style={[styles.stackItem, isBuyersActive && styles.activeItem]}
                activeOpacity={0.7}
                onPress={() => navigateTo('/buyers')}
              >
                <Ionicons
                  name="business-outline"
                  size={19}
                  color={isBuyersActive ? '#1f2937' : '#475569'}
                />
                <Text style={[styles.stackItemText, isBuyersActive && styles.activeItemText]}>
                  Buyers
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={isBuyersActive ? '#1f2937' : '#94a3b8'}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.panelDivider} />

            {/* 2x2 Operations Grid */}
            <View style={styles.gridContainer}>
              {/* Shop */}
              <TouchableOpacity
                style={[styles.gridItem, isShopActive && styles.activeItem]}
                activeOpacity={0.7}
                onPress={() => navigateTo('/agro-shop')}
              >
                <Ionicons
                  name="cart-outline"
                  size={20}
                  color={isShopActive ? '#1f2937' : '#475569'}
                />
                <Text style={[styles.gridItemText, isShopActive && styles.activeItemText]}>
                  Shop
                </Text>
              </TouchableOpacity>

              {/* Sale */}
              <TouchableOpacity
                style={[styles.gridItem, isSalesActive && styles.activeItem]}
                activeOpacity={0.7}
                onPress={() => navigateTo('/sales')}
              >
                <Ionicons
                  name="pricetag-outline"
                  size={20}
                  color={isSalesActive ? '#1f2937' : '#475569'}
                />
                <Text style={[styles.gridItemText, isSalesActive && styles.activeItemText]}>
                  Sale
                </Text>
              </TouchableOpacity>

              {/* Consultant */}
              <TouchableOpacity
                style={[styles.gridItem, isConsultantActive && styles.activeItem]}
                activeOpacity={0.7}
                onPress={() => navigateTo('/consultant-visits')}
              >
                <Ionicons
                  name="briefcase-outline"
                  size={20}
                  color={isConsultantActive ? '#1f2937' : '#475569'}
                />
                <Text style={[styles.gridItemText, isConsultantActive && styles.activeItemText]}>
                  Consultant
                </Text>
              </TouchableOpacity>

              {/* Reports */}
              <TouchableOpacity
                style={[styles.gridItem, isReportsActive && styles.activeItem]}
                activeOpacity={0.7}
                onPress={() => navigateTo('/reports')}
              >
                <Ionicons
                  name="bar-chart-outline"
                  size={20}
                  color={isReportsActive ? '#1f2937' : '#475569'}
                />
                <Text style={[styles.gridItemText, isReportsActive && styles.activeItemText]}>
                  Reports
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* PWA Bottom Navigation Bar */}
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

        {/* 5. More Tab */}
        <TouchableOpacity
          style={[styles.navItem, isMoreActive && styles.navItemActive]}
          activeOpacity={0.7}
          onPress={() => setIsMoreOpen((prev) => !prev)}
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
    </>
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

  // Modal Backdrop
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
  },

  // PWA More Panel Popup
  morePanel: {
    position: 'absolute',
    right: 12,
    width: 290,
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    padding: 10,
    gap: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1f2937',
  },
  profileName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  panelDivider: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    marginHorizontal: 2,
  },
  panelHeading: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#94a3b8',
    paddingHorizontal: 6,
    marginTop: 2,
  },
  mastersStack: {
    gap: 6,
  },
  stackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  stackItemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '48.5%',
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    gap: 5,
  },
  gridItemText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  activeItem: {
    backgroundColor: '#f59e0b',
    borderColor: 'rgba(245, 158, 11, 0.5)',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  activeItemText: {
    color: '#1f2937',
    fontWeight: '700',
  },
});
