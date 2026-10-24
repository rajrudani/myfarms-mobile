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
  FlatList,
  TextInput,
  SafeAreaView,
  Platform,
  StatusBar,
  useWindowDimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { farmsApi } from '../../src/api/farms';
import { dashboardApi } from '../../src/api/dashboard';
import { Farm, DashboardSummary } from '../../src/types';
import { colors, radius, spacing, shadows, typography } from '../../src/theme/tokens';
import {
  BentoCard,
  MetricTile,
  StatusBadge,
  QuickChipGroup,
  ChipOption,
} from '../../src/components/ui';

const AREA_UNIT_OPTIONS: ChipOption<string>[] = [
  { label: 'Acre', value: 'acre' },
  { label: 'Bigha', value: 'bigha' },
  { label: 'Hectare', value: 'hectare' },
  { label: 'Guntha', value: 'guntha' },
];

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();

  // Responsive Breakpoints
  const isTablet = width >= 768;
  const isWideTablet = width >= 1024;

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);

  // Profile / Account Modal
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  // Quick Setup Banner Dismissal
  const [quickSetupDismissed, setQuickSetupDismissed] = useState(false);

  // Farms Management Modal States
  const [farmsModalVisible, setFarmsModalVisible] = useState(false);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(false);

  // Add Farm Form States
  const [addFarmModalVisible, setAddFarmModalVisible] = useState(false);
  const [farmName, setFarmName] = useState('');
  const [farmArea, setFarmArea] = useState('');
  const [farmAreaUnit, setFarmAreaUnit] = useState('acre');
  const [farmLocation, setFarmLocation] = useState('');
  const [savingFarm, setSavingFarm] = useState(false);
  const [farmNameError, setFarmNameError] = useState('');
  const [farmAreaError, setFarmAreaError] = useState('');

  const fetchFarms = async () => {
    setFarmsLoading(true);
    try {
      const data = await farmsApi.getAll();
      setFarms(data);
    } catch (error) {
      console.error('Error fetching farms:', error);
    } finally {
      setFarmsLoading(false);
    }
  };

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
    fetchFarms();
  }, []);

  useEffect(() => {
    if (farmsModalVisible) {
      fetchFarms();
    }
  }, [farmsModalVisible]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDashboardSummary(), fetchFarms()]);
    setRefreshing(false);
  };

  const handleToggleFarmStatus = async (farm: Farm) => {
    if (!farm.id && !farm.ulid) return;
    const identifier = farm.ulid || farm.id!;
    try {
      const updatedFarm = { ...farm, is_active: !farm.is_active };
      setFarms((prev) =>
        prev.map((f) => (f.ulid === farm.ulid || f.id === farm.id ? updatedFarm : f))
      );
      await farmsApi.update(identifier, updatedFarm);
    } catch (error) {
      console.error('Failed to toggle status:', error);
      Alert.alert('Error', 'Failed to update farm status.');
      fetchFarms();
    }
  };

  const handleCreateFarm = async () => {
    setFarmNameError('');
    setFarmAreaError('');

    let hasError = false;
    if (!farmName.trim()) {
      setFarmNameError('Farm name is required.');
      hasError = true;
    }
    if (!farmArea.trim()) {
      setFarmAreaError('Area size is required.');
      hasError = true;
    } else if (isNaN(Number(farmArea)) || Number(farmArea) <= 0) {
      setFarmAreaError('Area size must be a valid positive number.');
      hasError = true;
    }

    if (hasError) return;
    setSavingFarm(true);
    try {
      const newFarm: Farm = {
        name: farmName.trim(),
        area: parseFloat(farmArea),
        area_unit: farmAreaUnit,
        location: farmLocation.trim() || undefined,
        is_active: true,
      };
      const createdFarm = await farmsApi.create(newFarm);
      setFarmName('');
      setFarmArea('');
      setFarmAreaUnit('acre');
      setFarmLocation('');
      setAddFarmModalVisible(false);
      setFarmsModalVisible(false);
      fetchFarms();
      fetchDashboardSummary();

      // Redirect to newly created farm view page
      router.push({
        pathname: '/farm-view',
        params: {
          farm_id: createdFarm.id,
          farm_ulid: createdFarm.ulid || '',
        },
      });
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Failed to create farm.';
      Alert.alert('Error', msg);
    } finally {
      setSavingFarm(false);
    }
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const todayDateFormatted = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };
    return new Date().toLocaleDateString('en-US', options);
  };

  const getUserInitials = (name?: string) => {
    if (!name) return 'OP';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const remindersCount = dashboardSummary?.today_reminders?.length || 0;
  const activitiesCount = dashboardSummary?.today_activities?.length || 0;
  const activeFarmsCount = dashboardSummary?.counts?.farms_count ?? farms.filter((f) => f.is_active).length;
  const activeStaffCount = dashboardSummary?.counts?.active_staff_count ?? 0;

  const showQuickSetup =
    !quickSetupDismissed &&
    (dashboardSummary?.needs_farm_reminder || dashboardSummary?.needs_staff_reminder);

  // Dynamic layout measurements
  const containerMaxWidth = isWideTablet ? 1080 : isTablet ? 900 : '100%';
  const horizontalPadding = isTablet ? spacing.xxl : spacing.lg;

  // Secondary grid item width calculation
  const gridItemWidth = useMemo(() => {
    const effectiveWidth = Math.min(width, 1080);
    if (isTablet) {
      // 4 cards in 1 row: total width minus padding & 3 gaps
      const totalGaps = 3 * 12;
      const totalPadding = horizontalPadding * 2;
      return (effectiveWidth - totalPadding - totalGaps) / 4;
    }
    // 2 cards in 1 row
    const totalGaps = 12;
    const totalPadding = horizontalPadding * 2;
    return (effectiveWidth - totalPadding - totalGaps) / 2;
  }, [width, isTablet, horizontalPadding]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.slate50} />
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
          {/* Top Bar Header */}
          <View style={[styles.topBar, { paddingHorizontal: horizontalPadding }]}>
            <View style={styles.brandRow}>
              <Image
                source={require('../../assets/images/full-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <View style={styles.tenantPill}>
                <Ionicons name="shield-checkmark" size={11} color={colors.primaryDark} />
                <Text style={styles.tenantPillText} numberOfLines={1}>
                  {user?.farm_group_name || 'MyFarms OS'}
                </Text>
              </View>
            </View>

            <View style={styles.topActions}>
              <TouchableOpacity
                style={styles.actionIconButton}
                onPress={() => router.push('/mandi-prices')}
                activeOpacity={0.7}
                accessibilityLabel="Mandi APMC Prices"
              >
                <Ionicons name="trending-up" size={18} color={colors.primaryDark} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.avatarButton}
                onPress={() => setProfileModalVisible(true)}
                activeOpacity={0.8}
                accessibilityLabel="User Account"
              >
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarInitials}>{getUserInitials(user?.name)}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Greeting Hero Section */}
          <View style={[styles.greetingSection, { paddingHorizontal: horizontalPadding }]}>
            <View style={styles.greetingTextContainer}>
              <Text style={styles.greetingSub}>{getGreeting().toUpperCase()}</Text>
              <Text style={styles.greetingName} numberOfLines={1}>
                {user?.name || 'Farm Operator'} <Text style={styles.greetingHand}>🌱</Text>
              </Text>
            </View>

            <View style={styles.liveBadge}>
              <View style={styles.livePulseDot} />
              <Text style={styles.liveBadgeText}>LIVE COCKPIT</Text>
            </View>
          </View>

          {/* Quick Setup Coach Banner */}
          {showQuickSetup && (
            <View style={[styles.coachBannerWrap, { paddingHorizontal: horizontalPadding }]}>
              <View style={styles.coachBanner}>
                <View style={styles.coachBannerLeft}>
                  <View style={styles.coachIconBox}>
                    <Ionicons name="sparkles" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.coachTextWrap}>
                    <Text style={styles.coachTitle}>Ready to begin your setup?</Text>
                    <Text style={styles.coachSub}>
                      {dashboardSummary?.needs_farm_reminder
                        ? 'Add your first farm plot to begin tracking cycles and work.'
                        : 'Register farm workers to log muster and manage payroll.'}
                    </Text>
                  </View>
                </View>

                <View style={styles.coachActions}>
                  {dashboardSummary?.needs_farm_reminder ? (
                    <TouchableOpacity
                      style={styles.coachPrimaryBtn}
                      onPress={() => setAddFarmModalVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add" size={15} color={colors.white} />
                      <Text style={styles.coachPrimaryBtnText}>Add Farm</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.coachPrimaryBtn}
                      onPress={() => router.push('/staff')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="people" size={15} color={colors.white} />
                      <Text style={styles.coachPrimaryBtnText}>Add Staff</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.coachDismissBtn}
                    onPress={() => setQuickSetupDismissed(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={18} color={colors.slate400} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Metric Tiles Overview */}
          <View
            style={[
              styles.metricsRow,
              { paddingHorizontal: horizontalPadding },
              isTablet && styles.metricsRowTablet,
            ]}
          >
            <MetricTile
              label="Today's Reminders"
              value={remindersCount}
              subtext={remindersCount === 0 ? 'All caught up' : `${remindersCount} action item(s)`}
              iconName="bell-ring-outline"
              iconColor={colors.warning}
              iconBg={colors.warningSurface}
              badgeText={remindersCount > 0 ? `${remindersCount} due` : undefined}
              badgeColor={colors.warning}
              onPress={() => router.push('/notes')}
            />
            <MetricTile
              label="Today's Activities"
              value={activitiesCount}
              subtext={activitiesCount === 0 ? 'No tasks logged' : 'Scheduled operations'}
              iconName="calendar-check-outline"
              iconColor={colors.primary}
              iconBg={colors.primarySurface}
              badgeText={activitiesCount > 0 ? 'Today' : undefined}
              badgeColor={colors.primary}
              onPress={() => router.push('/activities')}
            />

            {/* Extra metrics surfaced on tablet for rich dashboard view */}
            {isTablet && (
              <>
                <MetricTile
                  label="Registered Farms"
                  value={activeFarmsCount}
                  subtext="Active farm plots"
                  iconName="sprout-outline"
                  iconColor={colors.info}
                  iconBg={colors.infoSurface}
                  badgeText="Parcels"
                  badgeColor={colors.info}
                  onPress={() => setFarmsModalVisible(true)}
                />
                <MetricTile
                  label="Field Workforce"
                  value={activeStaffCount}
                  subtext="Operational staff"
                  iconName="account-group-outline"
                  iconColor={colors.purple}
                  iconBg={colors.purpleSurface}
                  badgeText="Roster"
                  badgeColor={colors.purple}
                  onPress={() => router.push('/staff')}
                />
              </>
            )}
          </View>

          {/* Today's Schedule Cockpit */}
          <View style={{ paddingHorizontal: horizontalPadding }}>
            <BentoCard variant="elevated" style={styles.cockpitCard}>
              <View style={styles.cockpitHeader}>
                <View style={styles.cockpitHeaderLeft}>
                  <View style={styles.cockpitCalendarIcon}>
                    <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.cockpitTitle}>Today's Schedule</Text>
                    <Text style={styles.cockpitDate}>{todayDateFormatted()}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.quickAddPill}
                  onPress={() => router.push('/activities')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={15} color={colors.primaryDark} />
                  <Text style={styles.quickAddPillText}>Log Activity</Text>
                </TouchableOpacity>
              </View>

              {/* Schedule Columns: Responsive 2-column on tablet, stacked on mobile */}
              <View style={[styles.scheduleContentWrap, isTablet && styles.scheduleContentWrapTablet]}>
                {/* Reminders Column */}
                <View style={[styles.queueBlock, isTablet && { flex: 1 }]}>
                  <View style={styles.queueHeader}>
                    <View style={styles.queueTitleWrap}>
                      <View style={[styles.queueIconBox, { backgroundColor: colors.warningSurface }]}>
                        <Ionicons name="notifications-outline" size={14} color={colors.warning} />
                      </View>
                      <Text style={styles.queueTitle}>Reminders</Text>
                      {remindersCount > 0 && (
                        <View style={styles.miniBadge}>
                          <Text style={styles.miniBadgeText}>{remindersCount}</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => router.push('/notes')}>
                      <Text style={styles.viewAllLink}>View All ›</Text>
                    </TouchableOpacity>
                  </View>

                  {dashboardSummary && dashboardSummary.today_reminders.length > 0 ? (
                    <View style={styles.queueList}>
                      {dashboardSummary.today_reminders.map((reminder) => (
                        <TouchableOpacity
                          key={reminder.ulid || reminder.id}
                          style={styles.queueItem}
                          onPress={() => router.push('/notes')}
                          activeOpacity={0.7}
                        >
                          <View style={styles.queueItemLeft}>
                            <Ionicons
                              name={reminder.is_overdue ? 'alert-circle' : 'time-outline'}
                              size={16}
                              color={reminder.is_overdue ? colors.danger : colors.slate500}
                            />
                            <Text style={styles.queueItemTitle} numberOfLines={1}>
                              {reminder.title}
                            </Text>
                            {reminder.is_overdue && (
                              <StatusBadge label="Overdue" variant="danger" dot={false} />
                            )}
                          </View>
                          <View style={styles.queueItemRight}>
                            <Text style={styles.queueItemMeta}>{reminder.time}</Text>
                            <Ionicons name="chevron-forward" size={14} color={colors.slate400} />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyQueue}>
                      <Ionicons name="checkmark-done-circle" size={22} color={colors.primary} />
                      <Text style={styles.emptyQueueText}>All caught up! No reminders today</Text>
                    </View>
                  )}
                </View>

                {/* Scheduled Activities Column */}
                <View style={[styles.queueBlock, isTablet && { flex: 1 }, !isTablet && { marginTop: spacing.md }]}>
                  <View style={styles.queueHeader}>
                    <View style={styles.queueTitleWrap}>
                      <View style={[styles.queueIconBox, { backgroundColor: colors.primarySurface }]}>
                        <Ionicons name="leaf-outline" size={14} color={colors.primary} />
                      </View>
                      <Text style={styles.queueTitle}>Activities</Text>
                      {activitiesCount > 0 && (
                        <View style={[styles.miniBadge, { backgroundColor: colors.primarySurface }]}>
                          <Text style={[styles.miniBadgeText, { color: colors.primary }]}>{activitiesCount}</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => router.push('/activities')}>
                      <Text style={styles.viewAllLink}>View All ›</Text>
                    </TouchableOpacity>
                  </View>

                  {dashboardSummary && dashboardSummary.today_activities.length > 0 ? (
                    <View style={styles.queueList}>
                      {dashboardSummary.today_activities.map((act) => (
                        <TouchableOpacity
                          key={act.ulid || act.id}
                          style={styles.queueItem}
                          onPress={() => router.push('/activities')}
                          activeOpacity={0.7}
                        >
                          <View style={styles.queueItemLeft}>
                            <View style={styles.activityDot} />
                            <Text style={styles.queueItemTitle} numberOfLines={1}>
                              {act.name}
                              {act.crop_name ? ` • ${act.crop_name}` : ''}
                            </Text>
                          </View>
                          <View style={styles.queueItemRight}>
                            <Text style={styles.queueItemMeta}>{act.farm_name}</Text>
                            <Ionicons name="chevron-forward" size={14} color={colors.slate400} />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyQueue}>
                      <Ionicons name="calendar-outline" size={22} color={colors.slate400} />
                      <Text style={styles.emptyQueueText}>No operations scheduled for today</Text>
                    </View>
                  )}
                </View>
              </View>
            </BentoCard>
          </View>

          {/* Section: Daily Workforce Operations */}
          <View style={[styles.sectionHeadingWrap, { paddingHorizontal: horizontalPadding }]}>
            <Text style={styles.sectionHeading}>DAILY WORKFORCE</Text>
            <Text style={styles.sectionHeadingSub}>Staff attendance & wage settlements</Text>
          </View>

          <View
            style={[
              styles.primaryModules,
              { paddingHorizontal: horizontalPadding },
              isTablet && styles.primaryModulesTablet,
            ]}
          >
            <TouchableOpacity
              style={[styles.primaryModuleCard, isTablet && { flex: 1 }]}
              onPress={() => router.push({ pathname: '/staff', params: { tab: 'attendance' } })}
              activeOpacity={0.75}
            >
              <View style={[styles.moduleIconBox, { backgroundColor: colors.primarySurface }]}>
                <Ionicons name="clipboard-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.primaryModuleBody}>
                <View style={styles.primaryModuleTop}>
                  <Text style={styles.primaryModuleTitle}>Staff Attendance</Text>
                  <View style={styles.pillTag}>
                    <Text style={styles.pillTagText}>Daily Muster</Text>
                  </View>
                </View>
                <Text style={styles.primaryModuleSub}>Mark daily presence, half-days & worker shifts</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryModuleCard, isTablet && { flex: 1 }]}
              onPress={() => router.push({ pathname: '/staff', params: { tab: 'payments' } })}
              activeOpacity={0.75}
            >
              <View style={[styles.moduleIconBox, { backgroundColor: colors.accentSurface }]}>
                <MaterialCommunityIcons name="account-cash-outline" size={24} color={colors.accentDark} />
              </View>
              <View style={styles.primaryModuleBody}>
                <View style={styles.primaryModuleTop}>
                  <Text style={styles.primaryModuleTitle}>Staff Payments</Text>
                  <View style={[styles.pillTag, { backgroundColor: colors.accentSurface }]}>
                    <Text style={[styles.pillTagText, { color: colors.accentDark }]}>Wages</Text>
                  </View>
                </View>
                <Text style={styles.primaryModuleSub}>Track advances, daily payouts & balances</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
            </TouchableOpacity>
          </View>

          {/* Section: Core Farm Operations Dock */}
          <View style={[styles.sectionHeadingWrap, { paddingHorizontal: horizontalPadding, marginTop: spacing.md }]}>
            <Text style={styles.sectionHeading}>FARM OPERATIONS</Text>
            <Text style={styles.sectionHeadingSub}>Tactile access to inputs, sales & advisory</Text>
          </View>

          {/* Bento Grid: 2x2 on Mobile, 4 in row on Tablet */}
          <View
            style={[
              styles.operationsGrid,
              { paddingHorizontal: horizontalPadding },
              isTablet && styles.operationsGridTablet,
            ]}
          >
            <TouchableOpacity
              style={[styles.bentoTile, { width: isTablet ? undefined : gridItemWidth, flex: isTablet ? 1 : undefined }]}
              onPress={() => router.push('/agro-shop')}
              activeOpacity={0.75}
            >
              <View style={[styles.bentoTileIcon, { backgroundColor: colors.accentSurface }]}>
                <Ionicons name="cart-outline" size={22} color={colors.accentDark} />
              </View>
              <Text style={styles.bentoTileTitle}>Agro Purchases</Text>
              <Text style={styles.bentoTileSub}>Seeds, fertilizers & shop bills</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bentoTile, { width: isTablet ? undefined : gridItemWidth, flex: isTablet ? 1 : undefined }]}
              onPress={() => router.push('/sales')}
              activeOpacity={0.75}
            >
              <View style={[styles.bentoTileIcon, { backgroundColor: colors.primarySurface }]}>
                <Ionicons name="cash-outline" size={22} color={colors.primary} />
              </View>
              <Text style={styles.bentoTileTitle}>Crop Sales</Text>
              <Text style={styles.bentoTileSub}>Harvest produce & buyer orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bentoTile, { width: isTablet ? undefined : gridItemWidth, flex: isTablet ? 1 : undefined }]}
              onPress={() => setFarmsModalVisible(true)}
              activeOpacity={0.75}
            >
              <View style={[styles.bentoTileIcon, { backgroundColor: colors.infoSurface }]}>
                <Ionicons name="grid-outline" size={22} color={colors.info} />
              </View>
              <Text style={styles.bentoTileTitle}>Manage Farms</Text>
              <Text style={styles.bentoTileSub}>Parcels, area & boundaries</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bentoTile, { width: isTablet ? undefined : gridItemWidth, flex: isTablet ? 1 : undefined }]}
              onPress={() => router.push('/consultant-visits')}
              activeOpacity={0.75}
            >
              <View style={[styles.bentoTileIcon, { backgroundColor: colors.purpleSurface }]}>
                <Ionicons name="briefcase-outline" size={22} color={colors.purple} />
              </View>
              <Text style={styles.bentoTileTitle}>Advisory Visits</Text>
              <Text style={styles.bentoTileSub}>Agronomist & soil checks</Text>
            </TouchableOpacity>
          </View>

          {/* Section: Intelligence & Market Benchmarks */}
          <View style={[styles.sectionHeadingWrap, { paddingHorizontal: horizontalPadding, marginTop: spacing.md }]}>
            <Text style={styles.sectionHeading}>INTELLIGENCE & BENCHMARKS</Text>
            <Text style={styles.sectionHeadingSub}>Analytics, exports & APMC wholesale rates</Text>
          </View>

          <View
            style={[
              styles.utilitySection,
              { paddingHorizontal: horizontalPadding },
              isTablet && styles.utilitySectionTablet,
            ]}
          >
            <TouchableOpacity
              style={[styles.utilityCard, isTablet && { flex: 1 }]}
              onPress={() => router.push('/reports')}
              activeOpacity={0.75}
            >
              <View style={[styles.utilityIcon, { backgroundColor: colors.infoSurface }]}>
                <Ionicons name="bar-chart-outline" size={22} color={colors.info} />
              </View>
              <View style={styles.utilityInfo}>
                <Text style={styles.utilityTitle}>Analytics & Reports</Text>
                <Text style={styles.utilitySub}>Export balance sheets, muster & harvest summaries</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.slate400} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.utilityCard, isTablet && { flex: 1, marginTop: 0 }]}
              onPress={() => router.push('/mandi-prices')}
              activeOpacity={0.75}
            >
              <View style={[styles.utilityIcon, { backgroundColor: colors.primarySurface }]}>
                <Ionicons name="trending-up" size={22} color={colors.primary} />
              </View>
              <View style={styles.utilityInfo}>
                <Text style={styles.utilityTitle}>Mandi Market Rates</Text>
                <Text style={styles.utilitySub}>Live APMC wholesale benchmarks across India</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.slate400} />
            </TouchableOpacity>
          </View>

          {/* Clean App Footer */}
          <View style={styles.footerWrap}>
            <Text style={styles.footerBrand}>MYFARMS AGRI-OS • {new Date().getFullYear()}</Text>
            <Text style={styles.footerVersion}>Version 2.0 Native Edition</Text>
          </View>
        </View>
      </ScrollView>

      {/* Profile / Account Action Modal */}
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
              <View style={styles.profileSheetAvatar}>
                <Text style={styles.profileSheetAvatarText}>{getUserInitials(user?.name)}</Text>
              </View>
              <View style={styles.profileSheetInfo}>
                <Text style={styles.profileSheetName}>{user?.name || 'Farm Operator'}</Text>
                <Text style={styles.profileSheetEmail}>{user?.email || 'Authenticated User'}</Text>
                <View style={styles.roleTag}>
                  <Text style={styles.roleTagText}>{user?.user_type?.toUpperCase() || 'FARM OPERATOR'}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setProfileModalVisible(false)}
                style={styles.profileCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.slate500} />
              </TouchableOpacity>
            </View>

            <View style={styles.profileDivider} />

            <View style={styles.profileActionList}>
              <TouchableOpacity
                style={styles.profileActionItem}
                onPress={() => {
                  setProfileModalVisible(false);
                  setFarmsModalVisible(true);
                }}
              >
                <View style={[styles.profileActionIcon, { backgroundColor: colors.infoSurface }]}>
                  <Ionicons name="grid-outline" size={18} color={colors.info} />
                </View>
                <View style={styles.profileActionTextWrap}>
                  <Text style={styles.profileActionTitle}>Manage Farms</Text>
                  <Text style={styles.profileActionSub}>{activeFarmsCount} registered parcels</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.slate400} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileActionItem}
                onPress={() => {
                  setProfileModalVisible(false);
                  router.push('/more');
                }}
              >
                <View style={[styles.profileActionIcon, { backgroundColor: colors.slate100 }]}>
                  <Ionicons name="apps-outline" size={18} color={colors.slate700} />
                </View>
                <View style={styles.profileActionTextWrap}>
                  <Text style={styles.profileActionTitle}>System Registry</Text>
                  <Text style={styles.profileActionSub}>Crops, buyers & activity masters</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.slate400} />
              </TouchableOpacity>
            </View>

            <View style={styles.profileDivider} />

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogoutPrompt}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              <Text style={styles.logoutBtnText}>Sign Out of MyFarms</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Farms List Modal Sheet */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={farmsModalVisible}
        onRequestClose={() => setFarmsModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setFarmsModalVisible(false)} style={styles.modalBackBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.slate800} />
              <Text style={styles.modalBackText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Manage Farms</Text>
            <TouchableOpacity
              onPress={() => {
                setFarmNameError('');
                setFarmAreaError('');
                setAddFarmModalVisible(true);
              }}
              style={styles.modalAddBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color={colors.white} />
              <Text style={styles.modalAddText}>Add Farm</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.modalBodyContainer, { maxWidth: isTablet ? 760 : '100%', alignSelf: 'center', width: '100%' }]}>
            {farmsLoading ? (
              <View style={styles.loadingCenter}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading farm parcels...</Text>
              </View>
            ) : (
              <FlatList
                data={farms}
                keyExtractor={(item, index) => item.ulid || item.id?.toString() || index.toString()}
                contentContainerStyle={styles.farmListContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <BentoCard variant="elevated" style={styles.farmItemCard}>
                    <View style={styles.farmItemTop}>
                      <View style={styles.farmItemMain}>
                        <View style={styles.farmIconBadge}>
                          <MaterialCommunityIcons name="sprout" size={20} color={colors.primary} />
                        </View>
                        <View>
                          <Text style={styles.farmNameText}>{item.name}</Text>
                          {item.location ? (
                            <View style={styles.farmLocRow}>
                              <Ionicons name="location-outline" size={12} color={colors.slate500} />
                              <Text style={styles.farmLocText}>{item.location}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleToggleFarmStatus(item)}
                        activeOpacity={0.7}
                      >
                        <StatusBadge
                          label={item.is_active ? 'Active' : 'Inactive'}
                          variant={item.is_active ? 'success' : 'neutral'}
                          dot
                        />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.farmItemDivider} />

                    <View style={styles.farmItemBottom}>
                      <View>
                        <Text style={styles.farmAreaLabel}>Total Area</Text>
                        <Text style={styles.farmAreaValue}>
                          {item.area} <Text style={styles.farmAreaUnit}>{item.area_unit.toLowerCase()}(s)</Text>
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.farmInspectBtn}
                        onPress={() => {
                          setFarmsModalVisible(false);
                          router.push({
                            pathname: '/farm-view',
                            params: {
                              farm_id: item.id,
                              farm_ulid: item.ulid || '',
                            },
                          });
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.farmInspectText}>Open Farm View ›</Text>
                      </TouchableOpacity>
                    </View>
                  </BentoCard>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="leaf-outline" size={48} color={colors.slate300} />
                    <Text style={styles.emptyTitle}>No farms registered</Text>
                    <Text style={styles.emptySubtitle}>Tap "+ Add Farm" to record your first farm parcel.</Text>
                  </View>
                }
              />
            )}
          </View>
        </SafeAreaView>

        {/* Add Farm Form Modal Overlay */}
        <Modal
          animationType="fade"
          transparent
          visible={addFarmModalVisible}
          onRequestClose={() => setAddFarmModalVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.overlayBg}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={[styles.modalFormCard, { maxWidth: isTablet ? 540 : '100%', alignSelf: 'center', width: '100%' }]}>
              <View style={styles.modalFormHeader}>
                <View style={styles.modalFormTitleRow}>
                  <View style={[styles.iconBoxMini, { backgroundColor: colors.primarySurface }]}>
                    <Ionicons name="leaf" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.modalFormTitle}>Add New Farm Plot</Text>
                </View>
                <TouchableOpacity onPress={() => setAddFarmModalVisible(false)} style={styles.modalCloseCircle}>
                  <Ionicons name="close" size={20} color={colors.slate500} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>
                Farm Name <Text style={styles.asterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.inputBox, farmNameError ? styles.inputError : null]}
                placeholder="e.g. Green Valley Farm"
                placeholderTextColor={colors.slate400}
                value={farmName}
                onChangeText={(text) => {
                  setFarmName(text);
                  if (text.trim()) setFarmNameError('');
                }}
              />
              {farmNameError ? <Text style={styles.errorCaption}>{farmNameError}</Text> : null}

              <Text style={styles.inputLabel}>
                Area Size <Text style={styles.asterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.inputBox, farmAreaError ? styles.inputError : null]}
                placeholder="e.g. 12.5"
                placeholderTextColor={colors.slate400}
                keyboardType="decimal-pad"
                value={farmArea}
                onChangeText={(text) => {
                  setFarmArea(text);
                  if (text.trim()) setFarmAreaError('');
                }}
              />
              {farmAreaError ? <Text style={styles.errorCaption}>{farmAreaError}</Text> : null}

              <Text style={styles.inputLabel}>Area Measurement Unit</Text>
              <QuickChipGroup
                options={AREA_UNIT_OPTIONS}
                selectedValue={farmAreaUnit}
                onSelect={(val) => setFarmAreaUnit(val)}
                size="sm"
              />

              <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Location (Optional)</Text>
              <TextInput
                style={styles.inputBox}
                placeholder="e.g. Sector 4, North Zone"
                placeholderTextColor={colors.slate400}
                value={farmLocation}
                onChangeText={setFarmLocation}
              />

              <View style={styles.formButtonRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => setAddFarmModalVisible(false)}
                  disabled={savingFarm}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalBtnCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSave]}
                  onPress={handleCreateFarm}
                  disabled={savingFarm}
                  activeOpacity={0.8}
                >
                  {savingFarm ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.modalBtnSaveText}>Save Farm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  scrollContent: {
    flexGrow: 1,
  },
  mainWrapper: {
    paddingBottom: 24,
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 10 : 12,
    paddingBottom: spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 132,
    height: 36,
  },
  tenantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    maxWidth: 140,
  },
  tenantPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  avatarButton: {
    borderRadius: radius.pill,
  },
  avatarBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.slate900,
  },

  // Greeting Hero
  greetingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  greetingTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  greetingSub: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.slate400,
    letterSpacing: 1.2,
  },
  greetingName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.slate900,
    marginTop: 2,
    letterSpacing: -0.3,
  },
  greetingHand: {
    fontSize: 20,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.8,
  },

  // Coach Setup Banner
  coachBannerWrap: {
    marginBottom: spacing.md,
  },
  coachBanner: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.subtle,
  },
  coachBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  coachIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachTextWrap: {
    flex: 1,
  },
  coachTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.slate900,
  },
  coachSub: {
    fontSize: 11,
    color: colors.slate500,
    marginTop: 2,
    lineHeight: 15,
  },
  coachActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coachPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  coachPrimaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  coachDismissBtn: {
    padding: 4,
  },

  // Metrics Grid
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  metricsRowTablet: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  // Cockpit Card
  cockpitCard: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  cockpitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  cockpitHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cockpitCalendarIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cockpitTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate900,
  },
  cockpitDate: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate500,
    marginTop: 1,
  },
  quickAddPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  quickAddPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  scheduleContentWrap: {
    flexDirection: 'column',
  },
  scheduleContentWrapTablet: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  queueBlock: {
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  queueTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  queueIconBox: {
    width: 24,
    height: 24,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.slate700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  miniBadge: {
    backgroundColor: colors.warningSurface,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  miniBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.warning,
  },
  viewAllLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  queueList: {
    gap: 6,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  queueItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 10,
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  queueItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate800,
    flexShrink: 1,
  },
  queueItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  queueItemMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate500,
  },
  emptyQueue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  emptyQueueText: {
    fontSize: 12,
    color: colors.slate500,
    fontWeight: '600',
  },

  // Section Headers
  sectionHeadingWrap: {
    marginBottom: spacing.xs,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.slate400,
    letterSpacing: 1.2,
  },
  sectionHeadingSub: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate700,
    marginTop: 2,
  },

  // Primary Modules (Staff)
  primaryModules: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  primaryModulesTablet: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryModuleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    ...shadows.subtle,
  },
  moduleIconBox: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  primaryModuleBody: {
    flex: 1,
  },
  primaryModuleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryModuleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.slate900,
  },
  pillTag: {
    backgroundColor: colors.primarySurface,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  pillTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  primaryModuleSub: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 2,
  },

  // Operations Bento Grid
  operationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: spacing.md,
  },
  operationsGridTablet: {
    flexWrap: 'nowrap',
    gap: 12,
  },
  bentoTile: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    ...shadows.subtle,
  },
  bentoTileIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  bentoTileTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.slate900,
  },
  bentoTileSub: {
    fontSize: 11,
    color: colors.slate500,
    marginTop: 3,
    lineHeight: 15,
  },

  // Utility Section
  utilitySection: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  utilitySectionTablet: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  utilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  utilityIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  utilityInfo: {
    flex: 1,
  },
  utilityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
  utilitySub: {
    fontSize: 11,
    color: colors.slate500,
    marginTop: 2,
  },

  // Footer
  footerWrap: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: 4,
  },
  footerBrand: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.slate400,
  },
  footerVersion: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.slate400,
  },

  // User Profile Sheet Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  profileSheetCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.medium,
  },
  profileSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileSheetAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSheetAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
  },
  profileSheetInfo: {
    flex: 1,
  },
  profileSheetName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate900,
  },
  profileSheetEmail: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 1,
  },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySurface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  profileCloseBtn: {
    padding: 6,
  },
  profileDivider: {
    height: 1,
    backgroundColor: colors.slate100,
    marginVertical: spacing.md,
  },
  profileActionList: {
    gap: 10,
  },
  profileActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  profileActionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileActionTextWrap: {
    flex: 1,
  },
  profileActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
  profileActionSub: {
    fontSize: 11,
    color: colors.slate500,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },

  // Farms Management Modal
  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  modalBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  modalBackText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.slate800,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.slate900,
  },
  modalAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  modalAddText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  modalBodyContainer: {
    flex: 1,
  },
  farmListContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  farmItemCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  farmItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  farmItemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  farmIconBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate900,
  },
  farmLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  farmLocText: {
    fontSize: 12,
    color: colors.slate500,
  },
  farmItemDivider: {
    height: 1,
    backgroundColor: colors.slate100,
    marginVertical: spacing.sm,
  },
  farmItemBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  farmAreaLabel: {
    fontSize: 11,
    color: colors.slate400,
    fontWeight: '600',
  },
  farmAreaValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.slate800,
  },
  farmAreaUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.slate500,
  },
  farmInspectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  farmInspectText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.slate500,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate700,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.slate400,
    marginTop: 4,
    textAlign: 'center',
  },

  // Modal Form Overlay
  overlayBg: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalFormCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.medium,
  },
  modalFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalFormTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBoxMini: {
    width: 28,
    height: 28,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFormTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.slate900,
  },
  modalCloseCircle: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate700,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  asterisk: {
    color: colors.danger,
  },
  inputBox: {
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate200,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.slate900,
  },
  inputError: {
    borderColor: colors.danger,
    borderWidth: 1.5,
  },
  errorCaption: {
    fontSize: 11,
    color: colors.danger,
    marginTop: 4,
    fontWeight: '600',
  },
  formButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.lg,
  },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    backgroundColor: colors.slate100,
  },
  modalBtnCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate700,
  },
  modalBtnSave: {
    backgroundColor: colors.primary,
  },
  modalBtnSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
