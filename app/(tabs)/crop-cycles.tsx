import React, { useState, useEffect, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { cropCyclesApi } from '../../src/api/cropCycles';
import { farmsApi } from '../../src/api/farms';
import { mastersApi } from '../../src/api/masters';
import { CropCycle, Farm, Crop } from '../../src/types';
import { useAuth } from '../../src/hooks/useAuth';
import { extractErrorMessage } from '../../src/api/client';
import { colors, radius, spacing, shadows } from '../../src/theme/tokens';
import { useTranslation } from '../../src/i18n/I18nContext';
import { useToast } from '../../src/context/ToastContext';
import {
  BentoCard,
  StatusBadge,
  SearchFilterBar,
  QuickChipGroup,
  ChipOption,
  SearchableSelect,
  ModernDatePicker,
  ModernInput,
  EmptyState,
  ConfirmModal,
} from '../../src/components/ui';

export default function CropCyclesScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [cycles, setCycles] = useState<CropCycle[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Confirm delete modal state
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [cycleToDelete, setCycleToDelete] = useState<CropCycle | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'all'>('ACTIVE');

  const AREA_UNIT_OPTIONS: ChipOption<string>[] = [
    { label: t('Acre'), value: 'ACRE' },
    { label: t('Hectare'), value: 'HECTARE' },
    { label: t('Bigha'), value: 'BIGHAS' },
    { label: t('Guntha'), value: 'GUNTHAS' },
  ];

  const CYCLE_STATUS_OPTIONS: ChipOption<string>[] = [
    { label: t('Active'), value: 'ACTIVE' },
    { label: t('Completed'), value: 'COMPLETED' },
    { label: t('Cancelled'), value: 'CANCELLED' },
  ];

  // Create Cycle Modal State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [farmId, setFarmId] = useState('');
  const [cropId, setCropId] = useState('');
  const [cropType, setCropType] = useState('');
  const [allocatedArea, setAllocatedArea] = useState('');
  const [allocatedAreaUnit, setAllocatedAreaUnit] = useState('ACRE');
  const [seasonName, setSeasonName] = useState('');
  const [startedOn, setStartedOn] = useState(new Date().toISOString().split('T')[0]);
  const [expectedHarvestOn, setExpectedHarvestOn] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Dropdown states
  const [showFarmDropdown, setShowFarmDropdown] = useState(false);
  const [showCropDropdown, setShowCropDropdown] = useState(false);

  // View/Manage Modal State
  const [selectedCycle, setSelectedCycle] = useState<CropCycle | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit Form State
  const [editFarmId, setEditFarmId] = useState('');
  const [editCropId, setEditCropId] = useState('');
  const [editCropType, setEditCropType] = useState('');
  const [editAllocatedArea, setEditAllocatedArea] = useState('');
  const [editAllocatedAreaUnit, setEditAllocatedAreaUnit] = useState('ACRE');
  const [editSeasonName, setEditSeasonName] = useState('');
  const [editStartedOn, setEditStartedOn] = useState('');
  const [editExpectedHarvestOn, setEditExpectedHarvestOn] = useState('');
  const [editActualHarvestOn, setEditActualHarvestOn] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editHarvestAmount, setEditHarvestAmount] = useState('');
  const [editHarvestUnit, setEditHarvestUnit] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showEditFarmDropdown, setShowEditFarmDropdown] = useState(false);
  const [showEditCropDropdown, setShowEditCropDropdown] = useState(false);

  const fetchData = async () => {
    try {
      const [cycleData, farmData, cropsData] = await Promise.all([
        cropCyclesApi.getAll(),
        farmsApi.getAll(),
        mastersApi.getCrops({ status: 'active' }),
      ]);
      setCycles(cycleData);
      setFarms(farmData);
      setCrops(cropsData);
    } catch (error: any) {
      console.error('Error fetching crop cycles data:', error);
      Alert.alert(t('Error'), t('Failed to fetch data from server.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchData();
      }
    }, [isAuthenticated])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const calculateFarmRemainingArea = (targetFarmId?: string | number, excludeCycleId?: string | number) => {
    if (!targetFarmId) return null;
    const farm = farms.find((f) => f.ulid === targetFarmId || f.id?.toString() === targetFarmId.toString());
    if (!farm) return null;
    const farmTotal = parseFloat(String(farm.area || 0));
    const activeCyclesArea = cycles
      .filter((c) => {
        const matchesFarm = c.farm_id?.toString() === farm.id?.toString() || (farm.ulid && c.farm_id === farm.ulid);
        const notExcluded = !excludeCycleId || (c.id !== excludeCycleId && c.ulid !== excludeCycleId);
        return matchesFarm && c.status === 'ACTIVE' && notExcluded;
      })
      .reduce((sum, c) => sum + (parseFloat(String(c.allocated_area)) || 0), 0);

    const remaining = Math.max(0, farmTotal - activeCyclesArea);
    return {
      total: farmTotal,
      activeArea: activeCyclesArea,
      remaining: Math.round(remaining * 100) / 100,
      unit: farm.area_unit,
      name: farm.name,
    };
  };

  const currentFarmAreaInfo = calculateFarmRemainingArea(farmId);
  const editFarmAreaInfo = calculateFarmRemainingArea(editFarmId, selectedCycle?.id || selectedCycle?.ulid);

  const handleCreateCycle = async () => {
    if (!farmId || !cropId || !allocatedArea) {
      Alert.alert(t('Validation Error'), t('Farm, Crop, and Allocated Area are required.'));
      return;
    }

    const areaNum = parseFloat(allocatedArea);
    if (isNaN(areaNum) || areaNum <= 0) {
      Alert.alert(t('Validation Error'), t('Please enter a valid positive allocated area.'));
      return;
    }

    if (currentFarmAreaInfo && areaNum > currentFarmAreaInfo.remaining) {
      Alert.alert(
        t('Warning: Area Exceeded'),
        `${t('Allocated area')} (${areaNum} ${allocatedAreaUnit}) ${t('exceeds the remaining available farm area')} (${currentFarmAreaInfo.remaining} ${currentFarmAreaInfo.unit}).`
      );
      return;
    }

    setSaving(true);
    try {
      const newCycle: CropCycle = {
        farm_id: farmId,
        crop_id: cropId,
        crop_type: cropType.trim() || undefined,
        allocated_area: areaNum,
        allocated_area_unit: allocatedAreaUnit,
        season_name: seasonName.trim() || undefined,
        started_on: startedOn,
        expected_harvest_on: expectedHarvestOn || undefined,
        status: 'ACTIVE',
        notes: notes.trim() || undefined,
      };

      await cropCyclesApi.create(newCycle);
      showToast(t('Crop cycle added successfully!'), { type: 'success' });

      setFarmId('');
      setCropId('');
      setCropType('');
      setAllocatedArea('');
      setAllocatedAreaUnit('ACRE');
      setSeasonName('');
      setStartedOn(new Date().toISOString().split('T')[0]);
      setExpectedHarvestOn('');
      setNotes('');
      setCreateModalVisible(false);

      fetchData();
    } catch (error: any) {
      console.error('Error creating crop cycle:', error);
      const msg = extractErrorMessage(error, t('Failed to add crop cycle.'));
      Alert.alert(t('Error'), msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCycle = async () => {
    if (!selectedCycle || (!selectedCycle.id && !selectedCycle.ulid)) return;
    if (!editFarmId || (!editCropId && !selectedCycle.crop_id) || !editAllocatedArea) {
      Alert.alert(t('Validation Error'), t('Farm, Crop, and Allocated Area are required.'));
      return;
    }

    const areaNum = parseFloat(editAllocatedArea);
    if (isNaN(areaNum) || areaNum <= 0) {
      Alert.alert(t('Validation Error'), t('Please enter a valid positive allocated area.'));
      return;
    }

    setUpdating(true);
    const identifier = selectedCycle.ulid || selectedCycle.id!;
    try {
      const updatedCycle: CropCycle = {
        ...selectedCycle,
        farm_id: editFarmId,
        crop_id: editCropId || selectedCycle.crop_id,
        crop_type: editCropType.trim() || undefined,
        allocated_area: areaNum,
        allocated_area_unit: editAllocatedAreaUnit,
        season_name: editSeasonName.trim() || undefined,
        started_on: editStartedOn,
        expected_harvest_on: editExpectedHarvestOn || undefined,
        actual_harvest_on: editActualHarvestOn || undefined,
        status: editStatus,
        harvest_amount: editHarvestAmount ? parseFloat(editHarvestAmount) : undefined,
        harvest_unit: editHarvestUnit || undefined,
        notes: editNotes.trim() || undefined,
      };

      const result = await cropCyclesApi.update(identifier, updatedCycle);
      showToast(t('Crop cycle updated successfully!'), { type: 'success' });
      setIsEditing(false);
      setSelectedCycle(result);
      fetchData();
    } catch (error: any) {
      console.error('Error updating crop cycle:', error);
      const msg = extractErrorMessage(error, t('Failed to update crop cycle.'));
      Alert.alert(t('Error'), msg);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCycle = (cycle: CropCycle) => {
    if (!cycle.id && !cycle.ulid) return;
    setCycleToDelete(cycle);
    setDeleteConfirmVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!cycleToDelete) return;
    const identifier = cycleToDelete.ulid || cycleToDelete.id!;
    try {
      setDeleting(true);
      await cropCyclesApi.delete(identifier);
      showToast(t('Crop cycle deleted successfully!'), { type: 'success' });
      setDeleteConfirmVisible(false);
      setDetailModalVisible(false);
      setCycleToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error('Error deleting crop cycle:', error);
      Alert.alert(t('Error'), t('Failed to delete crop cycle.'));
    } finally {
      setDeleting(false);
    }
  };

  const getFarmName = (farmId?: any, farmObj?: Farm) => {
    if (farmObj?.name) return farmObj.name;
    const found = farms.find((f) => f.ulid === farmId || f.id === farmId);
    return found?.name || t('Unknown Farm');
  };

  const handleOpenView = (cycle: CropCycle) => {
    const farmName = getFarmName(cycle.farm_id, cycle.farm);
    router.push({
      pathname: '/crop-cycle-view',
      params: {
        cycle_id: cycle.id ? cycle.id.toString() : undefined,
        ulid: cycle.ulid,
        farm_name: farmName !== 'Unknown Farm' ? farmName : undefined,
      },
    });
  };

  const handleOpenManage = (cycle: CropCycle) => {
    setSelectedCycle(cycle);
    setEditFarmId(cycle.farm_id?.toString() || '');
    setEditCropId(cycle.crop_id?.toString() || '');
    setEditCropType(cycle.crop_type || '');
    setEditAllocatedArea(cycle.allocated_area?.toString() || '');
    setEditAllocatedAreaUnit(cycle.allocated_area_unit || 'ACRE');
    setEditSeasonName(cycle.season_name || '');
    setEditStartedOn(cycle.started_on ? cycle.started_on.split('T')[0] : '');
    setEditExpectedHarvestOn(cycle.expected_harvest_on ? cycle.expected_harvest_on.split('T')[0] : '');
    setEditActualHarvestOn(cycle.actual_harvest_on ? cycle.actual_harvest_on.split('T')[0] : '');
    setEditStatus(cycle.status || 'ACTIVE');
    setEditHarvestAmount(cycle.harvest_amount?.toString() || '');
    setEditHarvestUnit(cycle.harvest_unit || '');
    setEditNotes(cycle.notes || '');
    setIsEditing(true);
    setDetailModalVisible(true);
  };

  const getFilteredCycles = () => {
    return cycles.filter((cycle) => {
      const farmName =
        cycle.farm?.name ||
        farms.find((f) => f.ulid === cycle.farm_id || f.id === cycle.farm_id)?.name ||
        '';
      const matchesSearch =
        (cycle.crop_name && cycle.crop_name.toLowerCase().includes(search.toLowerCase())) ||
        (cycle.crop_type && cycle.crop_type.toLowerCase().includes(search.toLowerCase())) ||
        (cycle.season_name && cycle.season_name.toLowerCase().includes(search.toLowerCase())) ||
        farmName.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === 'all' || cycle.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  };

  const filteredCycles = getFilteredCycles();
  const activeFarms = farms.filter((f) => f.is_active);

  const selectedFarmName =
    activeFarms.find((f) => f.ulid === farmId || f.id?.toString() === farmId)?.name ||
    t('Select Farm');
  const editSelectedFarmName =
    farms.find((f) => f.ulid === editFarmId || f.id?.toString() === editFarmId)?.name ||
    t('Select Farm');

  const activeCount = cycles.filter((c) => c.status === 'ACTIVE').length;
  const completedCount = cycles.filter((c) => c.status === 'COMPLETED').length;
  const cancelledCount = cycles.filter((c) => c.status === 'CANCELLED').length;

  const STATUS_FILTER_OPTIONS: ChipOption<'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'all'>[] = [
    { label: t('Active'), value: 'ACTIVE', badge: activeCount },
    { label: t('Completed'), value: 'COMPLETED', badge: completedCount },
    { label: t('Cancelled'), value: 'CANCELLED', badge: cancelledCount },
    { label: t('All'), value: 'all', badge: cycles.length },
  ];

  const getStatusVariant = (status: string) => {
    if (status === 'ACTIVE') return 'success';
    if (status === 'COMPLETED') return 'info';
    if (status === 'CANCELLED') return 'danger';
    return 'neutral';
  };

  const renderCycleItem = ({ item }: { item: CropCycle }) => {
    const farmName = getFarmName(item.farm_id, item.farm);
    const isInactive = item.status !== 'ACTIVE';

    return (
      <BentoCard
        variant="elevated"
        style={[styles.cycleCard, isInactive && styles.cycleCardInactive]}
        onPress={() => handleOpenView(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cropHeaderMain}>
            <View style={styles.cropIconBox}>
              <MaterialCommunityIcons name="seed-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cropTitle} numberOfLines={1}>
                {item.crop_name || item.crop_type || t('Unknown Crop')}
              </Text>
              <View style={styles.farmLocationRow}>
                <Ionicons name="location-outline" size={12} color={colors.slate500} />
                <Text style={styles.farmName} numberOfLines={1}>
                  {farmName}
                </Text>
              </View>
            </View>
          </View>

          <StatusBadge
            label={t(item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase())}
            variant={getStatusVariant(item.status)}
            dot={item.status === 'ACTIVE'}
          />
        </View>

        {/* 3 Glanceable Metric Pills */}
        <View style={styles.pillsRow}>
          <View style={styles.pill}>
            <Ionicons name="map-outline" size={13} color={colors.primary} style={styles.pillIcon} />
            <Text style={styles.pillValue}>
              {item.allocated_area} {t(item.allocated_area_unit.toLowerCase())}
            </Text>
          </View>

          <View style={styles.pill}>
            <Ionicons name="calendar-outline" size={13} color={colors.accent} style={styles.pillIcon} />
            <Text style={styles.pillValue}>
              {item.started_on ? item.started_on.split('T')[0] : 'N/A'}
            </Text>
          </View>

          {item.season_name ? (
            <View style={styles.pill}>
              <Ionicons name="leaf-outline" size={13} color={colors.info} style={styles.pillIcon} />
              <Text style={styles.pillValue} numberOfLines={1}>
                {item.season_name}
              </Text>
            </View>
          ) : null}
        </View>

        {item.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesText} numberOfLines={2}>
              {t('Note')}: {item.notes}
            </Text>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtnView}
            onPress={() => handleOpenView(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="eye-outline" size={15} color={colors.slate800} />
            <Text style={styles.actionBtnTextView}>{t('Details')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnManage}
            onPress={() => handleOpenManage(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={15} color={colors.white} />
            <Text style={styles.actionBtnTextManage}>{t('Manage Cycle')}</Text>
          </TouchableOpacity>
        </View>
      </BentoCard>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('Loading crop cycles...')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Sticky Header Panel */}
      <View style={styles.stickyHeader}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerTitle}>{t('Crop Cycles')}</Text>
            <Text style={styles.headerSubtitle}>{t('Monitor sowing, stages, and harvest yield')}</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{filteredCycles.length}</Text>
          </View>
        </View>

        <SearchFilterBar
          query={search}
          onChangeQuery={setSearch}
          placeholder={t('Search crop, farm or season...')}
        />

        {/* Status Filter Chips */}
        <View style={styles.chipsRow}>
          <QuickChipGroup
            options={STATUS_FILTER_OPTIONS}
            selectedValue={statusFilter}
            onSelect={(val) => setStatusFilter(val)}
            size="sm"
          />
        </View>
      </View>

      <FlatList
        data={filteredCycles}
        keyExtractor={(item, index) => item.ulid || item.id?.toString() || index.toString()}
        renderItem={renderCycleItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            mciIcon="sprout-outline"
            title={search || statusFilter !== 'ACTIVE' ? t('No Matching Crop Cycles') : t('No Crop Cycles Yet')}
            message={
              search || statusFilter !== 'ACTIVE'
                ? t('Try adjusting your search query or filter options.')
                : t('Initiate a new sowing cycle to track inputs, harvest, and activities.')
            }
            actionLabel={
              !search && statusFilter === 'ACTIVE'
                ? t('+ New Crop Cycle')
                : undefined
            }
            onAction={() => setCreateModalVisible(true)}
            secondaryActionLabel={
              search || statusFilter !== 'ACTIVE'
                ? t('Clear Filters')
                : undefined
            }
            onSecondaryAction={() => {
              setSearch('');
              setStatusFilter('ACTIVE');
            }}
          />
        }
      />

      <TouchableOpacity
        style={styles.floatingActionBtn}
        onPress={() => setCreateModalVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Create Cycle Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={createModalVisible}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>{t('Initiate Crop Cycle')}</Text>
                <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.slate600} />
                </TouchableOpacity>
              </View>

              {/* Farm Selector */}
              <SearchableSelect
                label={t('Associate Farm')}
                required
                placeholder={t('Select Farm')}
                searchPlaceholder="Search active farms..."
                items={activeFarms.map((f) => ({
                  value: (f.ulid || f.id!).toString(),
                  label: f.name,
                  sublabel: `${f.area} ${t(f.area_unit.toLowerCase())}`,
                  icon: 'business-outline',
                }))}
                value={farmId || null}
                onSelect={(targetId) => {
                  setFarmId(targetId);
                  const selectedFarm = activeFarms.find(f => (f.ulid || f.id!).toString() === targetId);
                  if (selectedFarm) {
                    setAllocatedAreaUnit(selectedFarm.area_unit || 'ACRE');
                  }
                }}
                emptyMessage={t('No active farms found. Create one first.')}
              />

              {/* Crop Master Selector */}
              <SearchableSelect
                label={t('Crop')}
                required
                placeholder={t('Select Crop')}
                searchPlaceholder="Search crops by name or category..."
                items={crops.map((c) => ({
                  value: (c.ulid || c.id!).toString(),
                  label: c.name,
                  sublabel: c.category || undefined,
                  icon: 'leaf-outline',
                }))}
                value={cropId || null}
                onSelect={(cid) => {
                  setCropId(cid);
                  const c = crops.find(crop => (crop.ulid || crop.id!).toString() === cid);
                  if (c) {
                    const year = new Date(startedOn).getFullYear() || new Date().getFullYear();
                    const varText = cropType.trim() ? ` ${cropType.trim()}` : '';
                    setSeasonName(`${c.name}${varText} ${year}`);
                  }
                }}
                emptyMessage={t('No crops available. Create a crop in Masters first.')}
              />

              <ModernInput
                label={t('Variety / Crop Type (Optional)')}
                placeholder="e.g. Bhagwa, Kesar, Alphonso"
                value={cropType}
                onChangeText={(val) => {
                  setCropType(val);
                  const selCrop = crops.find((c) => (c.ulid || c.id)?.toString() === cropId.toString());
                  if (selCrop) {
                    const year = new Date(startedOn).getFullYear() || new Date().getFullYear();
                    const varText = val.trim() ? ` ${val.trim()}` : '';
                    setSeasonName(`${selCrop.name}${varText} ${year}`);
                  }
                }}
                containerStyle={{ marginTop: spacing.sm }}
              />

              <ModernInput
                label={t('Allocated Area')}
                required
                placeholder="e.g. 5.0"
                keyboardType="decimal-pad"
                suffix={allocatedAreaUnit}
                value={allocatedArea}
                onChangeText={setAllocatedArea}
                containerStyle={{ marginTop: spacing.sm }}
              />
              {currentFarmAreaInfo && (
                <View style={styles.areaInfoBox}>
                  <Ionicons name="pie-chart-outline" size={14} color="#059669" />
                  <Text style={styles.areaInfoText}>
                    Remaining on {currentFarmAreaInfo.name}: <Text style={{ fontWeight: '700' }}>{currentFarmAreaInfo.remaining} {currentFarmAreaInfo.unit}</Text> (Total: {currentFarmAreaInfo.total} {currentFarmAreaInfo.unit})
                  </Text>
                </View>
              )}

              <Text style={[styles.inputLabel, { marginTop: spacing.sm }]}>{t('Area Measurement Unit')}</Text>
              <QuickChipGroup
                options={AREA_UNIT_OPTIONS}
                selectedValue={allocatedAreaUnit}
                onSelect={(val) => setAllocatedAreaUnit(val)}
                size="sm"
              />

              <ModernInput
                label={t('Season Name')}
                placeholder="e.g. Kharif 2026, Summer"
                value={seasonName}
                onChangeText={setSeasonName}
                containerStyle={{ marginTop: spacing.sm, marginBottom: spacing.sm }}
              />

              <ModernDatePicker
                label={t('Started On Date')}
                value={startedOn}
                onChange={setStartedOn}
                containerStyle={{ marginBottom: spacing.sm }}
              />

              <ModernDatePicker
                label={t('Expected Harvest Date')}
                value={expectedHarvestOn}
                onChange={setExpectedHarvestOn}
                containerStyle={{ marginBottom: spacing.sm }}
              />

              <ModernInput
                label={t('Notes')}
                placeholder="Any special remarks or sowing details..."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                containerStyle={{ marginBottom: spacing.sm }}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setCreateModalVisible(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleCreateCycle}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>{t('Start Cycle')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* View & Manage Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {isEditing ? t('Manage Crop Cycle') : t('Crop Cycle Details')}
                </Text>
                <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.slate600} />
                </TouchableOpacity>
              </View>

              {isEditing ? (
                <View>
                  <SearchableSelect
                    label={t('Associate Farm')}
                    placeholder={t('Select Farm')}
                    searchPlaceholder="Search farms..."
                    items={farms.map((f) => ({
                      value: (f.ulid || f.id!).toString(),
                      label: f.name,
                      sublabel: `${f.area} ${t(f.area_unit.toLowerCase())}`,
                      icon: 'business-outline',
                    }))}
                    value={editFarmId || null}
                    onSelect={(targetId) => setEditFarmId(targetId)}
                    emptyMessage="No farms found"
                  />

                  {/* Edit Crop Selector */}
                  <SearchableSelect
                    label={t('Crop')}
                    placeholder={t('Select Crop')}
                    searchPlaceholder="Search crops by name or category..."
                    items={crops.map((c) => ({
                      value: (c.ulid || c.id!).toString(),
                      label: c.name,
                      sublabel: c.category || undefined,
                      icon: 'leaf-outline',
                    }))}
                    value={editCropId || null}
                    onSelect={(cid) => setEditCropId(cid)}
                    emptyMessage="No crops found"
                  />

                  <ModernInput
                    label={t('Variety / Crop Type (Optional)')}
                    placeholder="e.g. Bhagwa, Kesar, Alphonso"
                    value={editCropType}
                    onChangeText={setEditCropType}
                    containerStyle={{ marginTop: spacing.sm }}
                  />

                  <ModernInput
                    label={t('Allocated Area')}
                    keyboardType="decimal-pad"
                    suffix={editAllocatedAreaUnit}
                    value={editAllocatedArea}
                    onChangeText={setEditAllocatedArea}
                    containerStyle={{ marginTop: spacing.sm }}
                  />
                  {editFarmAreaInfo && (
                    <View style={styles.areaInfoBox}>
                      <Ionicons name="pie-chart-outline" size={14} color="#059669" />
                      <Text style={styles.areaInfoText}>
                        Available on {editFarmAreaInfo.name}: <Text style={{ fontWeight: '700' }}>{editFarmAreaInfo.remaining} {editFarmAreaInfo.unit}</Text> (Total: {editFarmAreaInfo.total} {editFarmAreaInfo.unit})
                      </Text>
                    </View>
                  )}

                  <Text style={[styles.inputLabel, { marginTop: spacing.sm }]}>{t('Area Measurement Unit')}</Text>
                  <QuickChipGroup
                    options={AREA_UNIT_OPTIONS}
                    selectedValue={editAllocatedAreaUnit}
                    onSelect={(val) => setEditAllocatedAreaUnit(val)}
                    size="sm"
                  />

                  <ModernInput
                    label={t('Season Name')}
                    value={editSeasonName}
                    onChangeText={setEditSeasonName}
                    containerStyle={{ marginTop: spacing.sm, marginBottom: spacing.sm }}
                  />

                  <ModernDatePicker
                    label={t('Started On Date')}
                    value={editStartedOn}
                    onChange={setEditStartedOn}
                    containerStyle={{ marginBottom: spacing.sm, marginTop: spacing.xs }}
                  />

                  <ModernDatePicker
                    label={t('Expected Harvest Date')}
                    value={editExpectedHarvestOn}
                    onChange={setEditExpectedHarvestOn}
                    containerStyle={{ marginBottom: spacing.sm }}
                  />

                  <Text style={styles.inputLabel}>{t('Cycle Status')}</Text>
                  <QuickChipGroup
                    options={CYCLE_STATUS_OPTIONS}
                    selectedValue={editStatus}
                    onSelect={(val) => setEditStatus(val)}
                    size="sm"
                  />

                  {editStatus === 'COMPLETED' && (
                    <View style={{ marginTop: spacing.md }}>
                      <ModernDatePicker
                        label={t('Actual Harvest Date')}
                        value={editActualHarvestOn}
                        onChange={setEditActualHarvestOn}
                        containerStyle={{ marginBottom: spacing.sm }}
                      />

                      <ModernInput
                        label={t('Harvest Yield Amount')}
                        placeholder="e.g. 500"
                        keyboardType="decimal-pad"
                        value={editHarvestAmount}
                        onChangeText={setEditHarvestAmount}
                        containerStyle={{ marginBottom: spacing.sm }}
                      />

                      <ModernInput
                        label={t('Harvest Yield Unit')}
                        placeholder="e.g. KG, QUINTAL, BAGS"
                        value={editHarvestUnit}
                        onChangeText={setEditHarvestUnit}
                        containerStyle={{ marginBottom: spacing.sm }}
                      />
                    </View>
                  )}

                  <ModernInput
                    label={t('Notes')}
                    value={editNotes}
                    onChangeText={setEditNotes}
                    multiline
                    numberOfLines={3}
                    containerStyle={{ marginTop: spacing.sm, marginBottom: spacing.sm }}
                  />

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.cancelBtn]}
                      onPress={() => setIsEditing(false)}
                      disabled={updating}
                    >
                      <Text style={styles.cancelBtnText}>{t('Back to View')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalBtn, styles.saveBtn]}
                      onPress={handleUpdateCycle}
                      disabled={updating}
                    >
                      {updating ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={styles.saveBtnText}>{t('Save')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.detailsView}>
                  <View style={styles.detailCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t('Crop Name:')}</Text>
                      <Text style={styles.detailValue}>
                        {selectedCycle?.crop_name || selectedCycle?.crop_type || t('Unknown Crop')}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t('Associated Farm:')}</Text>
                      <Text style={styles.detailValue}>
                        {farms.find(
                          (f) =>
                            f.ulid === selectedCycle?.farm_id || f.id === selectedCycle?.farm_id
                        )?.name || t('Unknown Farm')}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t('Allocated Area:')}</Text>
                      <Text style={styles.detailValue}>
                        {selectedCycle?.allocated_area} {selectedCycle?.allocated_area_unit}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t('Status:')}</Text>
                      <StatusBadge
                        label={t(selectedCycle?.status?.charAt(0).toUpperCase() + (selectedCycle?.status?.slice(1).toLowerCase() || ''))}
                        variant={getStatusVariant(selectedCycle?.status || 'ACTIVE')}
                        dot={selectedCycle?.status === 'ACTIVE'}
                      />
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t('Season:')}</Text>
                      <Text style={styles.detailValue}>
                        {selectedCycle?.season_name || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t('Started On:')}</Text>
                      <Text style={styles.detailValue}>
                        {selectedCycle?.started_on
                          ? selectedCycle.started_on.split('T')[0]
                          : 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t('Expected Harvest:')}</Text>
                      <Text style={styles.detailValue}>
                        {selectedCycle?.expected_harvest_on
                          ? selectedCycle.expected_harvest_on.split('T')[0]
                          : 'N/A'}
                      </Text>
                    </View>

                    {selectedCycle?.status === 'COMPLETED' && (
                      <>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>{t('Actual Harvest Date:')}</Text>
                          <Text style={styles.detailValue}>
                            {selectedCycle?.actual_harvest_on
                              ? selectedCycle.actual_harvest_on.split('T')[0]
                              : 'N/A'}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>{t('Harvest Yield:')}</Text>
                          <Text style={styles.detailValue}>
                            {selectedCycle?.harvest_amount}{' '}
                            {selectedCycle?.harvest_unit || ''}
                          </Text>
                        </View>
                      </>
                    )}

                    {selectedCycle?.notes ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.detailLabel, { marginBottom: 4 }]}>{t('Notes:')}</Text>
                        <Text style={[styles.detailValue, { fontWeight: 'normal', color: colors.slate600 }]}>
                          {selectedCycle.notes}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={[styles.modalActions, { gap: 10 }]}>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.deleteBtn]}
                      onPress={() => selectedCycle && handleDeleteCycle(selectedCycle)}
                    >
                      <Text style={styles.deleteBtnText}>{t('Delete')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.saveBtn]}
                      onPress={() => selectedCycle && setIsEditing(true)}
                    >
                      <Text style={styles.saveBtnText}>{t('Edit Details')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Confirm Delete Bottom Sheet Modal */}
      <ConfirmModal
        visible={deleteConfirmVisible}
        onClose={() => {
          if (!deleting) setDeleteConfirmVisible(false);
        }}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title={t('Delete Crop Cycle')}
        message={t('Are you sure you want to delete this crop cycle? This action cannot be undone.')}
        confirmLabel={t('Delete Crop Cycle')}
        cancelLabel={t('Cancel')}
        variant="danger"
        icon="trash-outline"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.slate50,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.slate500,
    fontWeight: '600',
  },
  stickyHeader: {
    backgroundColor: colors.white,
    paddingTop: 12,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    gap: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.slate900,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.slate500,
    marginTop: 2,
  },
  headerBadge: {
    minWidth: 32,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  chipsRow: {
    marginTop: 2,
  },
  listContainer: {
    padding: spacing.lg,
    paddingBottom: 90,
    gap: 10,
  },
  cycleCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  cycleCardInactive: {
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cropHeaderMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 10,
  },
  cropIconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate900,
  },
  farmLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  farmName: {
    fontSize: 12,
    color: colors.slate500,
    fontWeight: '500',
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  pillIcon: {
    marginRight: 4,
  },
  pillValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate800,
  },
  notesBox: {
    backgroundColor: colors.slate50,
    borderRadius: radius.xs,
    padding: 8,
    marginTop: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  notesText: {
    fontSize: 12,
    color: colors.slate600,
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: 10,
  },
  actionBtnView: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.slate100,
    gap: 6,
  },
  actionBtnManage: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    gap: 6,
  },
  actionBtnTextView: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate800,
  },
  actionBtnTextManage: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate800,
    marginTop: 14,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.slate500,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 30,
  },
  floatingActionBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.glowPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.lg,
    maxHeight: '90%',
    ...shadows.medium,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
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
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.slate900,
    backgroundColor: colors.slate50,
  },
  multilineInput: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  dropdownTrigger: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    backgroundColor: colors.slate50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownTriggerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate800,
  },
  dropdownList: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    marginTop: 4,
    maxHeight: 180,
    overflow: 'hidden',
    ...shadows.subtle,
  },
  dropdownEmptyText: {
    padding: 12,
    fontSize: 13,
    color: colors.slate500,
    fontStyle: 'italic',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  dropdownItemText: {
    fontSize: 14,
    color: colors.slate800,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
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
  deleteBtn: {
    backgroundColor: colors.dangerSurface,
  },
  deleteBtnText: {
    color: colors.dangerText,
    fontWeight: '700',
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: colors.primary,
  },
  saveBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  detailsView: {
    width: '100%',
  },
  detailCard: {
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    marginBottom: spacing.md,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate500,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
  areaInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
    marginBottom: spacing.xs,
  },
  areaInfoText: {
    fontSize: 12,
    color: '#065f46',
    flex: 1,
  },
});
