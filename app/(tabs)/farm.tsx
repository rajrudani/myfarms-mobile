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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { farmsApi } from '../../src/api/farms';
import { Farm } from '../../src/types';
import { useAuth } from '../../src/hooks/useAuth';
import { extractErrorMessage } from '../../src/api/client';
import { colors, radius, spacing, shadows } from '../../src/theme/tokens';
import {
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

export default function FarmsScreen() {
  const { isAuthenticated } = useAuth();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

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

  const formatAreaDisplay = (areaVal: number | string, unit?: string) => {
    const num = parseFloat(String(areaVal));
    const formatted = isNaN(num) ? '0.00' : num.toFixed(2);
    const rawUnit = unit || 'Acre';
    const capitalizedUnit = rawUnit.charAt(0).toUpperCase() + rawUnit.slice(1).toLowerCase();
    return `${formatted} ${capitalizedUnit}`;
  };

  const renderFarmItem = ({ item }: { item: Farm }) => (
    <View style={[styles.farmCard, !item.is_active && styles.farmCardInactive]}>
      {/* Top Row: Farm Name + Status Dot */}
      <View style={styles.farmCardTop}>
        <Text style={styles.farmName} numberOfLines={1}>
          {item.name}
        </Text>

        <TouchableOpacity
          onPress={() => handleToggleFarmStatus(item)}
          activeOpacity={0.7}
          style={styles.statusDotTouchArea}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={item.is_active ? 'Active farm' : 'Inactive farm'}
        >
          <View style={[styles.statusDotHalo, !item.is_active && styles.statusDotHaloInactive]}>
            <View style={[styles.statusDot, !item.is_active && styles.statusDotInactive]} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Location Row */}
      <View style={styles.farmLocationRow}>
        <Ionicons name="location-sharp" size={14} color={colors.slate500} />
        <Text style={styles.farmLocation} numberOfLines={1}>
          {item.location || 'Location not set'}
        </Text>
      </View>

      {/* 3 Glanceable Metric Pills */}
      <View style={styles.pillsRow}>
        <View style={styles.pill}>
          <Ionicons name="map-outline" size={14} color="#15803d" style={styles.pillIcon} />
          <Text style={styles.pillValue} numberOfLines={1}>
            {formatAreaDisplay(item.area, item.area_unit)}
          </Text>
        </View>

        <View style={styles.pill}>
          <Ionicons name="people-outline" size={14} color="#15803d" style={styles.pillIcon} />
          <Text style={styles.pillValue} numberOfLines={1}>
            {item.assigned_staff_count ?? 0} workers
          </Text>
        </View>

        <View style={styles.pill}>
          <Ionicons name="sparkles-outline" size={14} color="#15803d" style={styles.pillIcon} />
          <Text style={styles.pillValue} numberOfLines={1}>
            {item.active_cycles_count ?? 0} crops
          </Text>
        </View>
      </View>

      {/* Action Buttons: View & Manage */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtnView}
          onPress={() => handleOpenView(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="eye-outline" size={18} color="#1b4332" />
          <Text style={styles.actionBtnTextView}>View</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtnManage}
          onPress={() => handleOpenManage(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-sharp" size={16} color={colors.white} />
          <Text style={styles.actionBtnTextManage}>Manage</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading farms...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Sticky Header Panel */}
      <View style={styles.stickyHeader}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerTitle}>Farm List</Text>
            <Text style={styles.headerSubtitle}>Manage farms, activities, and expenses.</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{filteredFarms.length}</Text>
          </View>
        </View>

        {/* Search & Filter Row */}
        <View style={styles.searchFilterRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#64748b" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or location"
              placeholderTextColor="#94a3b8"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.filterBtn, statusFilter !== 'active' && styles.filterBtnActive]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel="Filter farms"
          >
            <Ionicons
              name="funnel-outline"
              size={19}
              color={statusFilter !== 'active' ? '#ffffff' : '#64748b'}
            />
          </TouchableOpacity>
        </View>

        {/* Active Filter Indicator Tag */}
        {statusFilter !== 'active' && (
          <View style={styles.activeFilterRow}>
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterChipText}>
                Status: {statusFilter === 'inactive' ? 'Inactive' : 'All'}
              </Text>
              <TouchableOpacity
                onPress={() => setStatusFilter('active')}
                style={styles.activeFilterChipClear}
                accessibilityLabel="Reset filter"
              >
                <Ionicons name="close" size={13} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
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
            colors={['#16a34a']}
            tintColor="#16a34a"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="leaf-outline" size={32} color={colors.slate400} />
            </View>
            <Text style={styles.emptyText}>No farms found</Text>
            <Text style={styles.emptySubtext}>
              Try adjusting your search query or tap "+" to record a new farm.
            </Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.floatingActionBtn}
        onPress={() => {
          setNameError('');
          setAreaError('');
          setCreateModalVisible(true);
        }}
        activeOpacity={0.8}
        accessibilityLabel="Add farm"
      >
        <Ionicons name="add" size={30} color={colors.white} />
      </TouchableOpacity>

      {/* Filter Bottom Sheet Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.filterModalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <View style={styles.filterModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.filterModalHandle} />

            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter by Status</Text>
              {statusFilter !== 'active' && (
                <TouchableOpacity
                  onPress={() => {
                    setStatusFilter('active');
                    setFilterModalVisible(false);
                  }}
                >
                  <Text style={styles.filterResetBtn}>RESET</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.filterOptionItem,
                statusFilter === 'active' && styles.filterOptionItemActive,
              ]}
              onPress={() => {
                setStatusFilter('active');
                setFilterModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.filterOptionLeft}>
                <View
                  style={[
                    styles.filterOptionDot,
                    { backgroundColor: '#22c55e' },
                  ]}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    statusFilter === 'active' && styles.filterOptionTextActive,
                  ]}
                >
                  Active Farms
                </Text>
              </View>
              <View style={styles.filterOptionRight}>
                <Text style={styles.filterOptionBadge}>{activeCount}</Text>
                {statusFilter === 'active' && (
                  <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterOptionItem,
                statusFilter === 'inactive' && styles.filterOptionItemActive,
              ]}
              onPress={() => {
                setStatusFilter('inactive');
                setFilterModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.filterOptionLeft}>
                <View
                  style={[
                    styles.filterOptionDot,
                    { backgroundColor: '#ef4444' },
                  ]}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    statusFilter === 'inactive' && styles.filterOptionTextActive,
                  ]}
                >
                  Inactive Farms
                </Text>
              </View>
              <View style={styles.filterOptionRight}>
                <Text style={styles.filterOptionBadge}>{inactiveCount}</Text>
                {statusFilter === 'inactive' && (
                  <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterOptionItem,
                statusFilter === 'all' && styles.filterOptionItemActive,
              ]}
              onPress={() => {
                setStatusFilter('all');
                setFilterModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.filterOptionLeft}>
                <View
                  style={[
                    styles.filterOptionDot,
                    { backgroundColor: '#64748b' },
                  ]}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    statusFilter === 'all' && styles.filterOptionTextActive,
                  ]}
                >
                  All Farms
                </Text>
              </View>
              <View style={styles.filterOptionRight}>
                <Text style={styles.filterOptionBadge}>{farms.length}</Text>
                {statusFilter === 'all' && (
                  <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
  stickyHeader: {
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 14 : 14,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 3,
  },
  headerBadge: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    height: '100%',
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  activeFilterChipText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  activeFilterChipClear: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: radius.pill,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 100,
    gap: 20,
  },
  farmCard: {
    backgroundColor: '#ffffff',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  farmCardInactive: {
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    opacity: 0.88,
  },
  farmCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  farmName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 22,
    marginRight: 10,
  },
  statusDotTouchArea: {
    padding: 2,
  },
  statusDotHalo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotHaloInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  statusDotInactive: {
    backgroundColor: '#ef4444',
  },
  farmLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  farmLocation: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  pill: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f6ee',
    borderRadius: 12,
    paddingHorizontal: 4,
    gap: 5,
  },
  pillIcon: {
    marginRight: 0,
  },
  pillValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  actionBtnView: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: '#eaf1e6',
    gap: 6,
  },
  actionBtnManage: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: '#15803d',
    gap: 6,
    shadowColor: '#15803d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  actionBtnTextView: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1b4332',
  },
  actionBtnTextManage: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.2,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 38 : 24,
    ...shadows.medium,
  },
  filterModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.slate300,
    alignSelf: 'center',
    marginBottom: 16,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  filterResetBtn: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
    letterSpacing: 0.5,
  },
  filterOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  filterOptionItemActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  filterOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  filterOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  filterOptionTextActive: {
    color: '#15803d',
    fontWeight: '700',
  },
  filterOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterOptionBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    backgroundColor: '#16a34a',
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
