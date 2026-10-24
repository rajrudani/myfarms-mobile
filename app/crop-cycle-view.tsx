import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
  Image,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cropCyclesApi } from '../src/api/cropCycles';
import { farmActivitiesApi } from '../src/api/farmActivities';
import { expensesApi } from '../src/api/expenses';
import { salesApi } from '../src/api/sales';
import { farmsApi } from '../src/api/farms';
import { mastersApi } from '../src/api/masters';
import {
  CropCycle,
  FarmActivity,
  FarmExpense,
  Sale,
  Farm,
  FarmActivityMaster,
  Crop,
} from '../src/types';
import { extractErrorMessage, getBaseUrl } from '../src/api/client';
import { colors, radius, spacing, shadows } from '../src/theme/tokens';
import { QuickChipGroup, ChipOption } from '../src/components/ui';

export const getAbsoluteImageUrl = (urlPath?: string | null) => {
  if (!urlPath) return undefined;
  if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) {
    return urlPath;
  }
  const apiBase = getBaseUrl().replace('/api', '');
  return `${apiBase}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
};

const AREA_UNIT_OPTIONS: ChipOption<string>[] = [
  { label: 'Acre', value: 'acre' },
  { label: 'Bigha', value: 'bigha' },
  { label: 'Hectare', value: 'hectare' },
  { label: 'Guntha', value: 'guntha' },
];

const EXPENSE_CATEGORIES = [
  'Seeds / Saplings',
  'Fertilizers',
  'Pesticides / Fungicides',
  'Labor / Wages',
  'Irrigation / Water',
  'Machinery / Tractor Rental',
  'Fuel / Electricity',
  'Packaging / Crates',
  'Transport / Freight',
  'Consulting / Inspection',
  'Other Operational',
];

export default function CropCycleViewScreen() {
  const params = useLocalSearchParams();
  const cycleIdentifier = (params.cycle_ulid as string) || (params.ulid as string) || (params.cycle_id as string) || (params.id as string);

  const [cycle, setCycle] = useState<CropCycle | null>(null);
  const [farm, setFarm] = useState<Farm | null>(null);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [expenses, setExpenses] = useState<FarmExpense[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [activityMasters, setActivityMasters] = useState<FarmActivityMaster[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [imageError, setImageError] = useState(false);

  // Pagination states (5 records per page, matching PWA)
  const PER_PAGE = 5;
  const [activityPage, setActivityPage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);
  const [salePage, setSalePage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [editCycleModalVisible, setEditCycleModalVisible] = useState(false);
  const [harvestModalVisible, setHarvestModalVisible] = useState(false);
  const [editNotesModalVisible, setEditNotesModalVisible] = useState(false);
  const [addActivityModalVisible, setAddActivityModalVisible] = useState(false);
  const [addExpenseModalVisible, setAddExpenseModalVisible] = useState(false);

  // Edit Cycle form state
  const [editCropType, setEditCropType] = useState('');
  const [editAllocatedArea, setEditAllocatedArea] = useState('');
  const [editAllocatedAreaUnit, setEditAllocatedAreaUnit] = useState('acre');
  const [editSeasonName, setEditSeasonName] = useState('');
  const [editStartedOn, setEditStartedOn] = useState('');
  const [editExpectedHarvestOn, setEditExpectedHarvestOn] = useState('');
  const [updatingCycle, setUpdatingCycle] = useState(false);

  // Harvest form state
  const [harvestDate, setHarvestDate] = useState('');
  const [harvestAmount, setHarvestAmount] = useState('');
  const [harvestUnit, setHarvestUnit] = useState('KG');
  const [savingHarvest, setSavingHarvest] = useState(false);

  // Notes form state
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Quick Add Activity form state
  const [selectedActivityMasterId, setSelectedActivityMasterId] = useState<string | number>('');
  const [activityDate, setActivityDate] = useState('');
  const [activityNotes, setActivityNotes] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);

  // Quick Add Expense form state
  const [expenseCategory, setExpenseCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState('cash');
  const [expensePaymentStatus, setExpensePaymentStatus] = useState('completed');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);

  const fetchCycleData = useCallback(async () => {
    if (!cycleIdentifier) return;
    try {
      const cycleData = await cropCyclesApi.getById(cycleIdentifier);
      setCycle(cycleData);

      // Populate edit states
      setEditCropType(cycleData.crop_type || '');
      setEditAllocatedArea(cycleData.allocated_area?.toString() || '');
      setEditAllocatedAreaUnit(cycleData.allocated_area_unit || 'acre');
      setEditSeasonName(cycleData.season_name || '');
      setEditStartedOn(cycleData.started_on ? cycleData.started_on.split('T')[0] : '');
      setEditExpectedHarvestOn(cycleData.expected_harvest_on ? cycleData.expected_harvest_on.split('T')[0] : '');
      setHarvestDate(cycleData.actual_harvest_on ? cycleData.actual_harvest_on.split('T')[0] : new Date().toISOString().split('T')[0]);
      setHarvestAmount(cycleData.harvest_amount?.toString() || '');
      setHarvestUnit(cycleData.harvest_unit || 'KG');
      setNotesText(cycleData.notes || '');

      const dbCycleId = cycleData.id || cycleIdentifier;

      // Fetch related data in parallel
      const [acts, exps, sls, farmData, masters, cropsData] = await Promise.all([
        farmActivitiesApi.getAll({ crop_cycle_id: dbCycleId }).catch(() => []),
        expensesApi.getAll({ crop_cycle_id: dbCycleId }).catch(() => []),
        salesApi.getSales({ crop_cycle_id: dbCycleId }).catch(() => []),
        cycleData.farm_id ? farmsApi.getById(cycleData.farm_id).catch(() => null) : Promise.resolve(null),
        mastersApi.getActivities().catch(() => []),
        mastersApi.getCrops().catch(() => []),
      ]);

      setActivities(acts);
      setExpenses(exps);
      setSales(sls);
      if (farmData) setFarm(farmData);
      setActivityMasters(masters);
      setCrops(cropsData);
      if (masters.length > 0 && !selectedActivityMasterId) {
        setSelectedActivityMasterId(masters[0].id);
      }
    } catch (error) {
      console.error('Error fetching crop cycle data:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to fetch crop cycle details.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cycleIdentifier, selectedActivityMasterId]);

  useEffect(() => {
    fetchCycleData();
  }, [fetchCycleData]);

  useFocusEffect(
    useCallback(() => {
      fetchCycleData();
    }, [fetchCycleData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCycleData();
  };

  const activityTotalPages = Math.max(1, Math.ceil(activities.length / PER_PAGE));
  const paginatedActivities = activities.slice((activityPage - 1) * PER_PAGE, activityPage * PER_PAGE);

  const expenseTotalPages = Math.max(1, Math.ceil(expenses.length / PER_PAGE));
  const paginatedExpenses = expenses.slice((expensePage - 1) * PER_PAGE, expensePage * PER_PAGE);

  const saleTotalPages = Math.max(1, Math.ceil(sales.length / PER_PAGE));
  const paginatedSales = sales.slice((salePage - 1) * PER_PAGE, salePage * PER_PAGE);

  const renderPagination = (
    currentPage: number,
    totalPages: number,
    totalItems: number,
    onPageChange: (p: number) => void
  ) => {
    if (totalItems <= PER_PAGE) return null;
    const startItem = (currentPage - 1) * PER_PAGE + 1;
    const endItem = Math.min(currentPage * PER_PAGE, totalItems);

    const startPage = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
    const endPage = Math.min(totalPages, Math.max(startPage + 2, 1));
    const pages: number[] = [];
    for (let p = startPage; p <= endPage; p++) {
      pages.push(p);
    }

    return (
      <View style={styles.paginationWrap}>
        <View style={styles.paginationRow}>
          <TouchableOpacity
            style={[styles.pageBtn, currentPage <= 1 && styles.pageBtnDisabled]}
            disabled={currentPage <= 1}
            onPress={() => onPageChange(currentPage - 1)}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={14} color={currentPage <= 1 ? '#cbd5e1' : '#1e293b'} />
          </TouchableOpacity>

          {pages.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.pageBtn, currentPage === p && styles.pageBtnActive]}
              onPress={() => onPageChange(p)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pageBtnText, currentPage === p && styles.pageBtnTextActive]}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
            disabled={currentPage >= totalPages}
            onPress={() => onPageChange(currentPage + 1)}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={14} color={currentPage >= totalPages ? '#cbd5e1' : '#1e293b'} />
          </TouchableOpacity>
        </View>

        <Text style={styles.paginationMeta}>
          Showing {startItem}-{endItem} of {totalItems}
        </Text>
      </View>
    );
  };

  const isHarvested = useMemo(() => {
    if (!cycle?.status) return false;
    const s = cycle.status.toUpperCase();
    return s === 'HARVESTED' || s === 'COMPLETED';
  }, [cycle?.status]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = typeof val === 'number' ? val : parseFloat(val || '0');
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(isNaN(num) ? 0 : num);
  };

  const totalExpenseSum = useMemo(() => {
    return expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount as string) || 0), 0);
  }, [expenses]);

  const totalGrossSales = useMemo(() => {
    return sales.reduce((acc, curr) => acc + (parseFloat(curr.gross_total as unknown as string) || 0), 0);
  }, [sales]);

  const totalFinalSales = useMemo(() => {
    return sales.reduce((acc, curr) => acc + (parseFloat(curr.final_amount as unknown as string) || 0), 0);
  }, [sales]);

  const progressPercent = useMemo(() => {
    if (!cycle?.started_on) return null;
    const start = new Date(cycle.started_on).getTime();
    const target = cycle.actual_harvest_on
      ? new Date(cycle.actual_harvest_on).getTime()
      : cycle.expected_harvest_on
      ? new Date(cycle.expected_harvest_on).getTime()
      : 0;

    if (!target || target <= start) return null;
    const now = Date.now();
    const progress = Math.min(100, Math.max(0, Math.round(((now - start) / (target - start)) * 100)));
    return progress;
  }, [cycle?.started_on, cycle?.expected_harvest_on, cycle?.actual_harvest_on]);

  // Handle Edit Cycle
  const handleSaveCycle = async () => {
    if (!cycleIdentifier || !cycle) return;
    if (!editAllocatedArea.trim() || isNaN(Number(editAllocatedArea)) || Number(editAllocatedArea) <= 0) {
      Alert.alert('Validation Error', 'Allocated area must be a valid positive number.');
      return;
    }

    setUpdatingCycle(true);
    try {
      const payload: CropCycle = {
        ...cycle,
        crop_type: editCropType,
        allocated_area: parseFloat(editAllocatedArea),
        allocated_area_unit: editAllocatedAreaUnit,
        season_name: editSeasonName,
        started_on: editStartedOn || cycle.started_on,
        expected_harvest_on: editExpectedHarvestOn || cycle.expected_harvest_on,
      };

      const updated = await cropCyclesApi.update(cycleIdentifier, payload);
      setCycle(updated);
      setEditCycleModalVisible(false);
      Alert.alert('Success', 'Crop cycle updated successfully!');
      fetchCycleData();
    } catch (error) {
      Alert.alert('Error', extractErrorMessage(error, 'Failed to update crop cycle.'));
    } finally {
      setUpdatingCycle(false);
    }
  };

  // Handle Harvest Crop
  const handleSaveHarvest = async () => {
    if (!cycleIdentifier || !cycle) return;
    if (!harvestDate.trim()) {
      Alert.alert('Validation Error', 'Actual harvest date is required.');
      return;
    }

    setSavingHarvest(true);
    try {
      const payload: CropCycle = {
        ...cycle,
        status: 'HARVESTED',
        actual_harvest_on: harvestDate,
        harvest_amount: harvestAmount ? parseFloat(harvestAmount) : undefined,
        harvest_unit: harvestUnit || 'KG',
      };

      const updated = await cropCyclesApi.update(cycleIdentifier, payload);
      setCycle(updated);
      setHarvestModalVisible(false);
      Alert.alert('Success', 'Harvest record saved successfully!');
      fetchCycleData();
    } catch (error) {
      Alert.alert('Error', extractErrorMessage(error, 'Failed to save harvest.'));
    } finally {
      setSavingHarvest(false);
    }
  };

  // Handle Save Notes
  const handleSaveNotes = async () => {
    if (!cycleIdentifier || !cycle) return;
    setSavingNotes(true);
    try {
      const payload: CropCycle = {
        ...cycle,
        notes: notesText,
      };

      const updated = await cropCyclesApi.update(cycleIdentifier, payload);
      setCycle(updated);
      setEditNotesModalVisible(false);
      Alert.alert('Success', 'Field notes updated.');
    } catch (error) {
      Alert.alert('Error', extractErrorMessage(error, 'Failed to update notes.'));
    } finally {
      setSavingNotes(false);
    }
  };

  // Quick Add Activity
  const handleCreateActivity = async () => {
    if (!cycle?.farm_id || !selectedActivityMasterId) {
      Alert.alert('Error', 'Please select an activity master.');
      return;
    }

    setSavingActivity(true);
    try {
      await farmActivitiesApi.create({
        farm_id: cycle.farm_id,
        crop_cycle_id: cycle.id || cycleIdentifier,
        farm_activity_master_id: selectedActivityMasterId,
        date: activityDate || new Date().toISOString().split('T')[0],
        status: 'completed',
        notes: activityNotes,
      });

      setAddActivityModalVisible(false);
      setActivityNotes('');
      Alert.alert('Success', 'Activity added successfully!');
      fetchCycleData();
    } catch (error) {
      Alert.alert('Error', extractErrorMessage(error, 'Failed to create activity.'));
    } finally {
      setSavingActivity(false);
    }
  };

  // Quick Add Expense
  const handleCreateExpense = async () => {
    if (!cycle?.farm_id || !expenseAmount.trim()) {
      Alert.alert('Validation Error', 'Please enter a valid expense amount.');
      return;
    }

    setSavingExpense(true);
    try {
      await expensesApi.create({
        farm_id: cycle.farm_id,
        crop_cycle_id: cycle.id || cycleIdentifier,
        expense_category: expenseCategory,
        amount: parseFloat(expenseAmount),
        date: expenseDate || new Date().toISOString().split('T')[0],
        payment_method: expensePaymentMethod,
        payment_status: expensePaymentStatus,
        notes: expenseNotes,
      });

      setAddExpenseModalVisible(false);
      setExpenseAmount('');
      setExpenseNotes('');
      Alert.alert('Success', 'Expense logged successfully!');
      fetchCycleData();
    } catch (error) {
      Alert.alert('Error', extractErrorMessage(error, 'Failed to log expense.'));
    } finally {
      setSavingExpense(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading crop cycle details...</Text>
      </View>
    );
  }

  const cropTitle = cycle?.crop_name || cycle?.crop_type || 'Crop Cycle';
  const matchedCrop = crops.find(
    (c) =>
      (cycle?.crop_id && (c.id === cycle.crop_id || c.ulid === (cycle.crop_id as any))) ||
      c.name?.toLowerCase() === cycle?.crop_name?.toLowerCase() ||
      c.name?.toLowerCase() === cycle?.crop_type?.toLowerCase()
  );
  const rawCropImage =
    cycle?.crop_details?.image_url ||
    (cycle as any)?.crop?.image_url ||
    (cycle as any)?.crop?.image_path ||
    matchedCrop?.image_url ||
    (matchedCrop as any)?.image_path;
  const cropImageUrl = getAbsoluteImageUrl(rawCropImage);
  const farmName = farm?.name || cycle?.farm?.name || (cycle as any)?.farm_name || '-';
  const farmLocation = farm?.location || 'Location not set';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Top Sticky Bar */}
      <View style={styles.topStickyBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color="#166534" />
        </TouchableOpacity>

        <Text style={styles.topBarTitle}>Crop Cycle</Text>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setEditCycleModalVisible(true)}
          activeOpacity={0.7}
          accessibilityLabel="Edit Crop Cycle"
        >
          <Ionicons name="create-outline" size={20} color="#166534" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#16a34a']}
            tintColor="#16a34a"
          />
        }
      >
        {/* 1. Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHead}>
            <View style={styles.heroLeft}>
              <View style={styles.heroImageWrap}>
                {cropImageUrl && !imageError ? (
                  <Image
                    source={{ uri: cropImageUrl }}
                    style={styles.heroImage}
                    resizeMode="cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <Ionicons name="leaf" size={28} color="#166534" />
                )}
              </View>

              <View style={styles.heroTitleBlock}>
                <View style={styles.heroTitleRow}>
                  <Text style={styles.heroTitle}>{cropTitle}</Text>
                  {cycle?.crop_type && cycle.crop_type !== cropTitle ? (
                    <Text style={styles.heroType}>({cycle.crop_type})</Text>
                  ) : null}
                </View>

                {cycle?.season_name ? (
                  <View style={styles.seasonRow}>
                    <Ionicons name="flower-outline" size={13} color="#64748b" />
                    <Text style={styles.seasonText}>{cycle.season_name}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={[styles.statusPill, isHarvested && styles.statusPillHarvested]}>
              <Text style={[styles.statusPillText, isHarvested && styles.statusPillTextHarvested]}>
                {isHarvested ? 'HARVESTED' : 'ACTIVE'}
              </Text>
            </View>
          </View>

          {/* Area & Farm Stats Grid */}
          <View style={styles.statGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIconWrap}>
                <Ionicons name="map-outline" size={16} color="#14532d" />
              </View>
              <View style={styles.statCopy}>
                <Text style={styles.statLabel}>AREA</Text>
                <Text style={styles.statValue}>
                  {cycle?.allocated_area ? Number(cycle.allocated_area).toFixed(2) : '-'}
                </Text>
                <Text style={styles.statUnit}>
                  {cycle?.allocated_area_unit
                    ? cycle.allocated_area_unit.charAt(0).toUpperCase() + cycle.allocated_area_unit.slice(1).toLowerCase()
                    : 'Acres'}
                </Text>
              </View>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconWrap}>
                <Ionicons name="location-outline" size={16} color="#14532d" />
              </View>
              <View style={styles.statCopy}>
                <Text style={styles.statLabel}>FARM</Text>
                <Text style={styles.statText} numberOfLines={1}>
                  {farmName}
                </Text>
                <Text style={styles.statSubtext} numberOfLines={1}>
                  {farmLocation}
                </Text>
              </View>
            </View>
          </View>

          {/* Secondary Quick Actions */}
          <View style={styles.divider} />
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={styles.actionBtnActivity}
              onPress={() => {
                setActivityDate(new Date().toISOString().split('T')[0]);
                setAddActivityModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="clipboard-outline" size={16} color="#166534" />
              <Text style={styles.actionBtnActivityText}>Add Activity</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtnExpense}
              onPress={() => {
                setExpenseDate(new Date().toISOString().split('T')[0]);
                setAddExpenseModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="cash-outline" size={16} color="#b45309" />
              <Text style={styles.actionBtnExpenseText}>Add Expense</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Cycle Timeline Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <Ionicons name="calendar-outline" size={18} color="#14532d" />
            <Text style={styles.sectionTitle}>Cycle Timeline</Text>
          </View>

          <View style={styles.timelineContainer}>
            {/* Started */}
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.timelineDotGreen]} />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineLabel, { color: '#166534' }]}>STARTED</Text>
                <Text style={styles.timelineDate}>{formatDate(cycle?.started_on)}</Text>
              </View>
            </View>
            <View style={styles.timelineLine} />

            {/* Expected Harvest */}
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.timelineDotAmber]} />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineLabel, { color: '#b45309' }]}>EXPECTED HARVEST</Text>
                <Text style={styles.timelineDate}>
                  {cycle?.expected_harvest_on ? formatDate(cycle.expected_harvest_on) : 'Not Set'}
                </Text>

                {progressPercent !== null && (
                  <View style={styles.progressBlock}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                      {isHarvested ? 'Harvest completed' : `${progressPercent}% through cycle`}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.timelineLine} />

            {/* Actual Harvest */}
            <View style={styles.timelineItem}>
              <View
                style={[
                  styles.timelineDot,
                  cycle?.actual_harvest_on ? styles.timelineDotGreen : styles.timelineDotMuted,
                ]}
              />
              <View style={styles.timelineContent}>
                <Text
                  style={[
                    styles.timelineLabel,
                    { color: cycle?.actual_harvest_on ? '#166534' : '#9ca3af' },
                  ]}
                >
                  ACTUAL HARVEST
                </Text>
                <Text
                  style={[
                    styles.timelineDate,
                    !cycle?.actual_harvest_on && { color: '#94a3b8', fontStyle: 'italic' },
                  ]}
                >
                  {cycle?.actual_harvest_on ? formatDate(cycle.actual_harvest_on) : 'Awaiting harvest log'}
                </Text>
                {cycle?.harvest_amount ? (
                  <Text style={styles.harvestYieldText}>
                    Yield: {cycle.harvest_amount} {cycle.harvest_unit || 'KG'}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* 3. Field Notes Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeading}>
              <Ionicons name="document-text-outline" size={18} color="#14532d" />
              <Text style={styles.sectionTitle}>Field Notes</Text>
            </View>

            <TouchableOpacity
              style={styles.pillActionBtn}
              onPress={() => setEditNotesModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil-outline" size={14} color="#166534" />
              <Text style={styles.pillActionBtnText}>Edit Note</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.notesBox}>
            <Text style={[styles.notesText, !cycle?.notes && styles.notesTextEmpty]}>
              {cycle?.notes || 'No field notes added yet.'}
            </Text>
          </View>
        </View>

        {/* 4. Activities Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeading}>
              <Ionicons name="clipboard-outline" size={18} color="#14532d" />
              <Text style={styles.sectionTitle}>Activities</Text>
            </View>

            <TouchableOpacity
              style={[styles.pillActionBtn, styles.pillActionBtnReport]}
              onPress={() => router.push('/reports')}
              activeOpacity={0.7}
            >
              <Ionicons name="bar-chart-outline" size={14} color="#166534" />
              <Text style={[styles.pillActionBtnText, { color: '#166534' }]}>Report</Text>
            </TouchableOpacity>
          </View>

          {activities.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No activities logged for this crop cycle yet.</Text>
            </View>
          ) : (
            <View>
              <View style={styles.listBlock}>
                {paginatedActivities.map((act, index) => (
                  <TouchableOpacity
                    key={act.ulid || act.id || index}
                    style={styles.activityItemCard}
                    activeOpacity={0.7}
                    onPress={() => router.push({
                      pathname: '/activity-view',
                      params: { activity_id: act.id?.toString(), activity_ulid: act.ulid },
                    })}
                  >
                    <View style={styles.activityHeadRow}>
                      <Text style={styles.activityName} numberOfLines={1}>
                        {act.farm_activity_master?.name || act.activity_type || 'Activity'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={styles.activityStatusPill}>
                          <Text style={styles.activityStatusText}>
                            {(act.status || 'Completed').toUpperCase()}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                      </View>
                    </View>

                    <View style={styles.activityDateRow}>
                      <Ionicons name="calendar-outline" size={12} color="#166534" />
                      <Text style={styles.activityDateText}>{formatDate(act.date)}</Text>
                    </View>

                    {act.notes ? (
                      <Text style={styles.activityNotesText} numberOfLines={2}>
                        {act.notes}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
              {renderPagination(activityPage, activityTotalPages, activities.length, setActivityPage)}
            </View>
          )}
        </View>

        {/* 5. Expenses Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeading}>
              <Ionicons name="wallet-outline" size={18} color="#14532d" />
              <Text style={styles.sectionTitle}>Expenses</Text>
            </View>

            <TouchableOpacity
              style={[styles.pillActionBtn, styles.pillActionBtnExpenseReport]}
              onPress={() => router.push('/reports')}
              activeOpacity={0.7}
            >
              <Ionicons name="bar-chart-outline" size={14} color="#b45309" />
              <Text style={[styles.pillActionBtnText, { color: '#b45309' }]}>Report</Text>
            </TouchableOpacity>
          </View>

          {expenses.length > 0 && (
            <View style={styles.expenseSummaryBanner}>
              <View>
                <Text style={styles.summaryLabel}>TOTAL EXPENSES</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalExpenseSum)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.summaryLabel}>COUNT</Text>
                <Text style={styles.summaryValue}>{expenses.length}</Text>
              </View>
            </View>
          )}

          {expenses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No expenses logged for this crop cycle yet.</Text>
            </View>
          ) : (
            <View>
              <View style={styles.listBlock}>
                {paginatedExpenses.map((exp, index) => (
                  <TouchableOpacity
                    key={exp.ulid || exp.id || index}
                    style={styles.expenseItemCard}
                    activeOpacity={0.7}
                    onPress={() => router.push({
                      pathname: '/expense-view',
                      params: { expense_id: exp.id?.toString(), expense_ulid: exp.ulid },
                    })}
                  >
                    <View style={styles.expenseHeadRow}>
                      <Text style={styles.expenseCategory} numberOfLines={1}>
                        {exp.expense_name || exp.expense_category}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.expenseAmountText}>{formatCurrency(exp.amount)}</Text>
                        <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                      </View>
                    </View>

                    <View style={styles.expenseMetaRow}>
                      <Text style={styles.expenseDateText}>{formatDate(exp.date)}</Text>
                      {exp.payment_method ? (
                        <Text style={styles.expenseMethodText}>• {exp.payment_method}</Text>
                      ) : null}
                    </View>

                    {exp.notes ? (
                      <Text style={styles.expenseNotesText} numberOfLines={2}>
                        {exp.notes}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
              {renderPagination(expensePage, expenseTotalPages, expenses.length, setExpensePage)}
            </View>
          )}
        </View>

        {/* 6. Sales Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeading}>
              <Ionicons name="pricetag-outline" size={18} color="#14532d" />
              <Text style={styles.sectionTitle}>Sales</Text>
            </View>

            <TouchableOpacity
              style={styles.pillActionBtn}
              onPress={() => router.push('/sales')}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={15} color="#166534" />
              <Text style={styles.pillActionBtnText}>Add Sale</Text>
            </TouchableOpacity>
          </View>

          {sales.length > 0 && (
            <View style={styles.salesSummaryBanner}>
              <View>
                <Text style={[styles.summaryLabel, { color: '#15803d' }]}>GROSS AMOUNT</Text>
                <Text style={[styles.summaryValue, { color: '#14532d' }]}>
                  {formatCurrency(totalGrossSales)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.summaryLabel, { color: '#15803d' }]}>FINAL AMOUNT</Text>
                <Text style={[styles.summaryValue, { color: '#14532d' }]}>
                  {formatCurrency(totalFinalSales)}
                </Text>
              </View>
            </View>
          )}

          {sales.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No sales logged for this crop cycle yet.</Text>
            </View>
          ) : (
            <View>
              <View style={styles.listBlock}>
                {paginatedSales.map((sale, index) => (
                  <TouchableOpacity
                    key={sale.ulid || sale.id || index}
                    style={styles.saleItemCard}
                    activeOpacity={0.7}
                    onPress={() => router.push({
                      pathname: '/sale-view',
                      params: { sale_id: sale.id?.toString(), sale_ulid: sale.ulid },
                    })}
                  >
                    <View style={styles.saleHeadRow}>
                      <Text style={styles.saleBuyerName} numberOfLines={1}>
                        {sale.buyer_name || 'Buyer Sale'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.saleFinalAmount}>+{formatCurrency(sale.final_amount ?? sale.gross_total)}</Text>
                        <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                      </View>
                    </View>

                    <View style={styles.saleMetaRow}>
                      <Text style={styles.saleDateText}>{formatDate(sale.date)}</Text>
                      <Text style={styles.saleGrossText}>Total: {formatCurrency(sale.gross_total)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              {renderPagination(salePage, saleTotalPages, sales.length, setSalePage)}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Sticky Footer */}
      <View style={styles.bottomFooter}>
        <TouchableOpacity
          style={styles.footerEditBtn}
          onPress={() => setEditCycleModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="pencil-outline" size={17} color="#334155" />
          <Text style={styles.footerEditBtnText}>Edit Cycle</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.footerHarvestBtn, isHarvested && styles.footerHarvestBtnDone]}
          onPress={() => setHarvestModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
          <Text style={styles.footerHarvestBtnText}>
            {isHarvested ? 'Edit Harvest' : 'Harvest Crop'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODAL 1: Edit Cycle */}
      <Modal
        visible={editCycleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditCycleModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Crop Cycle</Text>
              <TouchableOpacity onPress={() => setEditCycleModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Crop Type / Variety</Text>
              <TextInput
                style={styles.input}
                value={editCropType}
                onChangeText={setEditCropType}
                placeholder="e.g. Cotton, Wheat"
                placeholderTextColor={colors.slate400}
              />

              <Text style={styles.inputLabel}>Allocated Area</Text>
              <TextInput
                style={styles.input}
                value={editAllocatedArea}
                onChangeText={setEditAllocatedArea}
                keyboardType="decimal-pad"
                placeholder="e.g. 5.5"
                placeholderTextColor={colors.slate400}
              />

              <Text style={styles.inputLabel}>Area Measurement Unit</Text>
              <QuickChipGroup
                options={AREA_UNIT_OPTIONS}
                selectedValue={editAllocatedAreaUnit}
                onSelect={(val) => setEditAllocatedAreaUnit(val)}
                size="sm"
              />

              <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Season Name</Text>
              <TextInput
                style={styles.input}
                value={editSeasonName}
                onChangeText={setEditSeasonName}
                placeholder="e.g. Kharif 2026"
                placeholderTextColor={colors.slate400}
              />

              <Text style={styles.inputLabel}>Started Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={editStartedOn}
                onChangeText={setEditStartedOn}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.slate400}
              />

              <Text style={styles.inputLabel}>Expected Harvest Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={editExpectedHarvestOn}
                onChangeText={setEditExpectedHarvestOn}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.slate400}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setEditCycleModalVisible(false)}
                  disabled={updatingCycle}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleSaveCycle}
                  disabled={updatingCycle}
                >
                  {updatingCycle ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 2: Harvest Crop */}
      <Modal
        visible={harvestModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHarvestModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isHarvested ? 'Edit Harvest Record' : 'Record Crop Harvest'}
              </Text>
              <TouchableOpacity onPress={() => setHarvestModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Actual Harvest Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                value={harvestDate}
                onChangeText={setHarvestDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.slate400}
              />

              <Text style={styles.inputLabel}>Harvest Yield Amount</Text>
              <TextInput
                style={styles.input}
                value={harvestAmount}
                onChangeText={setHarvestAmount}
                keyboardType="decimal-pad"
                placeholder="e.g. 1200"
                placeholderTextColor={colors.slate400}
              />

              <Text style={styles.inputLabel}>Yield Unit</Text>
              <TextInput
                style={styles.input}
                value={harvestUnit}
                onChangeText={setHarvestUnit}
                placeholder="e.g. KG, Quintal, Bags, Ton"
                placeholderTextColor={colors.slate400}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setHarvestModalVisible(false)}
                  disabled={savingHarvest}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleSaveHarvest}
                  disabled={savingHarvest}
                >
                  {savingHarvest ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Harvest</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 3: Edit Field Notes */}
      <Modal
        visible={editNotesModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditNotesModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Field Notes</Text>
              <TouchableOpacity onPress={() => setEditNotesModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={notesText}
              onChangeText={setNotesText}
              placeholder="Record crop observations, watering notes, soil remarks..."
              placeholderTextColor={colors.slate400}
              multiline
              numberOfLines={5}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setEditNotesModalVisible(false)}
                disabled={savingNotes}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={handleSaveNotes}
                disabled={savingNotes}
              >
                {savingNotes ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Note</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 4: Quick Add Activity */}
      <Modal
        visible={addActivityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddActivityModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Field Activity</Text>
              <TouchableOpacity onPress={() => setAddActivityModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Select Activity Type *</Text>
              <View style={styles.chipSelectorWrap}>
                {activityMasters.map((master) => {
                  const isSel = selectedActivityMasterId === master.id;
                  return (
                    <TouchableOpacity
                      key={master.id}
                      style={[styles.masterChip, isSel && styles.masterChipSelected]}
                      onPress={() => setSelectedActivityMasterId(master.id)}
                    >
                      <Text
                        style={[styles.masterChipText, isSel && styles.masterChipTextSelected]}
                      >
                        {master.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={activityDate}
                onChangeText={setActivityDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.slate400}
              />

              <Text style={styles.inputLabel}>Notes / Remarks</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={activityNotes}
                onChangeText={setActivityNotes}
                placeholder="Workers count, chemicals used, etc."
                placeholderTextColor={colors.slate400}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setAddActivityModalVisible(false)}
                  disabled={savingActivity}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleCreateActivity}
                  disabled={savingActivity}
                >
                  {savingActivity ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Activity</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 5: Quick Add Expense */}
      <Modal
        visible={addExpenseModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddExpenseModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Farm Expense</Text>
              <TouchableOpacity onPress={() => setAddExpenseModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Expense Category *</Text>
              <View style={styles.chipSelectorWrap}>
                {EXPENSE_CATEGORIES.map((cat) => {
                  const isSel = expenseCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.masterChip, isSel && styles.masterChipSelected]}
                      onPress={() => setExpenseCategory(cat)}
                    >
                      <Text
                        style={[styles.masterChipText, isSel && styles.masterChipTextSelected]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Amount (₹) *</Text>
              <TextInput
                style={styles.input}
                value={expenseAmount}
                onChangeText={setExpenseAmount}
                keyboardType="decimal-pad"
                placeholder="e.g. 3500"
                placeholderTextColor={colors.slate400}
              />

              <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={expenseDate}
                onChangeText={setExpenseDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.slate400}
              />

              <Text style={styles.inputLabel}>Payment Method</Text>
              <QuickChipGroup
                options={[
                  { label: 'Cash', value: 'cash' },
                  { label: 'UPI / Online', value: 'upi' },
                  { label: 'Bank Transfer', value: 'bank_transfer' },
                ]}
                selectedValue={expensePaymentMethod}
                onSelect={(val) => setExpensePaymentMethod(val)}
                size="sm"
              />

              <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Notes</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={expenseNotes}
                onChangeText={setExpenseNotes}
                placeholder="Vendor name, bill number, remarks..."
                placeholderTextColor={colors.slate400}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setAddExpenseModalVisible(false)}
                  disabled={savingExpense}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleCreateExpense}
                  disabled={savingExpense}
                >
                  {savingExpense ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Expense</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.slate500,
    fontWeight: '600',
  },
  topStickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 10 : 10,
    paddingBottom: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#14532d',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    ...shadows.subtle,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroImageWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#f4f8f5',
    borderWidth: 1,
    borderColor: 'rgba(20, 83, 45, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroTitleBlock: {
    flex: 1,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#14532d',
  },
  heroType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  seasonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  statusPillHarvested: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.5,
  },
  statusPillTextHarvested: {
    color: '#1d4ed8',
  },
  statGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCopy: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 1,
  },
  statUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  statText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 1,
  },
  statSubtext: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtnActivity: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnActivityText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  actionBtnExpense: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnExpenseText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b45309',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginTop: 14,
    ...shadows.subtle,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  pillActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  pillActionBtnReport: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  pillActionBtnExpenseReport: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  pillActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  timelineContainer: {
    marginTop: 14,
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 2,
  },
  timelineDotGreen: {
    backgroundColor: '#dcfce7',
    borderWidth: 2.5,
    borderColor: '#166534',
  },
  timelineDotAmber: {
    backgroundColor: '#ffedd5',
    borderWidth: 2.5,
    borderColor: '#fb923c',
  },
  timelineDotMuted: {
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  timelineLine: {
    width: 2,
    height: 24,
    backgroundColor: '#e2e8f0',
    marginLeft: 6,
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timelineDate: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  harvestYieldText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    marginTop: 3,
  },
  progressBlock: {
    marginTop: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#166534',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 4,
  },
  notesBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  notesText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  notesTextEmpty: {
    fontStyle: 'normal',
    color: '#94a3b8',
  },
  emptyCard: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  emptyCardText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  listBlock: {
    marginTop: 12,
    gap: 10,
  },
  activityItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 4,
  },
  activityHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginRight: 8,
  },
  activityStatusPill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  activityStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  activityDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityDateText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '700',
  },
  activityNotesText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  expenseSummaryBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  salesSummaryBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d97706',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#92400e',
    marginTop: 1,
  },
  expenseItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 4,
  },
  expenseHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseCategory: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginRight: 8,
  },
  expenseAmountText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  expenseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expenseDateText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '700',
  },
  expenseMethodText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  expenseNotesText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  saleItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 4,
  },
  saleHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saleBuyerName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginRight: 8,
  },
  saleFinalAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16a34a',
  },
  saleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saleDateText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '700',
  },
  saleGrossText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  bottomFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    ...shadows.medium,
  },
  footerEditBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerEditBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  footerHarvestBtn: {
    flex: 1.2,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  footerHarvestBtnDone: {
    backgroundColor: '#1d4ed8',
    shadowColor: '#1d4ed8',
  },
  footerHarvestBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '90%',
    ...shadows.medium,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate700,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.slate900,
    backgroundColor: colors.slate50,
  },
  multilineInput: {
    height: 90,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  chipSelectorWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  masterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  masterChipSelected: {
    backgroundColor: '#ecfdf5',
    borderColor: '#86efac',
  },
  masterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  masterChipTextSelected: {
    color: '#166534',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: colors.slate100,
  },
  cancelBtnText: {
    color: colors.slate700,
    fontWeight: '700',
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#16a34a',
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  paginationWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
    gap: 8,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageBtn: {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  pageBtnActive: {
    backgroundColor: '#166534',
    borderColor: '#166534',
  },
  pageBtnDisabled: {
    opacity: 0.35,
    backgroundColor: '#f8fafc',
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  pageBtnTextActive: {
    color: '#ffffff',
  },
  paginationMeta: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
});
