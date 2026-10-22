import React, { useState, useEffect } from 'react';
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
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { farmsApi } from '../../src/api/farms';
import { Farm } from '../../src/types';
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
  { label: 'Acre', value: 'acre' },
  { label: 'Bigha', value: 'bigha' },
  { label: 'Hectare', value: 'hectare' },
  { label: 'Guntha', value: 'guntha' },
];

export default function FarmsScreen() {
  const { isAuthenticated } = useAuth();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');

  // Create Farm Modal State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [areaUnit, setAreaUnit] = useState('acre');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  // View/Manage Modal State
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editAreaUnit, setEditAreaUnit] = useState('acre');
  const [editLocation, setEditLocation] = useState('');
  const [updating, setUpdating] = useState(false);
  const [nameError, setNameError] = useState('');
  const [areaError, setAreaError] = useState('');
  const [editNameError, setEditNameError] = useState('');
  const [editAreaError, setEditAreaError] = useState('');

  const fetchFarms = async () => {
    try {
      const data = await farmsApi.getAll();
      setFarms(data);
    } catch (error: any) {
      console.error('Error fetching farms:', error);
      Alert.alert('Error', 'Failed to fetch farms from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchFarms();
    }
  }, [isAuthenticated]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFarms();
  };

  const handleCreateFarm = async () => {
    setNameError('');
    setAreaError('');

    let hasError = false;
    if (!name.trim()) {
      setNameError('Farm name is required.');
      hasError = true;
    }
    if (!area.trim()) {
      setAreaError('Area size is required.');
      hasError = true;
    } else if (isNaN(Number(area)) || Number(area) <= 0) {
      setAreaError('Area size must be a valid positive number.');
      hasError = true;
    }

    if (hasError) return;

    setSaving(true);
    try {
      const newFarm: Farm = {
        name,
        area: parseFloat(area),
        area_unit: areaUnit,
        location,
        is_active: true,
      };

      const createdFarm = await farmsApi.create(newFarm);

      setName('');
      setArea('');
      setAreaUnit('acre');
      setLocation('');
      setCreateModalVisible(false);

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
      console.error('Error creating farm:', error);
      const msg = extractErrorMessage(error, 'Failed to create farm.');
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateFarm = async () => {
    if (!selectedFarm || (!selectedFarm.id && !selectedFarm.ulid)) return;
    setEditNameError('');
    setEditAreaError('');

    let hasError = false;
    if (!editName.trim()) {
      setEditNameError('Farm name is required.');
      hasError = true;
    }
    if (!editArea.trim()) {
      setEditAreaError('Area size is required.');
      hasError = true;
    } else if (isNaN(Number(editArea)) || Number(editArea) <= 0) {
      setEditAreaError('Area size must be a valid positive number.');
      hasError = true;
    }

    if (hasError) return;

    setUpdating(true);
    const identifier = selectedFarm.ulid || selectedFarm.id!;
    try {
      const updatedFarm: Farm = {
        ...selectedFarm,
        name: editName,
        area: parseFloat(editArea),
        area_unit: editAreaUnit,
        location: editLocation,
      };

      const result = await farmsApi.update(identifier, updatedFarm);
      Alert.alert('Success', 'Farm updated successfully!');
      setIsEditing(false);
      setSelectedFarm(result);
      fetchFarms();
    } catch (error: any) {
      console.error('Error updating farm:', error);
      const msg = extractErrorMessage(error, 'Failed to update farm.');
      Alert.alert('Error', msg);
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleFarmStatus = async (farm: Farm) => {
    if (!farm.id && !farm.ulid) return;
    const identifier = farm.ulid || farm.id!;

    try {
      const updatedFarm = { ...farm, is_active: !farm.is_active };
      // Optimistic update
      setFarms((prev) =>
        prev.map((f) => (f.ulid === farm.ulid || f.id === farm.id ? updatedFarm : f))
      );
      if (selectedFarm && (selectedFarm.ulid === farm.ulid || selectedFarm.id === farm.id)) {
        setSelectedFarm(updatedFarm);
      }
      await farmsApi.update(identifier, updatedFarm);
    } catch (error) {
      console.error('Failed to update status:', error);
      Alert.alert('Error', 'Failed to update farm status.');
      fetchFarms();
    }
  };

  const handleOpenManage = (farm: Farm) => {
    router.push({
      pathname: '/farm-hub',
      params: {
        farm_id: farm.id,
        farm_ulid: farm.ulid || '',
      },
    });
  };

  const handleOpenView = (farm: Farm) => {
    router.push({
      pathname: '/farm-view',
      params: {
        farm_id: farm.id,
        farm_ulid: farm.ulid || '',
      },
    });
  };

  // Filter farms client-side
  const getFilteredFarms = () => {
    return farms.filter((farm) => {
      const matchesSearch =
        farm.name.toLowerCase().includes(search.toLowerCase()) ||
        (farm.location && farm.location.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && farm.is_active) ||
        (statusFilter === 'inactive' && !farm.is_active);

      return matchesSearch && matchesStatus;
    });
  };

  const filteredFarms = getFilteredFarms();

  const activeCount = farms.filter((f) => f.is_active).length;
  const inactiveCount = farms.filter((f) => !f.is_active).length;

  const STATUS_FILTER_OPTIONS: ChipOption<'active' | 'inactive' | 'all'>[] = [
    { label: 'Active', value: 'active', badge: activeCount },
    { label: 'Inactive', value: 'inactive', badge: inactiveCount },
    { label: 'All', value: 'all', badge: farms.length },
  ];

  const renderFarmItem = ({ item }: { item: Farm }) => (
    <BentoCard
      variant="elevated"
      style={[styles.farmCard, !item.is_active && styles.farmCardInactive]}
    >
      <View style={styles.farmCardTop}>
        <View style={styles.farmHeaderInfo}>
          <View style={styles.farmIconWrap}>
            <MaterialCommunityIcons name="sprout" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.farmName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.farmLocationRow}>
              <Ionicons name="location-outline" size={12} color={colors.slate500} />
              <Text style={styles.farmLocation} numberOfLines={1}>
                {item.location || 'Location not specified'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={() => handleToggleFarmStatus(item)} activeOpacity={0.7}>
          <StatusBadge
            label={item.is_active ? 'Active' : 'Inactive'}
            variant={item.is_active ? 'success' : 'neutral'}
            dot
          />
        </TouchableOpacity>
      </View>

      {/* 3 Glanceable Metric Pills */}
      <View style={styles.pillsRow}>
        <View style={styles.pill}>
          <Ionicons name="map-outline" size={14} color={colors.primary} style={styles.pillIcon} />
          <Text style={styles.pillValue}>
            {parseFloat(item.area as string).toFixed(1)} {item.area_unit.toLowerCase()}(s)
          </Text>
        </View>

        <View style={styles.pill}>
          <Ionicons name="people-outline" size={14} color={colors.accent} style={styles.pillIcon} />
          <Text style={styles.pillValue}>{item.assigned_staff_count ?? 0} staff</Text>
        </View>

        <View style={styles.pill}>
          <Ionicons name="leaf-outline" size={14} color={colors.info} style={styles.pillIcon} />
          <Text style={styles.pillValue}>{item.active_cycles_count ?? 0} crops</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtnView}
          onPress={() => handleOpenView(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="eye-outline" size={16} color={colors.slate800} />
          <Text style={styles.actionBtnTextView}>Overview</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtnManage}
          onPress={() => handleOpenManage(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={15} color={colors.white} />
          <Text style={styles.actionBtnTextManage}>Manage Farm Hub</Text>
        </TouchableOpacity>
      </View>
    </BentoCard>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading farms...</Text>
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
            <Text style={styles.headerTitle}>Farms & Plots</Text>
            <Text style={styles.headerSubtitle}>Manage plots, crops, and operations</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{filteredFarms.length}</Text>
          </View>
        </View>

        {/* Search Bar */}
        <SearchFilterBar
          query={search}
          onChangeQuery={setSearch}
          placeholder="Search by farm name or location..."
        />

        {/* Status Filter Chips */}
        <View style={styles.chipsFilterRow}>
          <QuickChipGroup
            options={STATUS_FILTER_OPTIONS}
            selectedValue={statusFilter}
            onSelect={(val) => setStatusFilter(val)}
            size="sm"
          />
        </View>
      </View>

      <FlatList
        data={filteredFarms}
        keyExtractor={(item, index) => item.ulid || item.id?.toString() || index.toString()}
        renderItem={renderFarmItem}
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
              <Ionicons name="leaf-outline" size={32} color={colors.slate400} />
            </View>
            <Text style={styles.emptyText}>No farms found</Text>
            <Text style={styles.emptySubtext}>
              Try adjusting your search query or tap "+" to record a new farm plot.
            </Text>
          </View>
        }
      />

      {/* Glowing Floating Action Button */}
      <TouchableOpacity
        style={styles.floatingActionBtn}
        onPress={() => {
          setNameError('');
          setAreaError('');
          setCreateModalVisible(true);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Create Farm Modal */}
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
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add New Farm Plot</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>
              Farm Name <Text style={styles.asterisk}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, nameError ? styles.inputErrorBorder : null]}
              placeholder="e.g. Green Acres"
              placeholderTextColor={colors.slate400}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (text.trim()) setNameError('');
              }}
            />
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

            <Text style={styles.inputLabel}>
              Area Size <Text style={styles.asterisk}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, areaError ? styles.inputErrorBorder : null]}
              placeholder="e.g. 10.5"
              placeholderTextColor={colors.slate400}
              keyboardType="decimal-pad"
              value={area}
              onChangeText={(text) => {
                setArea(text);
                if (text.trim()) setAreaError('');
              }}
            />
            {areaError ? <Text style={styles.errorText}>{areaError}</Text> : null}

            <Text style={styles.inputLabel}>Area Measurement Unit</Text>
            <QuickChipGroup
              options={AREA_UNIT_OPTIONS}
              selectedValue={areaUnit}
              onSelect={(val) => setAreaUnit(val)}
              size="sm"
            />

            <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Location (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. California Valley"
              placeholderTextColor={colors.slate400}
              value={location}
              onChangeText={setLocation}
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
                onPress={handleCreateFarm}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Farm</Text>
                )}
              </TouchableOpacity>
            </View>
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
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                {isEditing ? 'Manage Farm' : 'Farm Details'}
              </Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            {isEditing ? (
              <View>
                <Text style={styles.inputLabel}>
                  Farm Name <Text style={styles.asterisk}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, editNameError ? styles.inputErrorBorder : null]}
                  value={editName}
                  onChangeText={(text) => {
                    setEditName(text);
                    if (text.trim()) setEditNameError('');
                  }}
                />
                {editNameError ? <Text style={styles.errorText}>{editNameError}</Text> : null}

                <Text style={styles.inputLabel}>
                  Area Size <Text style={styles.asterisk}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, editAreaError ? styles.inputErrorBorder : null]}
                  keyboardType="decimal-pad"
                  value={editArea}
                  onChangeText={(text) => {
                    setEditArea(text);
                    if (text.trim()) setEditAreaError('');
                  }}
                />
                {editAreaError ? <Text style={styles.errorText}>{editAreaError}</Text> : null}

                <Text style={styles.inputLabel}>Area Measurement Unit</Text>
                <QuickChipGroup
                  options={AREA_UNIT_OPTIONS}
                  selectedValue={editAreaUnit}
                  onSelect={(val) => setEditAreaUnit(val)}
                  size="sm"
                />

                <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Location</Text>
                <TextInput
                  style={styles.input}
                  value={editLocation}
                  onChangeText={setEditLocation}
                />

                <View style={[styles.row, { justifyContent: 'space-between', marginTop: 15, alignItems: 'center' }]}>
                  <Text style={styles.statusLabelText}>Status:</Text>
                  <TouchableOpacity
                    onPress={() => selectedFarm && handleToggleFarmStatus(selectedFarm)}
                    activeOpacity={0.7}
                  >
                    <StatusBadge
                      label={selectedFarm?.is_active ? 'Active' : 'Inactive'}
                      variant={selectedFarm?.is_active ? 'success' : 'neutral'}
                      dot
                    />
                  </TouchableOpacity>
                </View>

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
                    onPress={handleUpdateFarm}
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
                    <Text style={styles.detailLabel}>Name:</Text>
                    <Text style={styles.detailValue}>{selectedFarm?.name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Location:</Text>
                    <Text style={styles.detailValue}>{selectedFarm?.location || 'Location not set'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Area:</Text>
                    <Text style={styles.detailValue}>
                      {selectedFarm?.area} {selectedFarm?.area_unit}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <StatusBadge
                      label={selectedFarm?.is_active ? 'Active' : 'Inactive'}
                      variant={selectedFarm?.is_active ? 'success' : 'neutral'}
                      dot
                    />
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Staff Assigned:</Text>
                    <Text style={styles.detailValue}>
                      {selectedFarm?.assigned_staff_count ?? 0} staff members
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Active Crops:</Text>
                    <Text style={styles.detailValue}>
                      {selectedFarm?.active_cycles_count ?? 0} active cycles
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn, { marginRight: 0 }]}
                    onPress={() => setDetailModalVisible(false)}
                  >
                    <Text style={styles.cancelBtnText}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.saveBtn, { marginLeft: 12 }]}
                    onPress={() => selectedFarm && handleOpenManage(selectedFarm)}
                  >
                    <Text style={styles.saveBtnText}>Open Farm Hub</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
  chipsFilterRow: {
    marginTop: 2,
  },
  listContainer: {
    padding: spacing.lg,
    paddingBottom: 90,
    gap: spacing.md,
  },
  farmCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  farmCardInactive: {
    opacity: 0.75,
  },
  farmCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  farmHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 10,
  },
  farmIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmName: {
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
  farmLocation: {
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
  asterisk: {
    color: colors.danger,
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
  inputErrorBorder: {
    borderColor: colors.danger,
    borderWidth: 1.5,
  },
  errorText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
  },
  statusLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate700,
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
