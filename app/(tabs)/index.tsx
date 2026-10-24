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
  SafeAreaView,
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { dashboardApi } from '../../src/api/dashboard';
import { DashboardSummary } from '../../src/types';
import { colors, radius, spacing } from '../../src/theme/tokens';

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();

  // Responsive Breakpoints
  const isTablet = width >= 768;
  const isWideTablet = width >= 1024;

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);

  // Profile Modal State
  const [profileModalVisible, setProfileModalVisible] = useState(false);

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
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
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
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };
    return new Date().toLocaleDateString('en-GB', options);
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
    <SafeAreaView style={styles.container}>
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
              accessibilityLabel="Dashboard Home"
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
                accessibilityLabel="Search"
              >
                <Ionicons name="search-outline" size={22} color="#334155" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileQuick}
                onPress={() => setProfileModalVisible(true)}
                activeOpacity={0.8}
                accessibilityLabel="User Profile"
              >
                <Text style={styles.profileQuickText}>{getUserInitials(user?.name)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Welcome Block: Welcome, Jaymin Patel 🙏 */}
          <View style={[styles.welcomeBlock, { paddingHorizontal: horizontalPadding }]}>
            <Text style={styles.welcomeGreeting}>Welcome,</Text>
            <View style={styles.welcomeNameRow}>
              <Text style={styles.welcomeNameText} numberOfLines={1}>
                {user?.name || 'Staff'}
              </Text>
              <Text style={styles.welcomeEmoji}>🙏</Text>
            </View>
          </View>

          {/* Quick Setup Coach Overlay / Card */}
          {showCoach && (
            <View style={[styles.coachContainer, { paddingHorizontal: horizontalPadding }]}>
              <View style={styles.coachCard}>
                <View>
                  <Text style={styles.coachTitle}>Quick setup</Text>
                  <Text style={styles.coachSubtitle}>Add the basics so your dashboard is ready to use.</Text>
                </View>

                <View style={styles.coachList}>
                  {needsFarm && (
                    <View style={styles.coachItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.coachItemTitle}>Add your first farm</Text>
                        <Text style={styles.coachItemSub}>Create a farm to start tracking activities and costs.</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.coachBtn}
                        onPress={() => router.push('/farm-hub')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add-circle" size={16} color="#ffffff" />
                        <Text style={styles.coachBtnText}>Farm</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {needsStaff && (
                    <View style={styles.coachItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.coachItemTitle}>Add farm staff</Text>
                        <Text style={styles.coachItemSub}>Invite or create staff to manage daily work.</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.coachBtn}
                        onPress={() => router.push('/staff')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add-circle" size={16} color="#ffffff" />
                        <Text style={styles.coachBtnText}>Staff</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.coachDismiss}
                  onPress={() => setQuickSetupDismissed(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.coachDismissText}>Skip now</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Today Schedule / Highlights Card (fs-next-day) */}
          {loading ? (
            <View style={{ paddingHorizontal: horizontalPadding, paddingVertical: 20 }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : hasTodayItems ? (
            <View style={{ paddingHorizontal: horizontalPadding, marginBottom: 12 }}>
              <View style={styles.nextDayCard}>
                <View style={styles.nextHead}>
                  <Text style={styles.nextTitle}>Today</Text>
                  <Text style={styles.nextDate}>{todayDateFormatted()}</Text>
                </View>

                <View style={styles.nextGrid}>
                  {/* Reminders subcard */}
                  {tomorrowReminders.length > 0 && (
                    <View style={styles.nextCard}>
                      <View style={styles.nextCardHead}>
                        <Text style={styles.nextCardTitle}>REMINDERS</Text>
                        <TouchableOpacity onPress={() => router.push('/notes')} activeOpacity={0.7}>
                          <Text style={styles.nextLink}>View All</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.nextList}>
                        {tomorrowReminders.slice(0, 6).map((reminder) => (
                          <TouchableOpacity
                            key={reminder.ulid || reminder.id}
                            style={styles.nextItem}
                            onPress={() =>
                              router.push({
                                pathname: '/note-view',
                                params: { id: reminder.ulid || String(reminder.id) },
                              })
                            }
                            activeOpacity={0.7}
                          >
                            <Text style={styles.nextItemTitle} numberOfLines={1}>
                              {reminder.title}
                            </Text>
                            <View style={styles.nextItemMetaWrap}>
                              <Text style={styles.nextItemMeta}>{reminder.time}</Text>
                              <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Scheduled Activities subcard */}
                  {tomorrowActivities.length > 0 && (
                    <View style={styles.nextCard}>
                      <View style={styles.nextCardHead}>
                        <Text style={styles.nextCardTitle}>SCHEDULED ACTIVITIES</Text>
                        <TouchableOpacity onPress={() => router.push('/farm-hub')} activeOpacity={0.7}>
                          <Text style={styles.nextLink}>View All</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.nextList}>
                        {tomorrowActivities.slice(0, 6).map((act) => (
                          <TouchableOpacity
                            key={act.ulid || act.id}
                            style={styles.nextItem}
                            onPress={() =>
                              router.push({
                                pathname: '/activity-view',
                                params: { id: act.ulid || String(act.id) },
                              })
                            }
                            activeOpacity={0.7}
                          >
                            <Text style={styles.nextItemTitle} numberOfLines={1}>
                              {act.name}
                            </Text>
                            <View style={styles.nextItemMetaWrap}>
                              <Text style={styles.nextItemMeta}>{act.farm_name}</Text>
                              <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ) : null}

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
                <Text style={styles.moduleTitle}>Staff Attendance</Text>
                <Text style={styles.moduleSub}>Daily staff records</Text>
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
                <Text style={styles.moduleTitle}>Staff Payments</Text>
                <Text style={styles.moduleSub}>Track and release payments</Text>
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
              <Text style={styles.moduleTileTitle}>Agro Purchases</Text>
              <Text style={styles.moduleTileSub}>Supplies & tools</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.moduleTile, { width: isTablet ? undefined : gridItemWidth, flex: isTablet ? 1 : undefined }]}
              onPress={() => router.push('/sales')}
              activeOpacity={0.75}
            >
              <View style={[styles.moduleTileIcon, styles.iconGreen]}>
                <Ionicons name="cash-outline" size={20} color="#166534" />
              </View>
              <Text style={styles.moduleTileTitle}>Sales</Text>
              <Text style={styles.moduleTileSub}>Track revenue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.moduleTile, { width: isTablet ? undefined : gridItemWidth, flex: isTablet ? 1 : undefined }]}
              onPress={() => router.push('/farm-hub')}
              activeOpacity={0.75}
            >
              <View style={[styles.moduleTileIcon, styles.iconBlue]}>
                <Ionicons name="calendar-outline" size={20} color="#1d4ed8" />
              </View>
              <Text style={styles.moduleTileTitle}>Farms</Text>
              <Text style={styles.moduleTileSub}>Manage farms</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.moduleTile, { width: isTablet ? undefined : gridItemWidth, flex: isTablet ? 1 : undefined }]}
              onPress={() => router.push('/consultant-visits')}
              activeOpacity={0.75}
            >
              <View style={[styles.moduleTileIcon, styles.iconPurple]}>
                <Ionicons name="briefcase-outline" size={20} color="#6d28d9" />
              </View>
              <Text style={styles.moduleTileTitle}>Consultant Visits</Text>
              <Text style={styles.moduleTileSub}>Manage Visits</Text>
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
                  <Text style={styles.utilityTitle}>Reports</Text>
                  <Text style={styles.utilitySub}>View farm analytics & records</Text>
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
                  <Text style={styles.utilityTitle}>Mandi Prices</Text>
                  <Text style={styles.utilitySub}>Daily government crop prices</Text>
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
                <Text style={styles.profileSheetName}>{user?.name || 'Staff'}</Text>
                <Text style={styles.profileSheetEmail}>{user?.email || 'Signed In'}</Text>
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
                  <Text style={styles.profileActionTitle}>Manage Farms</Text>
                  <Text style={styles.profileActionSub}>Explore and add parcels</Text>
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
                  <Text style={styles.profileActionTitle}>All Modules & Masters</Text>
                  <Text style={styles.profileActionSub}>Crops, products, buyers & tools</Text>
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
              <Text style={styles.logoutBtnText}>Sign Out of MyFarms</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 12,
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

  // 4. Today Highlights (fs-next-day)
  nextDayCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    gap: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 4,
  },
  nextHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  nextDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  nextGrid: {
    gap: 12,
  },
  nextCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    gap: 10,
  },
  nextCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.8,
  },
  nextLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  nextList: {
    gap: 8,
  },
  nextItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    gap: 10,
  },
  nextItemTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  nextItemMetaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  nextItemMeta: {
    fontSize: 11,
    color: '#64748b',
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
