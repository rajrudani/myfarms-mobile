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
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { cropCyclesApi } from '../../src/api/cropCycles';
import { farmsApi } from '../../src/api/farms';
import { CropCycle, Farm } from '../../src/types';
import { useAuth } from '../../src/hooks/useAuth';
import { extractErrorMessage } from '../../src/api/client';
import { colors, radius, spacing, shadows } from '../../src/theme/tokens';
import {
  BentoCard,
  StatusBadge,
  SearchFilterBar,
  QuickChipGroup,
  ChipOption,
} from '../../src/components/ui';

const AREA_UNIT_OPTIONS: ChipOption<string>[] = [
  { label: 'Acre', value: 'ACRE' },
  { label: 'Hectare', value: 'HECTARE' },
  { label: 'Bigha', value: 'BIGHAS' },
  { label: 'Guntha', value: 'GUNTHAS' },
];

const CYCLE_STATUS_OPTIONS: ChipOption<string>[] = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export default function CropCyclesScreen() {
  const { isAuthenticated } = useAuth();
  const [cycles, setCycles] = useState<CropCycle[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'all'>('ACTIVE');

  // Create Cycle Modal State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [farmId, setFarmId] = useState('');
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

  // View/Manage Modal State
  const [selectedCycle, setSelectedCycle] = useState<CropCycle | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit Form State
  const [editFarmId, setEditFarmId] = useState('');
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

  const fetchData = async () => {
    try {
      const [cycleData, farmData] = await Promise.all([
        cropCyclesApi.getAll(),
        farmsApi.getAll(),
      ]);
      setCycles(cycleData);
      setFarms(farmData);
    } catch (error: any) {
      console.error('Error fetching crop cycles data:', error);
      Alert.alert('Error', 'Failed to fetch data from server.');
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

  const handleCreateCycle = async () => {
    if (!farmId || !cropType || !allocatedArea) {
      Alert.alert('Validation Error', 'Farm, Crop name, and Allocated Area are required.');
      return;
    }

    setSaving(true);
    try {
      const newCycle: CropCycle = {
        farm_id: farmId,
        crop_type: cropType,
        allocated_area: parseFloat(allocatedArea),
        allocated_area_unit: allocatedAreaUnit,
        season_name: seasonName || undefined,
        started_on: startedOn,
        expected_harvest_on: expectedHarvestOn || undefined,
        status: 'ACTIVE',
        notes: notes || undefined,
      };

      await cropCyclesApi.create(newCycle);
      Alert.alert('Success', 'Crop cycle added successfully!');

      setFarmId('');
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
      const msg = extractErrorMessage(error, 'Failed to add crop cycle.');
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCycle = async () => {
    if (!selectedCycle || (!selectedCycle.id && !selectedCycle.ulid)) return;
    if (!editFarmId || !editCropType || !editAllocatedArea) {
      Alert.alert('Validation Error', 'Farm, Crop type, and Area are required.');
      return;
    }

    setUpdating(true);
    const identifier = selectedCycle.ulid || selectedCycle.id!;
    try {
      const updatedCycle: CropCycle = {
        ...selectedCycle,
        farm_id: editFarmId,
        crop_type: editCropType,
        allocated_area: parseFloat(editAllocatedArea),
        allocated_area_unit: editAllocatedAreaUnit,
        season_name: editSeasonName || undefined,
        started_on: editStartedOn,
        expected_harvest_on: editExpectedHarvestOn || undefined,
        actual_harvest_on: editActualHarvestOn || undefined,
        status: editStatus,
        harvest_amount: editHarvestAmount ? parseFloat(editHarvestAmount) : undefined,
        harvest_unit: editHarvestUnit || undefined,
        notes: editNotes || undefined,
      };

      const result = await cropCyclesApi.update(identifier, updatedCycle);
      Alert.alert('Success', 'Crop cycle updated successfully!');
      setIsEditing(false);
      setSelectedCycle(result);
      fetchData();
    } catch (error: any) {
      console.error('Error updating crop cycle:', error);
      const msg = extractErrorMessage(error, 'Failed to update crop cycle.');
      Alert.alert('Error', msg);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCycle = async (cycle: CropCycle) => {
    if (!cycle.id && !cycle.ulid) return;
    const identifier = cycle.ulid || cycle.id!;

    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this crop cycle? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await cropCyclesApi.delete(identifier);
              Alert.alert('Success', 'Crop cycle deleted successfully!');
              setDetailModalVisible(false);
              fetchData();
            } catch (error: any) {
              console.error('Error deleting crop cycle:', error);
              Alert.alert('Error', 'Failed to delete crop cycle.');
            }
          },
        },
      ]
    );
  };

  const getFarmName = (farmId?: any, farmObj?: Farm) => {
    if (farmObj?.name) return farmObj.name;
    const found = farms.find((f) => f.ulid === farmId || f.id === farmId);
    return found?.name || 'Unknown Farm';
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
    'Select Farm';
  const editSelectedFarmName =
    farms.find((f) => f.ulid === editFarmId || f.id?.toString() === editFarmId)?.name ||
    'Select Farm';

  const activeCount = cycles.filter((c) => c.status === 'ACTIVE').length;
  const completedCount = cycles.filter((c) => c.status === 'COMPLETED').length;
  const cancelledCount = cycles.filter((c) => c.status === 'CANCELLED').length;

  const STATUS_FILTER_OPTIONS: ChipOption<'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'all'>[] = [
    { label: 'Active', value: 'ACTIVE', badge: activeCount },
    { label: 'Completed', value: 'COMPLETED', badge: completedCount },
    { label: 'Cancelled', value: 'CANCELLED', badge: cancelledCount },
    { label: 'All', value: 'all', badge: cycles.length },
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
                {item.crop_name || item.crop_type || 'Unknown Crop'}
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
            label={item.status}
            variant={getStatusVariant(item.status)}
            dot={item.status === 'ACTIVE'}
          />
        </View>

        {/* 3 Glanceable Metric Pills */}
        <View style={styles.pillsRow}>
          <View style={styles.pill}>
            <Ionicons name="map-outline" size={13} color={colors.primary} style={styles.pillIcon} />
            <Text style={styles.pillValue}>
              {item.allocated_area} {item.allocated_area_unit.toLowerCase()}
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
              Note: {item.notes}
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
            <Text style={styles.actionBtnTextView}>Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnManage}
            onPress={() => handleOpenManage(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={15} color={colors.white} />
            <Text style={styles.actionBtnTextManage}>Manage Cycle</Text>
          </TouchableOpacity>
        </View>
      </BentoCard>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading crop cycles...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Sticky Header Panel */}
      <View style={styles.stickyHeader}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerTitle}>Crop Cycles</Text>
            <Text style={styles.headerSubtitle}>Monitor sowing, stages, and harvest yield</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{filteredCycles.length}</Text>
          </View>
        </View>

        <SearchFilterBar
          query={search}
          onChangeQuery={setSearch}
          placeholder="Search crop, farm or season..."
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
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="sprout-outline" size={32} color={colors.slate400} />
            </View>
            <Text style={styles.emptyText}>No crop cycles found</Text>
            <Text style={styles.emptySubtext}>
              Try adjusting your filters or tap "+" to initiate a new crop cycle.
            </Text>
          </View>
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
                <Text style={styles.modalTitle}>Initiate Crop Cycle</Text>
                <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.slate600} />
                </TouchableOpacity>
              </View>

              {/* Farm Selector Dropdown */}
              <Text style={styles.inputLabel}>
                Associate Farm <Text style={{ color: colors.danger }}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setShowFarmDropdown(!showFarmDropdown)}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownTriggerText}>{selectedFarmName}</Text>
                <Ionicons
                  name={showFarmDropdown ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.slate500}
                />
              </TouchableOpacity>

              {showFarmDropdown && (
                <View style={styles.dropdownList}>
                  {activeFarms.length === 0 ? (
                    <Text style={styles.dropdownEmptyText}>
                      No active farms found. Create one first.
                    </Text>
                  ) : (
                    activeFarms.map((f) => (
                      <TouchableOpacity
                        key={f.ulid || f.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setFarmId((f.ulid || f.id!).toString());
                          setShowFarmDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>
                          {f.name} ({f.area} {f.area_unit.toLowerCase()})
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}

              <Text style={styles.inputLabel}>
                Crop Type / Name <Text style={{ color: colors.danger }}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Wheat, Tomatoes, Cotton"
                placeholderTextColor={colors.slate400}
                value={cropType}
                onChangeText={setCropType}
              />

              <Text style={styles.inputLabel}>
                Allocated Area <Text style={{ color: colors.danger }}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 5.0"
                placeholderTextColor={colors.slate400}
                keyboardType="decimal-pad"
                value={allocatedArea}
                onChangeText={setAllocatedArea}
              />

              <Text style={styles.inputLabel}>Area Measurement Unit</Text>
              <QuickChipGroup
                options={AREA_UNIT_OPTIONS}
                selectedValue={allocatedAreaUnit}
                onSelect={(val) => setAllocatedAreaUnit(val)}
                size="sm"
              />

              <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Season Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Kharif 2026, Summer"
                placeholderTextColor={colors.slate400}
                value={seasonName}
                onChangeText={setSeasonName}
              />

              <Text style={styles.inputLabel}>Started On Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.slate400}
                value={startedOn}
                onChangeText={setStartedOn}
              />

              <Text style={styles.inputLabel}>Expected Harvest Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.slate400}
                value={expectedHarvestOn}
                onChangeText={setExpectedHarvestOn}
              />

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Any special remarks or sowing details..."
                placeholderTextColor={colors.slate400}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setCreateModalVisible(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleCreateCycle}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Start Cycle</Text>
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
                  {isEditing ? 'Manage Crop Cycle' : 'Crop Cycle Details'}
                </Text>
                <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.slate600} />
                </TouchableOpacity>
              </View>

              {isEditing ? (
                <View>
                  <Text style={styles.inputLabel}>Associate Farm</Text>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setShowEditFarmDropdown(!showEditFarmDropdown)}
                  >
                    <Text style={styles.dropdownTriggerText}>{editSelectedFarmName}</Text>
                    <Ionicons
                      name={showEditFarmDropdown ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.slate500}
                    />
                  </TouchableOpacity>

                  {showEditFarmDropdown && (
                    <View style={styles.dropdownList}>
                      {farms.map((f) => (
                        <TouchableOpacity
                          key={f.ulid || f.id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setEditFarmId((f.ulid || f.id!).toString());
                            setShowEditFarmDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>
                            {f.name} ({f.area} {f.area_unit.toLowerCase()})
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.inputLabel}>Crop Type / Name</Text>
                  <TextInput
                    style={styles.input}
                    value={editCropType}
                    onChangeText={setEditCropType}
                  />

                  <Text style={styles.inputLabel}>Allocated Area</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={editAllocatedArea}
                    onChangeText={setEditAllocatedArea}
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
                  />

                  <Text style={styles.inputLabel}>Started On Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={editStartedOn}
                    onChangeText={setEditStartedOn}
                  />

                  <Text style={styles.inputLabel}>Expected Harvest Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={editExpectedHarvestOn}
                    onChangeText={setEditExpectedHarvestOn}
                  />

                  <Text style={styles.inputLabel}>Cycle Status</Text>
                  <QuickChipGroup
                    options={CYCLE_STATUS_OPTIONS}
                    selectedValue={editStatus}
                    onSelect={(val) => setEditStatus(val)}
                    size="sm"
                  />

                  {editStatus === 'COMPLETED' && (
                    <View style={{ marginTop: spacing.md }}>
                      <Text style={styles.inputLabel}>Actual Harvest Date (YYYY-MM-DD)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.slate400}
                        value={editActualHarvestOn}
                        onChangeText={setEditActualHarvestOn}
                      />

                      <Text style={styles.inputLabel}>Harvest Yield Amount</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 500"
                        placeholderTextColor={colors.slate400}
                        keyboardType="decimal-pad"
                        value={editHarvestAmount}
                        onChangeText={setEditHarvestAmount}
                      />

                      <Text style={styles.inputLabel}>Harvest Yield Unit</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. KG, QUINTAL, BAGS"
                        placeholderTextColor={colors.slate400}
                        value={editHarvestUnit}
                        onChangeText={setEditHarvestUnit}
                      />
                    </View>
                  )}

                  <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={editNotes}
                    onChangeText={setEditNotes}
                    multiline
                    numberOfLines={3}
                  />

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.cancelBtn]}
                      onPress={() => setIsEditing(false)}
                      disabled={updating}
                    >
                      <Text style={styles.cancelBtnText}>Back to View</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalBtn, styles.saveBtn]}
                      onPress={handleUpdateCycle}
                      disabled={updating}
                    >
                      {updating ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={styles.saveBtnText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.detailsView}>
                  <View style={styles.detailCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Crop Name:</Text>
                      <Text style={styles.detailValue}>
                        {selectedCycle?.crop_name || selectedCycle?.crop_type || 'Unknown Crop'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Associated Farm:</Text>
                      <Text style={styles.detailValue}>
                        {farms.find(
                          (f) =>
                            f.ulid === selectedCycle?.farm_id || f.id === selectedCycle?.farm_id
                        )?.name || 'Unknown Farm'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Allocated Area:</Text>
                      <Text style={styles.detailValue}>
                        {selectedCycle?.allocated_area} {selectedCycle?.allocated_area_unit}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status:</Text>
                      <StatusBadge
                        label={selectedCycle?.status || 'ACTIVE'}
                        variant={getStatusVariant(selectedCycle?.status || 'ACTIVE')}
                        dot={selectedCycle?.status === 'ACTIVE'}
                      />
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Season:</Text>
                      <Text style={styles.detailValue}>
                        {selectedCycle?.season_name || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Started On:</Text>
                      <Text style={styles.detailValue}>
                        {selectedCycle?.started_on
                          ? selectedCycle.started_on.split('T')[0]
                          : 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Expected Harvest:</Text>
                      <Text style={styles.detailValue}>
                        {selectedCycle?.expected_harvest_on
                          ? selectedCycle.expected_harvest_on.split('T')[0]
                          : 'N/A'}
                      </Text>
                    </View>

                    {selectedCycle?.status === 'COMPLETED' && (
                      <>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Actual Harvest Date:</Text>
                          <Text style={styles.detailValue}>
                            {selectedCycle?.actual_harvest_on
                              ? selectedCycle.actual_harvest_on.split('T')[0]
                              : 'N/A'}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Harvest Yield:</Text>
                          <Text style={styles.detailValue}>
                            {selectedCycle?.harvest_amount}{' '}
                            {selectedCycle?.harvest_unit || ''}
                          </Text>
                        </View>
                      </>
                    )}

                    {selectedCycle?.notes ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.detailLabel, { marginBottom: 4 }]}>Notes:</Text>
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
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.saveBtn]}
                      onPress={() => selectedCycle && setIsEditing(true)}
                    >
                      <Text style={styles.saveBtnText}>Edit Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 12,
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
    gap: spacing.md,
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
});
