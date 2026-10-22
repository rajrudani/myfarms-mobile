import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { farmsApi } from '../src/api/farms';
import { Farm } from '../src/types';
import { extractErrorMessage } from '../src/api/client';
import { colors, radius, spacing, shadows } from '../src/theme/tokens';
import {
  BentoCard,
  StatusBadge,
  QuickChipGroup,
  ChipOption,
} from '../src/components/ui';

const AREA_UNIT_OPTIONS: ChipOption<string>[] = [
  { label: 'Acre', value: 'ACRE' },
  { label: 'Hectare', value: 'HECTARE' },
  { label: 'Bigha', value: 'BIGHAS' },
  { label: 'Guntha', value: 'GUNTHAS' },
];

export default function FarmViewScreen() {
  const { farm_id, farm_ulid } = useLocalSearchParams();
  const farmIdentifier = (farm_ulid as string) || (farm_id as string);

  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'staff' | 'activities' | 'expenses'>('staff');

  // Edit Farm Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [areaUnit, setAreaUnit] = useState('ACRE');
  const [location, setLocation] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchFarmDetails = async () => {
    if (!farmIdentifier) return;
    try {
      const data = await farmsApi.getById(farmIdentifier);
      setFarm(data);
      setName(data.name);
      setArea(data.area.toString());
      setAreaUnit(data.area_unit);
      setLocation(data.location || '');
    } catch (error) {
      console.error('Error fetching farm details:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFarmDetails();
  }, [farmIdentifier]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFarmDetails();
  };

  const handleUpdateFarm = async () => {
    if (!farm || !farmIdentifier) return;
    if (!name || !area) {
      Alert.alert('Validation Error', 'Farm name and area size are required.');
      return;
    }

    setUpdating(true);
    try {
      const updatedData: Farm = {
        ...farm,
        name,
        area: parseFloat(area),
        area_unit: areaUnit,
        location,
      };

      const result = await farmsApi.update(farmIdentifier, updatedData);
      setFarm(result);
      Alert.alert('Success', 'Farm details updated successfully.');
      setEditModalVisible(false);
    } catch (error: any) {
      console.error('Error updating farm:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!farm || !farmIdentifier) return;
    try {
      const updatedData: Farm = {
        ...farm,
        is_active: !farm.is_active,
      };
      setFarm(updatedData);
      await farmsApi.update(farmIdentifier, updatedData);
      Alert.alert(
        'Success',
        `Farm ${updatedData.is_active ? 'activated' : 'deactivated'} successfully.`
      );
    } catch (error) {
      console.error('Error toggling farm status:', error);
      Alert.alert('Error', extractErrorMessage(error));
      fetchFarmDetails();
    }
  };

  const handleDeleteFarm = () => {
    if (!farm || !farmIdentifier) return;
    Alert.alert(
      'Delete Farm',
      'Are you sure you want to delete this farm? This will remove it from active views.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await farmsApi.delete(farmIdentifier);
              Alert.alert('Success', 'Farm deleted successfully.');
              router.back();
            } catch (error) {
              console.error('Error deleting farm:', error);
              Alert.alert('Error', extractErrorMessage(error));
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatStatus = (statusString: string) => {
    if (!statusString) return 'Completed';
    return statusString.charAt(0).toUpperCase() + statusString.slice(1).toLowerCase();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading farm details...</Text>
      </View>
    );
  }

  if (!farm) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.errorText}>Farm not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const staffCount = farm.staff?.length || farm.assigned_staff_count || 0;
  const activitiesCount = farm.activities?.length || 0;
  const expensesCount = farm.expenses?.length || 0;

  const TAB_OPTIONS: ChipOption<'staff' | 'activities' | 'expenses'>[] = [
    { label: 'Staff', value: 'staff', badge: staffCount },
    { label: 'Activities', value: 'activities', badge: activitiesCount },
    { label: 'Expenses', value: 'expenses', badge: expensesCount },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Top Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={colors.slate800} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.navbarTitle} numberOfLines={1}>
            {farm.name}
          </Text>
          <Text style={styles.navbarSubtitle}>Farm Plot Overview</Text>
        </View>
        <TouchableOpacity
          style={styles.hubShortcutBtn}
          onPress={() =>
            router.push({
              pathname: '/farm-hub',
              params: { farm_id: farm.id, farm_ulid: farm.ulid || '' },
            })
          }
          activeOpacity={0.8}
        >
          <Ionicons name="options-outline" size={16} color={colors.white} />
          <Text style={styles.hubShortcutText}>Hub</Text>
        </TouchableOpacity>
      </View>

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
        {/* Farm Hero Bento Card */}
        <BentoCard variant="elevated" style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroMeta}>
              <View style={styles.heroSproutBox}>
                <MaterialCommunityIcons name="sprout" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroName}>{farm.name}</Text>
                <View style={styles.heroLocationRow}>
                  <Ionicons name="location-outline" size={13} color={colors.slate500} />
                  <Text style={styles.heroLocation}>
                    {farm.location || 'Location not specified'}
                  </Text>
                </View>
              </View>
            </View>
            <StatusBadge
              label={farm.is_active ? 'Active' : 'Inactive'}
              variant={farm.is_active ? 'success' : 'neutral'}
              dot
            />
          </View>

          {/* Action Toolbar */}
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.actionBtnEdit}
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil" size={14} color={colors.primary} />
              <Text style={styles.actionBtnEditText}>Edit Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtnStatus}
              onPress={handleToggleStatus}
              activeOpacity={0.8}
            >
              <Ionicons
                name={farm.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
                size={15}
                color={farm.is_active ? colors.accentDark : colors.primary}
              />
              <Text
                style={[
                  styles.actionBtnStatusText,
                  { color: farm.is_active ? colors.accentDark : colors.primary },
                ]}
              >
                {farm.is_active ? 'Deactivate' : 'Activate'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtnDelete}
              onPress={handleDeleteFarm}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={14} color={colors.danger} />
              <Text style={styles.actionBtnDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </BentoCard>

        {/* 4 Stats Bento Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <View style={[styles.statIconBox, { backgroundColor: colors.primarySurface }]}>
              <Ionicons name="map-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.statLabel}>Total Area</Text>
            <Text style={styles.statValue}>
              {parseFloat(farm.area as string).toFixed(1)}{' '}
              <Text style={styles.statUnit}>{farm.area_unit.toLowerCase()}</Text>
            </Text>
          </View>

          <View style={styles.statBox}>
            <View style={[styles.statIconBox, { backgroundColor: colors.infoSurface }]}>
              <Ionicons name="leaf-outline" size={18} color={colors.info} />
            </View>
            <Text style={styles.statLabel}>Active Crops</Text>
            <Text style={styles.statValue}>{farm.active_cycles_count ?? 0}</Text>
          </View>

          <View style={styles.statBox}>
            <View style={[styles.statIconBox, { backgroundColor: colors.accentSurface }]}>
              <Ionicons name="people-outline" size={18} color={colors.accentDark} />
            </View>
            <Text style={styles.statLabel}>Staff Count</Text>
            <Text style={styles.statValue}>{farm.assigned_staff_count ?? 0}</Text>
          </View>

          <View style={styles.statBox}>
            <View
              style={[
                styles.statIconBox,
                {
                  backgroundColor: farm.is_active
                    ? colors.primarySurface
                    : colors.slate100,
                },
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={farm.is_active ? colors.primary : colors.slate500}
              />
            </View>
            <Text style={styles.statLabel}>Status</Text>
            <Text
              style={[
                styles.statValue,
                { color: farm.is_active ? colors.primary : colors.slate500 },
              ]}
            >
              {farm.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        {/* Segmented Control Chips */}
        <View style={styles.tabsWrapper}>
          <QuickChipGroup
            options={TAB_OPTIONS}
            selectedValue={activeTab}
            onSelect={(val) => setActiveTab(val)}
          />
        </View>

        {/* Selected Tab Content */}
        <View style={styles.tabContentContainer}>
          {activeTab === 'staff' && (
            <View>
              <View style={styles.tabHeaderRow}>
                <Text style={styles.tabTitle}>Assigned Staff Members</Text>
                <TouchableOpacity
                  style={styles.addInlineBtn}
                  onPress={() =>
                    Alert.alert(
                      'Manage Staff',
                      'To assign staff, go to the Staff tab in the bottom bar.'
                    )
                  }
                >
                  <Ionicons name="person-add-outline" size={13} color={colors.primary} />
                  <Text style={styles.addInlineBtnText}>Assign</Text>
                </TouchableOpacity>
              </View>

              {!farm.staff || farm.staff.length === 0 ? (
                <View style={styles.emptyTabCard}>
                  <Ionicons name="people-outline" size={32} color={colors.slate300} />
                  <Text style={styles.emptyTabText}>No staff assigned to this farm yet.</Text>
                </View>
              ) : (
                farm.staff.map((member) => (
                  <BentoCard key={member.id} variant="elevated" style={styles.staffCard}>
                    <View style={styles.staffAvatar}>
                      <Text style={styles.avatarLetter}>
                        {member.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.staffDetails}>
                      <Text style={styles.staffName}>{member.name}</Text>
                      <Text style={styles.staffMeta}>
                        @{member.username} • {member.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                    <StatusBadge
                      label={member.is_active ? 'Assigned' : 'Inactive'}
                      variant={member.is_active ? 'success' : 'neutral'}
                      dot
                    />
                  </BentoCard>
                ))
              )}
            </View>
          )}

          {activeTab === 'activities' && (
            <View>
              <View style={styles.tabHeaderRow}>
                <Text style={styles.tabTitle}>Farm Activities</Text>
                <TouchableOpacity
                  style={styles.addInlineBtn}
                  onPress={() =>
                    Alert.alert(
                      'Add Activity',
                      'Please open Farm Hub or select a crop cycle to schedule activities.'
                    )
                  }
                >
                  <Ionicons name="add" size={14} color={colors.primary} />
                  <Text style={styles.addInlineBtnText}>Add Activity</Text>
                </TouchableOpacity>
              </View>

              {!farm.activities || farm.activities.length === 0 ? (
                <View style={styles.emptyTabCard}>
                  <Ionicons name="calendar-outline" size={32} color={colors.slate300} />
                  <Text style={styles.emptyTabText}>No activities logged for this farm yet.</Text>
                </View>
              ) : (
                farm.activities.map((act) => (
                  <BentoCard key={act.id} variant="elevated" style={styles.activityCard}>
                    <View style={styles.activityHeadline}>
                      <Text style={styles.activityName}>{act.activity_type}</Text>
                      <StatusBadge
                        label={formatStatus(act.status)}
                        variant={act.status === 'COMPLETED' ? 'success' : 'warning'}
                        dot={false}
                      />
                    </View>
                    <View style={styles.activityMetaRow}>
                      <Ionicons name="calendar-outline" size={13} color={colors.slate500} />
                      <Text style={styles.activityDate}>{act.date || 'No date set'}</Text>
                    </View>
                    {act.notes ? (
                      <Text style={styles.activityNotes}>{act.notes}</Text>
                    ) : null}
                  </BentoCard>
                ))
              )}
            </View>
          )}

          {activeTab === 'expenses' && (
            <View>
              <View style={styles.tabHeaderRow}>
                <Text style={styles.tabTitle}>Farm Expenses</Text>
                <TouchableOpacity
                  style={styles.addInlineBtn}
                  onPress={() => router.push('/expenses')}
                >
                  <Ionicons name="add" size={14} color={colors.primary} />
                  <Text style={styles.addInlineBtnText}>Record Expense</Text>
                </TouchableOpacity>
              </View>

              {!farm.expenses || farm.expenses.length === 0 ? (
                <View style={styles.emptyTabCard}>
                  <Ionicons name="cash-outline" size={32} color={colors.slate300} />
                  <Text style={styles.emptyTabText}>No expenses recorded for this farm yet.</Text>
                </View>
              ) : (
                farm.expenses.map((exp) => (
                  <BentoCard key={exp.id} variant="elevated" style={styles.expenseCard}>
                    <View style={styles.expenseHeader}>
                      <Text style={styles.expenseCategory}>{exp.category}</Text>
                      <Text style={styles.expenseAmount}>
                        ₹{parseFloat(exp.amount).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.expenseMetaRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="calendar-outline" size={13} color={colors.slate500} />
                        <Text style={styles.expenseDate}>{exp.date || 'No date set'}</Text>
                      </View>
                      <StatusBadge
                        label={exp.payment_status || 'PAID'}
                        variant={exp.payment_status === 'PAID' ? 'success' : 'warning'}
                        dot={false}
                      />
                    </View>
                    {exp.notes ? (
                      <Text style={styles.expenseNotes}>{exp.notes}</Text>
                    ) : null}
                  </BentoCard>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit Farm Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Edit Farm Plot Details</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>
              Farm Name <Text style={{ color: colors.danger }}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Farm Name"
              placeholderTextColor={colors.slate400}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.inputLabel}>
              Area Size <Text style={{ color: colors.danger }}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 15.0"
              placeholderTextColor={colors.slate400}
              keyboardType="decimal-pad"
              value={area}
              onChangeText={setArea}
            />

            <Text style={styles.inputLabel}>Area Measurement Unit</Text>
            <QuickChipGroup
              options={AREA_UNIT_OPTIONS}
              selectedValue={areaUnit}
              onSelect={(val) => setAreaUnit(val)}
              size="sm"
            />

            <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sector 5, Western Block"
              placeholderTextColor={colors.slate400}
              value={location}
              onChangeText={setLocation}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setEditModalVisible(false)}
                disabled={updating}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={handleUpdateFarm}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.slate50,
    padding: spacing.lg,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate800,
    marginTop: 12,
  },
  backBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  backBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  navBackBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navbarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate900,
  },
  navbarSubtitle: {
    fontSize: 11,
    color: colors.slate500,
    fontWeight: '500',
  },
  hubShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  hubShortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
    gap: spacing.md,
  },
  heroCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 10,
  },
  heroSproutBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.slate900,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  heroLocation: {
    fontSize: 12,
    color: colors.slate500,
    fontWeight: '500',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  actionBtnEdit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySurface,
  },
  actionBtnEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  actionBtnStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.slate100,
  },
  actionBtnStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSurface,
  },
  actionBtnDeleteText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.dangerText,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    width: '48.5%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    ...shadows.subtle,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate900,
    marginTop: 2,
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.slate500,
  },
  tabsWrapper: {
    marginVertical: 4,
  },
  tabContentContainer: {
    gap: spacing.sm,
  },
  tabHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tabTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.slate800,
  },
  addInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
  },
  addInlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  emptyTabCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  emptyTabText: {
    fontSize: 13,
    color: colors.slate400,
    marginTop: 8,
    textAlign: 'center',
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  staffAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  staffDetails: {
    flex: 1,
  },
  staffName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.slate900,
  },
  staffMeta: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 2,
  },
  activityCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  activityHeadline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.slate900,
  },
  activityMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  activityDate: {
    fontSize: 12,
    color: colors.slate500,
  },
  activityNotes: {
    fontSize: 12,
    color: colors.slate600,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  expenseCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseCategory: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.slate900,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.slate900,
  },
  expenseMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  expenseDate: {
    fontSize: 12,
    color: colors.slate500,
  },
  expenseNotes: {
    fontSize: 12,
    color: colors.slate600,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
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
  modalActions: {
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
  cancelBtn: {
    backgroundColor: colors.slate100,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate700,
  },
  saveBtn: {
    backgroundColor: colors.primary,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
