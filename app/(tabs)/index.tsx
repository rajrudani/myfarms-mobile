import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/i18n/I18nContext';
import { dashboardApi } from '../../src/api/dashboard';
import { DashboardSummary } from '../../src/types';
import { colors, radius, spacing } from '../../src/theme/tokens';
import { ModalSheet } from '../../src/components/ui';

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const { t, locale } = useTranslation();
  const { width } = useWindowDimensions();

  // Responsive Breakpoints
  const isTablet = width >= 768;
  const isWideTablet = width >= 1024;

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);

  // Profile Modal State
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  // Today's Agenda Modal State (Option 1)
  const [agendaModalVisible, setAgendaModalVisible] = useState(false);

  // Quick Setup Banner Dismissal (stored in component state)
  const [quickSetupDismissed, setQuickSetupDismissed] = useState(false);

  const fetchDashboardSummary = async () => {
    try {
      const summary = await dashboardApi.getSummary();
      setDashboardSummary(summary);
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardSummary();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardSummary();
    setRefreshing(false);
  };

  const handleLogoutPrompt = () => {
    Alert.alert(
      t('Sign Out'),
      t('Are you sure you want to sign out of your account?'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Sign Out'),
          style: 'destructive',
          onPress: async () => {
            setProfileModalVisible(false);
            await logout();
          },
        },
      ]
    );
  };

  const todayDateFormatted = () => {
    const localeMap: Record<string, string> = { en: 'en-GB', gu: 'gu-IN', hi: 'hi-IN' };
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };
    try {
      return new Date().toLocaleDateString(localeMap[locale] || 'en-GB', options);
    } catch {
      return new Date().toLocaleDateString('en-GB', options);
    }
  };

  const getUserInitials = (name?: string) => {
    if (!name) return 'OP';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const tomorrowReminders = dashboardSummary?.today_reminders || [];
  const tomorrowActivities = dashboardSummary?.today_activities || [];
  const hasTodayItems = tomorrowReminders.length > 0 || tomorrowActivities.length > 0;
  const totalAgendaCount = tomorrowReminders.length + tomorrowActivities.length;

  const agendaBannerText = useMemo(() => {
    const remCount = tomorrowReminders.length;
    const actCount = tomorrowActivities.length;

    if (remCount > 0 && actCount > 0) {
      const remPart = remCount === 1 ? t('1 reminder') : t(':count reminders', { count: remCount });
      const actPart = actCount === 1 ? t('1 scheduled event') : t(':count scheduled events', { count: actCount });
      return t('You have :reminders and :activities today', { reminders: remPart, activities: actPart });
    }
    if (remCount > 0) {
      return remCount === 1
        ? t('You have 1 reminder today')
        : t('You have :count reminders today', { count: remCount });
    }
    if (actCount > 0) {
      return actCount === 1
        ? t('You have 1 scheduled event today')
        : t('You have :count scheduled events today', { count: actCount });
    }
    return '';
  }, [tomorrowReminders.length, tomorrowActivities.length, t]);

  const needsFarm = dashboardSummary?.needs_farm_reminder || false;
  const needsStaff = dashboardSummary?.needs_staff_reminder || false;
  const showCoach = !quickSetupDismissed && (needsFarm || needsStaff);

  const containerMaxWidth = isWideTablet ? 1080 : isTablet ? 900 : '100%';
  const horizontalPadding = isTablet ? spacing.xxl : spacing.lg;

  // 2-column or 4-column operations grid
  const gridItemWidth = useMemo(() => {
    const effectiveWidth = Math.min(width, 1080);
    if (isTablet) {
      const totalGaps = 3 * 12;
      const totalPadding = horizontalPadding * 2;
      return (effectiveWidth - totalPadding - totalGaps) / 4;
    }
    const totalGaps = 12;
    const totalPadding = horizontalPadding * 2;
    return (effectiveWidth - totalPadding - totalGaps) / 2;
  }, [width, isTablet, horizontalPadding]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={[styles.mainWrapper, { maxWidth: containerMaxWidth, alignSelf: 'center', width: '100%' }]}>
          {/* Sticky Topbar: Logo on left, Search + Profile on right */}
          <View style={[styles.topBar, { paddingHorizontal: horizontalPadding }]}>
            <TouchableOpacity
              onPress={() => router.push('/')}
              activeOpacity={0.8}
              accessibilityLabel={t('Dashboard Home')}
            >
              <Image
                source={require('../../assets/images/full-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </TouchableOpacity>

            <View style={styles.topActions}>
              <TouchableOpacity
                style={styles.searchQuick}
                onPress={() => router.push('/search')}
                activeOpacity={0.7}
                accessibilityLabel={t('Search')}
              >
                <Ionicons name="search-outline" size={22} color="#334155" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileQuick}
                onPress={() => setProfileModalVisible(true)}
                activeOpacity={0.8}
                accessibilityLabel={t('User Profile')}
              >
                <Text style={styles.profileQuickText}>{getUserInitials(user?.name)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Welcome Block: Welcome, Jaymin Patel 🙏 */}
          <View style={[styles.welcomeBlock, { paddingHorizontal: horizontalPadding }]}>
            <Text style={styles.welcomeGreeting}>{t('Welcome,')}</Text>
            <View style={styles.welcomeNameRow}>
              <Text style={styles.welcomeNameText} numberOfLines={1}>
                {user?.name || t('Staff')}
              </Text>
              <Text style={styles.welcomeEmoji}>🙏</Text>
            </View>
          </View>

          {/* Today's Agenda Compact Banner (Option 1) */}
          {hasTodayItems && !loading && (
            <View style={[styles.agendaBannerContainer, { paddingHorizontal: horizontalPadding }]}>
              <TouchableOpacity
                style={styles.agendaBanner}
                onPress={() => setAgendaModalVisible(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={agendaBannerText}
              >
                <View style={styles.agendaBannerLeft}>
                  <View style={styles.agendaBannerIconBox}>
                    <Ionicons name="notifications-outline" size={16} color="#15803d" />
                  </View>
                  <Text style={styles.agendaBannerText} numberOfLines={1} ellipsizeMode="tail">
                    {agendaBannerText}
                  </Text>
                </View>
                <View style={styles.agendaBannerRight}>
                  <View style={styles.agendaCountBadge}>
                    <Text style={styles.agendaCountBadgeText}>{totalAgendaCount}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#16a34a" />
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Quick Setup Coach Overlay / Card */}
          {showCoach && (
            <View style={[styles.coachContainer, { paddingHorizontal: horizontalPadding }]}>
              <View style={styles.coachCard}>
                <View>
                  <Text style={styles.coachTitle}>{t('Quick setup')}</Text>
                  <Text style={styles.coachSubtitle}>{t('Add the basics so your dashboard is ready to use.')}</Text>
                </View>

                <View style={styles.coachList}>
                  {needsFarm && (
                    <View style={styles.coachItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.coachItemTitle}>{t('Add your first farm')}</Text>
                        <Text style={styles.coachItemSub}>{t('Create a farm to start tracking activities and costs.')}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.coachBtn}
                        onPress={() => router.push('/farm-hub')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add-circle" size={16} color="#ffffff" />
                        <Text style={styles.coachBtnText}>{t('Farm')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {needsStaff && (
                    <View style={styles.coachItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.coachItemTitle}>{t('Add farm staff')}</Text>
                        <Text style={styles.coachItemSub}>{t('Invite or create staff to manage daily work.')}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.coachBtn}
                        onPress={() => router.push('/staff')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add-circle" size={16} color="#ffffff" />
                        <Text style={styles.coachBtnText}>{t('Staff')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.coachDismiss}
                  onPress={() => setQuickSetupDismissed(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.coachDismissText}>{t('Skip now')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {loading && (
            <View style={{ paddingHorizontal: horizontalPadding, paddingVertical: 12 }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}

          {/* High-Priority Action Modules: Staff Attendance & Staff Payments (fs-module-list) */}
          <View style={[styles.moduleList, { paddingHorizontal: horizontalPadding }]}>
            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => router.push({ pathname: '/staff', params: { tab: 'attendance' } })}
              activeOpacity={0.75}
            >
              <View style={[styles.moduleIcon, styles.iconGreen]}>
                <Ionicons name="clipboard-outline" size={22} color="#166534" />
              </View>
              <View style={styles.moduleTextContainer}>
                <Text style={styles.moduleTitle}>{t('Staff Attendance')}</Text>
                <Text style={styles.moduleSub}>{t('Daily staff records')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" style={styles.moduleArrow} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => router.push({ pathname: '/staff', params: { tab: 'payments' } })}
              activeOpacity={0.75}
            >
              <View style={[styles.moduleIcon, styles.iconOrange]}>
                <Ionicons name="people-outline" size={22} color="#9a3412" />
              </View>
              <View style={styles.moduleTextContainer}>
                <Text style={styles.moduleTitle}>{t('Staff Payments')}</Text>
                <Text style={styles.moduleSub}>{t('Track and release payments')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" style={styles.moduleArrow} />
            </TouchableOpacity>
          </View>

          {/* 2x2 Operations Grid (fs-module-grid) */}
          <View
            style={[
              styles.moduleGrid,
              { paddingHorizontal: horizontalPadding },
              isTablet && styles.moduleGridTablet,
            ]}
          >
            <TouchableOpacity
              style={[styles.moduleTile, { width: isTablet ? undefined : gridItemWidth, flex: isTablet ? 1 : undefined }]}
              onPress={() => router.push('/agro-shop')}
              activeOpacity={0.75}
            >
              <View style={[styles.moduleTileIcon, styles.iconOrange]}>
                <Ionicons name="bag-handle-outline" size={20} color="#9a3412" />
              </View>
              <Text style={styles.moduleTileTitle}>{t('Agro Purchases')}</Text>
              <Text style={styles.moduleTileSub}>{t('Supplies & tools')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.moduleTile, { width: isTablet ? undefined : gridItemWidth, flex: isTablet ? 1 : undefined }]}
              onPress={() => router.push('/sales')}
              activeOpacity={0.75}
            >
              <View style={[styles.moduleTileIcon, styles.iconGreen]}>
                <Ionicons name="cash-outline" size={20} color="#166534" />
              </View>
              <Text style={styles.moduleTileTitle}>{t('Sales')}</Text>
              <Text style={styles.moduleTileSub}>{t('Track revenue')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.moduleTile, { width: isTablet ? undefined : gridItemWidth, flex: isTablet ? 1 : undefined }]}
              onPress={() => router.push('/farm-hub')}
              activeOpacity={0.75}
            >
              <View style={[styles.moduleTileIcon, styles.iconBlue]}>
                <Ionicons name="calendar-outline" size={20} color="#1d4ed8" />
              </View>
              <Text style={styles.moduleTileTitle}>{t('Farms')}</Text>
              <Text style={styles.moduleTileSub}>{t('Manage farms')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.moduleTile, { width: isTablet ? undefined : gridItemWidth, flex: isTablet ? 1 : undefined }]}
              onPress={() => router.push('/consultant-visits')}
              activeOpacity={0.75}
            >
              <View style={[styles.moduleTileIcon, styles.iconPurple]}>
                <Ionicons name="briefcase-outline" size={20} color="#6d28d9" />
              </View>
              <Text style={styles.moduleTileTitle}>{t('Consultant Visits')}</Text>
              <Text style={styles.moduleTileSub}>{t('Manage Visits')}</Text>
            </TouchableOpacity>
          </View>

          {/* Section Divider (fs-divider) */}
          <View style={[styles.divider, { marginHorizontal: horizontalPadding }]} />

          {/* Utility Card: Reports & Mandi Prices (fs-utility) */}
          <View style={{ paddingHorizontal: horizontalPadding, marginTop: 4 }}>
            <View style={styles.utilityCard}>
              <TouchableOpacity
                style={styles.utilityItem}
                onPress={() => router.push('/reports')}
                activeOpacity={0.75}
              >
                <View style={[styles.utilityIcon, styles.iconBlue]}>
                  <Ionicons name="bar-chart-outline" size={18} color="#1d4ed8" />
                </View>
                <View style={styles.utilityInfo}>
                  <Text style={styles.utilityTitle}>{t('Reports')}</Text>
                  <Text style={styles.utilitySub}>{t('View farm analytics & records')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              </TouchableOpacity>

              <View style={styles.utilityDivider} />

              <TouchableOpacity
                style={styles.utilityItem}
                onPress={() => router.push('/mandi-prices')}
                activeOpacity={0.75}
              >
                <View style={[styles.utilityIcon, styles.iconGreen]}>
                  <Ionicons name="trending-up" size={18} color="#166534" />
                </View>
                <View style={styles.utilityInfo}>
                  <Text style={styles.utilityTitle}>{t('Mandi Prices')}</Text>
                  <Text style={styles.utilitySub}>{t('Daily government crop prices')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Profile / Account Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={profileModalVisible}
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setProfileModalVisible(false)}
        >
          <View style={[styles.profileSheetCard, { maxWidth: isTablet ? 480 : '90%' }]}>
            <View style={styles.profileSheetHeader}>
              <View style={styles.profileAvatarBox}>
                <Text style={styles.profileAvatarText}>{getUserInitials(user?.name)}</Text>
              </View>
              <View style={styles.profileSheetInfo}>
                <Text style={styles.profileSheetName}>{user?.name || t('Staff')}</Text>
                <Text style={styles.profileSheetEmail}>{user?.email || t('Signed In')}</Text>
                <View style={styles.roleTag}>
                  <Text style={styles.roleTagText}>{user?.user_type?.toUpperCase() || 'STAFF'}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setProfileModalVisible(false)}
                style={styles.profileCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInnerDivider} />

            <View style={styles.profileActionList}>
              <TouchableOpacity
                style={styles.profileActionItem}
                onPress={() => {
                  setProfileModalVisible(false);
                  router.push('/farm-hub');
                }}
              >
                <View style={[styles.profileActionIcon, styles.iconBlue]}>
                  <Ionicons name="grid-outline" size={18} color="#1d4ed8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileActionTitle}>{t('Manage Farms')}</Text>
                  <Text style={styles.profileActionSub}>{t('Explore and add parcels')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileActionItem}
                onPress={() => {
                  setProfileModalVisible(false);
                  router.push('/more');
                }}
              >
                <View style={[styles.profileActionIcon, { backgroundColor: '#f1f5f9' }]}>
                  <Ionicons name="ellipsis-horizontal" size={18} color="#475569" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileActionTitle}>{t('All Modules & Masters')}</Text>
                  <Text style={styles.profileActionSub}>{t('Crops, products, buyers & tools')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInnerDivider} />

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogoutPrompt}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={18} color="#dc2626" />
              <Text style={styles.logoutBtnText}>{t('Sign Out of MyFarms')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Today's Agenda Bottom Sheet Modal (Option 1) */}
      <ModalSheet
        visible={agendaModalVisible}
        onClose={() => setAgendaModalVisible(false)}
        title={t("Today's Agenda")}
        kicker={todayDateFormatted()}
        maxHeight="82%"
        footer={
          <TouchableOpacity
            style={styles.agendaModalCloseBtn}
            onPress={() => setAgendaModalVisible(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.agendaModalCloseBtnText}>{t('Close')}</Text>
          </TouchableOpacity>
        }
      >
        <View style={styles.agendaModalBody}>
          {/* Reminders Section */}
          {tomorrowReminders.length > 0 && (
            <View style={styles.agendaSection}>
              <View style={styles.agendaSectionHeader}>
                <View style={styles.agendaSectionTitleRow}>
                  <View style={[styles.agendaSectionIconBox, { backgroundColor: '#fef3c7' }]}>
                    <Ionicons name="notifications" size={15} color="#d97706" />
                  </View>
                  <Text style={styles.agendaSectionTitle}>{t('Reminders')}</Text>
                  <View style={styles.agendaBadge}>
                    <Text style={styles.agendaBadgeText}>{tomorrowReminders.length}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setAgendaModalVisible(false);
                    router.push('/notes');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.agendaViewAllText}>{t('View All')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.agendaList}>
                {tomorrowReminders.map((reminder) => (
                  <TouchableOpacity
                    key={reminder.ulid || reminder.id}
                    style={styles.agendaItem}
                    onPress={() => {
                      setAgendaModalVisible(false);
                      router.push({
                        pathname: '/note-view',
                        params: { id: reminder.ulid || String(reminder.id) },
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.agendaItemMain}>
                      <Text style={styles.agendaItemTitle} numberOfLines={2}>
                        {reminder.title}
                      </Text>
                      {reminder.time ? (
                        <View style={styles.agendaItemMetaRow}>
                          <Ionicons name="time-outline" size={12} color="#64748b" />
                          <Text style={styles.agendaItemMetaText}>{reminder.time}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Scheduled Activities Section */}
          {tomorrowActivities.length > 0 && (
            <View style={styles.agendaSection}>
              <View style={styles.agendaSectionHeader}>
                <View style={styles.agendaSectionTitleRow}>
                  <View style={[styles.agendaSectionIconBox, { backgroundColor: '#dbeafe' }]}>
                    <Ionicons name="calendar" size={15} color="#2563eb" />
                  </View>
                  <Text style={styles.agendaSectionTitle}>{t('Scheduled Activities')}</Text>
                  <View style={styles.agendaBadge}>
                    <Text style={styles.agendaBadgeText}>{tomorrowActivities.length}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setAgendaModalVisible(false);
                    router.push('/farm-hub');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.agendaViewAllText}>{t('View All')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.agendaList}>
                {tomorrowActivities.map((act) => (
                  <TouchableOpacity
                    key={act.ulid || act.id}
                    style={styles.agendaItem}
                    onPress={() => {
                      setAgendaModalVisible(false);
                      router.push({
                        pathname: '/activity-view',
                        params: { id: act.ulid || String(act.id) },
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.agendaItemMain}>
                      <Text style={styles.agendaItemTitle} numberOfLines={2}>
                        {act.name}
                      </Text>
                      <View style={styles.agendaItemMetaRow}>
                        {act.farm_name ? (
                          <>
                            <Ionicons name="location-outline" size={12} color="#64748b" />
                            <Text style={styles.agendaItemMetaText}>{act.farm_name}</Text>
                          </>
                        ) : null}
                        {act.crop_name ? (
                          <Text style={styles.agendaItemMetaText}> • {act.crop_name}</Text>
                        ) : null}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      </ModalSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
  },
  mainWrapper: {
    paddingBottom: 24,
    gap: 10,
  },

  // 1. Top Bar (fs-dash-logo-row)
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#f8fafc',
  },
  logo: {
    width: 138,
    height: 38,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  searchQuick: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileQuick: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileQuickText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1f2937',
  },

  // 2. Welcome Block (fs-welcome-block)
  welcomeBlock: {
    paddingVertical: 2,
    paddingBottom: 8,
    gap: 2,
  },
  welcomeGreeting: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  welcomeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  welcomeNameText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  welcomeEmoji: {
    fontSize: 20,
  },

  // 3. Quick Setup Coach Card (fs-coach-overlay)
  coachContainer: {
    marginBottom: 6,
  },
  coachCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    gap: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  coachTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  coachSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  coachList: {
    gap: 10,
  },
  coachItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    gap: 10,
  },
  coachItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  coachItemSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  coachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#22c55e',
  },
  coachBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  coachDismiss: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  coachDismissText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },

  // 4. Today's Agenda Compact Banner (Option 1)
  agendaBannerContainer: {
    marginBottom: 6,
  },
  agendaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  agendaBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 6,
  },
  agendaBannerIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#15803d',
  },
  agendaBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  agendaCountBadge: {
    backgroundColor: '#16a34a',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Today's Agenda Modal Styles
  agendaModalBody: {
    gap: 18,
    paddingBottom: 8,
  },
  agendaSection: {
    gap: 10,
  },
  agendaSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agendaSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agendaSectionIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  agendaBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  agendaBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  agendaViewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  agendaList: {
    gap: 8,
  },
  agendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  agendaItemMain: {
    flex: 1,
    gap: 4,
  },
  agendaItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  agendaItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  agendaItemMetaText: {
    fontSize: 12,
    color: '#64748b',
  },
  agendaModalCloseBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  agendaModalCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },

  // 5. Action Modules (fs-module-list)
  moduleList: {
    gap: 12,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  moduleIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
  },
  iconOrange: {
    backgroundColor: 'rgba(251, 146, 60, 0.18)',
  },
  iconBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
  },
  iconPurple: {
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
  },
  moduleTextContainer: {
    flex: 1,
  },
  moduleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  moduleSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  moduleArrow: {
    marginLeft: 'auto',
  },

  // 6. 2x2 Operations Grid (fs-module-grid)
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  moduleGridTablet: {
    flexWrap: 'nowrap',
    gap: 12,
  },
  moduleTile: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    backgroundColor: '#ffffff',
    gap: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  moduleTileIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleTileTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  moduleTileSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },

  // 7. Divider (fs-divider)
  divider: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 999,
    marginVertical: 4,
  },

  // 8. Utility Card (fs-utility)
  utilityCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#f1f5ff',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    gap: 12,
  },
  utilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  utilityIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityInfo: {
    flex: 1,
  },
  utilityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  utilitySub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  utilityDivider: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 999,
    marginVertical: 2,
  },

  // Profile Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  profileSheetCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: radius.xl,
    padding: spacing.lg,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 8,
  },
  profileSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileSheetInfo: {
    flex: 1,
  },
  profileSheetName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  profileSheetEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 4,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  profileCloseBtn: {
    padding: 6,
  },
  modalInnerDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  profileActionList: {
    gap: 8,
  },
  profileActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  profileActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  profileActionSub: {
    fontSize: 11,
    color: '#64748b',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
});
