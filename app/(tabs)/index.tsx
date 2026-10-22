import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { farmsApi } from '../../src/api/farms';
import { dashboardApi } from '../../src/api/dashboard';
import { Farm, DashboardSummary } from '../../src/types';
import { colors, radius, spacing, shadows } from '../../src/theme/tokens';
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
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);

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
    }
  };

  useEffect(() => {
    fetchDashboardSummary();
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
        name: farmName,
        area: parseFloat(farmArea),
        area_unit: farmAreaUnit,
        location: farmLocation || undefined,
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

      // Redirect to the newly created farm view page
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

  const todayDateFormatted = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };
    return new Date().toLocaleDateString('en-US', options);
  };

  const remindersCount = dashboardSummary?.today_reminders?.length || 0;
  const activitiesCount = dashboardSummary?.today_activities?.length || 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.slate50} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
        {/* Futuristic Top Bar */}
        <View style={styles.topBar}>
          <Image
            source={require('../../assets/images/full-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.topActions}>
            <TouchableOpacity
              style={styles.actionIconButton}
              onPress={() => router.push('/mandi-prices')}
              activeOpacity={0.7}
            >
              <Ionicons name="trending-up" size={20} color={colors.slate700} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarButton}
              onPress={logout}
              activeOpacity={0.7}
            >
              <View style={styles.avatarGlow}>
                <Ionicons name="log-out-outline" size={18} color={colors.slate900} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Ambient Greeting Header */}
        <View style={styles.greetingSection}>
          <View>
            <Text style={styles.greetingSub}>WELCOME BACK</Text>
            <Text style={styles.greetingName}>
              {user?.name || 'Farm Operator'} <Text style={styles.greetingHand}>🌱</Text>
            </Text>
          </View>
          <View style={styles.livePulseContainer}>
            <View style={styles.livePulseDot} />
            <Text style={styles.livePulseText}>LIVE COCKPIT</Text>
          </View>
        </View>

        {/* Glanceable Bento Metrics */}
        <View style={styles.metricsRow}>
          <MetricTile
            label="Today's Reminders"
            value={remindersCount}
            subtext={remindersCount === 0 ? 'All caught up' : 'Needs attention'}
            iconName="bell-ring-outline"
            iconColor={colors.warning}
            iconBg={colors.warningSurface}
            badgeText={remindersCount > 0 ? `${remindersCount} pending` : undefined}
            badgeColor={colors.warning}
            onPress={() => router.push('/notes')}
          />
          <MetricTile
            label="Scheduled Activities"
            value={activitiesCount}
            subtext={activitiesCount === 0 ? 'No tasks logged' : 'Assigned tasks'}
            iconName="calendar-check-outline"
            iconColor={colors.primary}
            iconBg={colors.primarySurface}
            badgeText={activitiesCount > 0 ? 'Today' : undefined}
            badgeColor={colors.primary}
            onPress={() => router.push('/activities')}
          />
        </View>

        {/* Today Action Queue Cockpit */}
        <BentoCard variant="elevated" style={styles.cockpitCard}>
          <View style={styles.cockpitHeader}>
            <View>
              <Text style={styles.cockpitTitle}>Today's Schedule</Text>
              <Text style={styles.cockpitDate}>{todayDateFormatted()}</Text>
            </View>
            <TouchableOpacity
              style={styles.quickAddPill}
              onPress={() => router.push('/activities')}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.quickAddPillText}>Activity</Text>
            </TouchableOpacity>
          </View>

          {/* Sub-section: Reminders */}
          <View style={styles.queueBlock}>
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
                <Ionicons name="checkmark-done-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.emptyQueueText}>No pending reminders for today</Text>
              </View>
            )}
          </View>

          {/* Sub-section: Scheduled Activities */}
          <View style={[styles.queueBlock, { marginTop: spacing.md }]}>
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
                      <Text style={styles.queueItemTitle} numberOfLines={1}>
                        {act.name}
                        {act.crop_name ? ` (${act.crop_name})` : ''}
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
                <Ionicons name="calendar-outline" size={20} color={colors.slate400} />
                <Text style={styles.emptyQueueText}>No farm activities scheduled for today</Text>
              </View>
            )}
          </View>
        </BentoCard>

        {/* Section Header: Fast Operations */}
        <View style={styles.sectionHeadingWrap}>
          <Text style={styles.sectionHeading}>OPERATIONS DOCK</Text>
          <Text style={styles.sectionHeadingSub}>Tactile single-tap access</Text>
        </View>

        {/* Primary Operations: Staff Attendance & Payments Banner Cards */}
        <View style={styles.primaryModules}>
          <TouchableOpacity
            style={styles.primaryModuleCard}
            onPress={() => router.push({ pathname: '/staff', params: { tab: 'attendance' } })}
            activeOpacity={0.8}
          >
            <View style={[styles.moduleIconBox, { backgroundColor: colors.primarySurface }]}>
              <Ionicons name="checkbox-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.primaryModuleBody}>
              <View style={styles.primaryModuleTop}>
                <Text style={styles.primaryModuleTitle}>Staff Attendance</Text>
                <View style={styles.pillTag}>
                  <Text style={styles.pillTagText}>Daily</Text>
                </View>
              </View>
              <Text style={styles.primaryModuleSub}>Mark daily muster & worker shifts</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryModuleCard}
            onPress={() => router.push({ pathname: '/staff', params: { tab: 'payments' } })}
            activeOpacity={0.8}
          >
            <View style={[styles.moduleIconBox, { backgroundColor: colors.accentSurface }]}>
              <MaterialCommunityIcons name="account-cash-outline" size={22} color={colors.accentDark} />
            </View>
            <View style={styles.primaryModuleBody}>
              <View style={styles.primaryModuleTop}>
                <Text style={styles.primaryModuleTitle}>Staff Payments</Text>
                <View style={[styles.pillTag, { backgroundColor: colors.accentSurface }]}>
                  <Text style={[styles.pillTagText, { color: colors.accentDark }]}>Wages</Text>
                </View>
              </View>
              <Text style={styles.primaryModuleSub}>Track advances, daily & monthly payouts</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
          </TouchableOpacity>
        </View>

        {/* Bento Grid: 4 Secondary Modules */}
        <View style={styles.grid2x2}>
          <TouchableOpacity
            style={styles.bentoTile}
            onPress={() => router.push('/agro-shop')}
            activeOpacity={0.8}
          >
            <View style={[styles.bentoTileIcon, { backgroundColor: colors.accentSurface }]}>
              <Ionicons name="cart-outline" size={22} color={colors.accentDark} />
            </View>
            <Text style={styles.bentoTileTitle}>Agro Purchases</Text>
            <Text style={styles.bentoTileSub}>Seeds, fertilizers & supplies</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bentoTile}
            onPress={() => router.push('/sales')}
            activeOpacity={0.8}
          >
            <View style={[styles.bentoTileIcon, { backgroundColor: colors.primarySurface }]}>
              <Ionicons name="cash-outline" size={22} color={colors.primary} />
            </View>
            <Text style={styles.bentoTileTitle}>Crop Sales</Text>
            <Text style={styles.bentoTileSub}>Produce orders & revenue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bentoTile}
            onPress={() => setFarmsModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.bentoTileIcon, { backgroundColor: colors.infoSurface }]}>
              <Ionicons name="grid-outline" size={22} color={colors.info} />
            </View>
            <Text style={styles.bentoTileTitle}>Manage Farms</Text>
            <Text style={styles.bentoTileSub}>Plot boundaries & area</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bentoTile}
            onPress={() => router.push('/consultant-visits')}
            activeOpacity={0.8}
          >
            <View style={[styles.bentoTileIcon, { backgroundColor: colors.purpleSurface }]}>
              <Ionicons name="calendar-outline" size={22} color={colors.purple} />
            </View>
            <Text style={styles.bentoTileTitle}>Advisory Visits</Text>
            <Text style={styles.bentoTileSub}>Agronomist & soil checks</Text>
          </TouchableOpacity>
        </View>

        {/* Analytics & Mandi Utilities Bar */}
        <View style={styles.utilitySection}>
          <TouchableOpacity
            style={styles.utilityCard}
            onPress={() => router.push('/reports')}
            activeOpacity={0.8}
          >
            <View style={[styles.utilityIcon, { backgroundColor: colors.infoSurface }]}>
              <Ionicons name="document-text-outline" size={20} color={colors.info} />
            </View>
            <View style={styles.utilityInfo}>
              <Text style={styles.utilityTitle}>Analytics & Reports</Text>
              <Text style={styles.utilitySub}>Export balance sheets & crop harvest stats</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.slate400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.utilityCard, { marginTop: spacing.sm }]}
            onPress={() => router.push('/mandi-prices')}
            activeOpacity={0.8}
          >
            <View style={[styles.utilityIcon, { backgroundColor: colors.primarySurface }]}>
              <Ionicons name="trending-up" size={20} color={colors.primary} />
            </View>
            <View style={styles.utilityInfo}>
              <Text style={styles.utilityTitle}>Mandi Market Prices</Text>
              <Text style={styles.utilitySub}>Live APMC wholesale agricultural benchmarks</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.slate400} />
          </TouchableOpacity>
        </View>

        <Text style={styles.footerBrand}>
          POWERED BY AGRI-OS • {new Date().getFullYear()}
        </Text>
      </ScrollView>

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
            >
              <Ionicons name="add" size={18} color={colors.white} />
              <Text style={styles.modalAddText}>Add Farm</Text>
            </TouchableOpacity>
          </View>

          {farmsLoading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading farm plots...</Text>
            </View>
          ) : (
            <FlatList
              data={farms}
              keyExtractor={(item, index) => item.ulid || item.id?.toString() || index.toString()}
              contentContainerStyle={styles.farmListContent}
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
                  <Text style={styles.emptySubtitle}>Tap "+ Add Farm" to record your first farm plot.</Text>
                </View>
              }
            />
          )}
        </SafeAreaView>

        {/* Add Farm Form Modal Overlay */}
        <Modal
          animationType="fade"
          transparent
          visible={addFarmModalVisible}
          onRequestClose={() => setAddFarmModalVisible(false)}
        >
          <View style={styles.overlayBg}>
            <View style={styles.modalFormCard}>
              <View style={styles.modalFormHeader}>
                <Text style={styles.modalFormTitle}>Add New Farm Plot</Text>
                <TouchableOpacity onPress={() => setAddFarmModalVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.slate500} />
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
                >
                  <Text style={styles.modalBtnCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSave]}
                  onPress={handleCreateFarm}
                  disabled={savingFarm}
                >
                  {savingFarm ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.modalBtnSaveText}>Save Farm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
    paddingBottom: 36,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 12,
    paddingBottom: spacing.sm,
  },
  logo: {
    width: 140,
    height: 38,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconButton: {
    width: 40,
    height: 40,
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
  avatarGlow: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.accentLight,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  greetingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
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
  },
  greetingHand: {
    fontSize: 20,
  },
  livePulseContainer: {
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
    backgroundColor: colors.primaryLight,
  },
  livePulseText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  cockpitCard: {
    marginHorizontal: spacing.lg,
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
  cockpitTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate900,
  },
  cockpitDate: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate500,
    marginTop: 2,
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
    color: colors.primary,
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
    paddingVertical: 8,
    justifyContent: 'center',
  },
  emptyQueueText: {
    fontSize: 12,
    color: colors.slate500,
    fontWeight: '500',
  },
  sectionHeadingWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
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
  primaryModules: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  pillTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  primaryModuleSub: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 2,
  },
  grid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg - 4,
    gap: 8,
    marginBottom: spacing.md,
  },
  bentoTile: {
    width: '48.5%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    ...shadows.subtle,
  },
  bentoTileIcon: {
    width: 40,
    height: 40,
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
  },
  utilitySection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
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
  footerBrand: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.slate400,
    marginTop: spacing.lg,
  },

  // Farms Modal
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
  modalFormTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.slate900,
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
