import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { farmsApi } from '../src/api/farms';
import { farmActivitiesApi } from '../src/api/farmActivities';
import { expensesApi } from '../src/api/expenses';
import { staffApi } from '../src/api/staff';
import { Farm, FarmActivity, FarmExpense, StaffMember, PaginationMeta } from '../src/types';
import { extractErrorMessage } from '../src/api/client';

const AREA_UNITS = ['ACRE', 'HECTARE', 'BIGHAS', 'GUNTHAS'];

const formatDisplayDate = (dateStr?: string | null) => {
  if (!dateStr) return 'N/A';
  try {
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return cleanDate;
  } catch (e) {
    return dateStr;
  }
};

const isTodayDate = (dateStr?: string | null) => {
  if (!dateStr) return false;
  try {
    const cleanDate = dateStr.split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    return cleanDate === today;
  } catch {
    return false;
  }
};

const getStaffRoleStyle = (roles: any) => {
  let roleStr = 'worker';
  if (Array.isArray(roles) && roles.length > 0) {
    roleStr = typeof roles[0] === 'object' ? (roles[0].name || 'worker') : roles[0];
  } else if (typeof roles === 'string') {
    roleStr = roles;
  }
  roleStr = (roleStr || '').toLowerCase();

  switch (roleStr) {
    case 'owner':
      return { bg: '#fef3c7', text: '#92400e', label: 'Owner' };
    case 'manager':
      return { bg: '#ede9fe', text: '#5b21b6', label: 'Manager' };
    case 'supervisor':
      return { bg: '#dbeafe', text: '#1e40af', label: 'Supervisor' };
    case 'worker':
    default:
      return { bg: '#dcfce7', text: '#15803d', label: 'Worker' };
  }
};

const formatActivityDetails = (details: any) => {
  if (!details || typeof details !== 'object') return [];
  const rows: { label: string; value: string }[] = [];
  Object.keys(details).forEach((key) => {
    const val = details[key];
    if (val !== undefined && val !== null && val !== '') {
      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
      const displayVal = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
      rows.push({ label, value: displayVal });
    }
  });
  return rows;
};

export default function FarmViewScreen() {
  const { farm_id, farm_ulid } = useLocalSearchParams();
  const farmIdentifier = (farm_ulid as string) || (farm_id as string);

  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Farm Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editAreaUnit, setEditAreaUnit] = useState('ACRE');
  const [editLocation, setEditLocation] = useState('');
  const [updatingFarm, setUpdatingFarm] = useState(false);

  // Danger Zone Accordion State
  const [dangerZoneExpanded, setDangerZoneExpanded] = useState(false);

  // General Activities Pagination State (5 per page)
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [activitiesMeta, setActivitiesMeta] = useState<PaginationMeta | null>(null);

  // General Expenses Pagination State (5 per page)
  const [expenses, setExpenses] = useState<FarmExpense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expensesPage, setExpensesPage] = useState(1);
  const [expensesMeta, setExpensesMeta] = useState<PaginationMeta | null>(null);

  // Staff Members Pagination & Search State (5 per page)
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffPage, setStaffPage] = useState(1);
  const [staffMeta, setStaffMeta] = useState<PaginationMeta | null>(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // Add Staff Modal State
  const [addStaffModalVisible, setAddStaffModalVisible] = useState(false);
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
  const [loadingAvailableStaff, setLoadingAvailableStaff] = useState(false);
  const [selectedStaffIdToAssign, setSelectedStaffIdToAssign] = useState<string | number>('');
  const [assigningStaff, setAssigningStaff] = useState(false);

  const isInitialStaffSearchMount = useRef(true);

  const fetchFarmDetails = async () => {
    if (!farmIdentifier) return;
    try {
      const farmData = await farmsApi.getById(farmIdentifier);
      setFarm(farmData);
      setEditName(farmData.name);
      setEditArea(farmData.area?.toString() || '');
      setEditAreaUnit(farmData.area_unit || 'ACRE');
      setEditLocation(farmData.location || '');

      const dbId = farmData.id;
      if (dbId) {
        await Promise.allSettled([
          fetchGeneralActivities(dbId, 1),
          fetchGeneralExpenses(dbId, 1),
          fetchStaffMembers(dbId, 1, ''),
        ]);
      }
    } catch (error) {
      console.error('Error fetching farm details:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchGeneralActivities = async (farmId: string | number, page: number) => {
    setActivitiesLoading(true);
    try {
      const res = await farmActivitiesApi.getPaginated({
        farm_id: farmId,
        crop_cycle_id: 'general',
        page,
        per_page: 5,
      });
      setActivities(res.data || []);
      setActivitiesPage(res.meta?.current_page || page);
      setActivitiesMeta(res.meta || null);
    } catch (err) {
      console.error('Error fetching general activities:', err);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const fetchGeneralExpenses = async (farmId: string | number, page: number) => {
    setExpensesLoading(true);
    try {
      const res = await expensesApi.getPaginated({
        farm_id: farmId,
        crop_cycle_id: 'general',
        page,
        per_page: 5,
      });
      setExpenses(res.data || []);
      setExpensesPage(res.meta?.current_page || page);
      setExpensesMeta(res.meta || null);
    } catch (err) {
      console.error('Error fetching general expenses:', err);
    } finally {
      setExpensesLoading(false);
    }
  };

  const fetchStaffMembers = async (farmId: string | number, page: number, search: string = '') => {
    setStaffLoading(true);
    try {
      const res = await staffApi.getPaginated({
        farm_id: farmId,
        page,
        per_page: 5,
        search: search.trim() || undefined,
      });
      setStaffList(res.data || []);
      setStaffPage(res.meta?.current_page || page);
      setStaffMeta(res.meta || null);
    } catch (err) {
      console.error('Error fetching staff members:', err);
    } finally {
      setStaffLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchFarmDetails();
    }, [farmIdentifier])
  );

  // Debounced search for staff
  useEffect(() => {
    if (isInitialStaffSearchMount.current) {
      isInitialStaffSearchMount.current = false;
      return;
    }
    const dbId = farm?.id || farmIdentifier;
    if (!dbId) return;

    const timer = setTimeout(() => {
      fetchStaffMembers(dbId, 1, staffSearchQuery);
    }, 350);

    return () => clearTimeout(timer);
  }, [staffSearchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFarmDetails();
  };

  const handleUpdateFarm = async () => {
    if (!farm || !farmIdentifier) return;
    if (!editName.trim() || !editArea.trim()) {
      Alert.alert('Validation Error', 'Farm name and area are required.');
      return;
    }

    setUpdatingFarm(true);
    try {
      const updated = await farmsApi.update(farmIdentifier, {
        ...farm,
        name: editName.trim(),
        area: parseFloat(editArea),
        area_unit: editAreaUnit,
        location: editLocation.trim() || undefined,
      });
      setFarm(updated);
      setEditModalVisible(false);
      Alert.alert('Success', 'Farm details updated successfully.');
    } catch (error) {
      console.error('Error updating farm:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setUpdatingFarm(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!farm || !farmIdentifier) return;
    const nextStatus = !farm.is_active;
    try {
      setUpdatingFarm(true);
      const updated = await farmsApi.update(farmIdentifier, {
        ...farm,
        is_active: nextStatus,
      });
      setFarm(updated);
      Alert.alert('Success', `Farm ${nextStatus ? 'activated' : 'deactivated'} successfully.`);
    } catch (error) {
      console.error('Error toggling farm status:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setUpdatingFarm(false);
    }
  };

  const handleDeleteFarm = () => {
    if (!farm || !farmIdentifier) return;
    Alert.alert(
      'Delete Farm',
      'Are you sure you want to delete this farm? This will remove the farm, but keep all old records.',
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

  const handleOpenAddStaffModal = async () => {
    setAddStaffModalVisible(true);
    setSelectedStaffIdToAssign('');
    setLoadingAvailableStaff(true);
    try {
      const all = await staffApi.getAll({ status: 'active' });
      // Filter out staff members that are already assigned to this farm
      const currentAssignedIds = new Set(staffList.map((s) => s.id?.toString()));
      const unassigned = (all || []).filter((s) => !currentAssignedIds.has(s.id?.toString()));
      setAvailableStaff(unassigned);
      if (unassigned.length > 0) {
        setSelectedStaffIdToAssign(unassigned[0].id);
      }
    } catch (err) {
      console.error('Error loading available staff:', err);
    } finally {
      setLoadingAvailableStaff(false);
    }
  };

  const handleAssignStaff = async () => {
    if (!selectedStaffIdToAssign || !farm?.id) {
      Alert.alert('Validation Error', 'Please select a staff member.');
      return;
    }
    setAssigningStaff(true);
    try {
      await staffApi.assignFarm(selectedStaffIdToAssign, Number(farm.id));
      Alert.alert('Success', 'Staff member assigned successfully.');
      setAddStaffModalVisible(false);
      fetchStaffMembers(farm.id, 1, staffSearchQuery);
      // Update farm count
      fetchFarmDetails();
    } catch (error) {
      console.error('Error assigning staff:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setAssigningStaff(false);
    }
  };

  const renderPagination = (
    currentPage: number,
    lastPage: number,
    total: number,
    from: number | null,
    to: number | null,
    onPageChange: (newPage: number) => void
  ) => {
    if (total <= 5 || lastPage <= 1) {
      if (total > 0) {
        return (
          <View style={styles.paginationCaptionRow}>
            <Text style={styles.paginationCaption}>
              Showing {from || 1}-{to || total} of {total}
            </Text>
          </View>
        );
      }
      return null;
    }

    const pages: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(lastPage, start + maxButtons - 1);
    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }

    return (
      <View style={styles.paginationWrapper}>
        <View style={styles.paginationControls}>
          <TouchableOpacity
            style={[styles.paginationBtn, currentPage <= 1 && styles.paginationBtnDisabled]}
            disabled={currentPage <= 1}
            onPress={() => onPageChange(currentPage - 1)}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={15} color={currentPage <= 1 ? '#cbd5e1' : '#475569'} />
          </TouchableOpacity>

          {pages.map((p) => (
            <TouchableOpacity
              key={`page-${p}`}
              style={[styles.paginationNumBtn, p === currentPage && styles.paginationNumBtnActive]}
              onPress={() => onPageChange(p)}
              activeOpacity={0.7}
            >
              <Text style={[styles.paginationNumText, p === currentPage && styles.paginationNumTextActive]}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.paginationBtn, currentPage >= lastPage && styles.paginationBtnDisabled]}
            disabled={currentPage >= lastPage}
            onPress={() => onPageChange(currentPage + 1)}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={15} color={currentPage >= lastPage ? '#cbd5e1' : '#475569'} />
          </TouchableOpacity>
        </View>

        <Text style={styles.paginationCaption}>
          Showing {from || ((currentPage - 1) * 5 + 1)}-{to || Math.min(currentPage * 5, total)} of {total}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#166534" />
        <Text style={styles.loadingText}>Loading Farm Overview...</Text>
      </View>
    );
  }

  if (!farm) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topbar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#475569" />
          </TouchableOpacity>
          <Text style={styles.topbarTitle}>Farm Overview</Text>
          <View style={styles.topbarSpacer} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
          <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '600', color: '#1e293b' }}>
            Farm Not Found
          </Text>
          <TouchableOpacity
            style={{ marginTop: 16, backgroundColor: '#16a34a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
            onPress={() => router.back()}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const activitiesTotal = activitiesMeta?.total ?? activities.length;
  const activitiesLastPage = activitiesMeta?.last_page ?? 1;
  const activitiesFrom = activitiesMeta?.from ?? 1;
  const activitiesTo = activitiesMeta?.to ?? activities.length;

  const expensesTotal = expensesMeta?.total ?? expenses.length;
  const expensesLastPage = expensesMeta?.last_page ?? 1;
  const expensesFrom = expensesMeta?.from ?? 1;
  const expensesTo = expensesMeta?.to ?? expenses.length;

  const staffTotal = staffMeta?.total ?? staffList.length;
  const staffLastPage = staffMeta?.last_page ?? 1;
  const staffFrom = staffMeta?.from ?? 1;
  const staffTo = staffMeta?.to ?? staffList.length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Sticky Topbar matching PWA */}
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#475569" />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Farm Overview</Text>
        <View style={styles.topbarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#16a34a']} tintColor="#16a34a" />
        }
      >
        {/* Hero Section matching PWA vf-hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroHead}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.heroName}>{farm.name}</Text>
              <View style={styles.heroLocation}>
                <Ionicons name="location-sharp" size={14} color="#64748b" />
                <Text style={styles.heroLocationText}>{farm.location || 'Location not set'}</Text>
              </View>
            </View>
            <View style={[styles.statusDot, !farm.is_active && styles.statusDotInactive]} />
          </View>

          <View style={styles.heroBadges}>
            <TouchableOpacity
              style={styles.heroEditBtn}
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil-sharp" size={15} color="#166534" />
              <Text style={styles.heroEditBtnText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroManageBtn}
              onPress={() =>
                router.push({
                  pathname: '/farm-hub',
                  params: { farm_id: farm.id, farm_ulid: farm.ulid || '' },
                })
              }
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={15} color="#ffffff" />
              <Text style={styles.heroManageBtnText}>Manage</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Inactive Banner matching PWA vf-inactive-banner */}
        {!farm.is_active && (
          <View style={styles.inactiveBanner}>
            <Ionicons name="lock-closed-outline" size={18} color="#991b1b" style={{ marginTop: 1 }} />
            <Text style={styles.inactiveBannerText}>
              This farm is inactive. You can view old records, but reactivate the farm before adding or editing records.
            </Text>
          </View>
        )}

        {/* Stats Grid matching PWA vf-stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TOTAL AREA</Text>
            <Text style={styles.statValue}>
              {parseFloat((farm.area as unknown as string) || '0').toFixed(2)}{' '}
              <Text style={styles.statUnit}>{farm.area_unit.toLowerCase()}</Text>
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>ACTIVE CROPS</Text>
            <Text style={styles.statValue}>
              {farm.active_cycles_count ?? 0} <Text style={styles.statUnit}>Cycles</Text>
            </Text>
          </View>
        </View>

        {/* Section 1: General Activities matching PWA */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>General Activities</Text>
              <Text style={styles.sectionSubtitle}>Activities not assigned to any crop cycle</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{activitiesTotal}</Text>
            </View>
          </View>

          {activitiesLoading ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color="#16a34a" />
              <Text style={styles.inlineLoadingText}>Loading activities...</Text>
            </View>
          ) : activities.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No general activities logged for this farm yet.</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {activities.map((act) => {
                const isScheduled = act.status === 'scheduled';
                const isToday = isTodayDate(act.date);
                const detailsRows = formatActivityDetails(act.details_json);

                return (
                  <TouchableOpacity
                    key={act.id || act.ulid}
                    style={[styles.activityCard, isScheduled && styles.activityCardScheduled]}
                    onPress={() =>
                      router.push({
                        pathname: '/activity-view',
                        params: {
                          activity_id: act.id?.toString(),
                          activity_ulid: act.ulid,
                          farm_name: farm.name,
                          source: 'farm-view',
                        },
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemHeadlineRow}>
                      <Text style={styles.itemName}>{act.activity_type || act.farm_activity_master?.name}</Text>
                      {act.status && act.status !== 'completed' && (
                        <View
                          style={[
                            styles.statusPill,
                            isScheduled ? { backgroundColor: '#fef9c3' } : { backgroundColor: '#fee2e2' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              isScheduled ? { color: '#a16207' } : { color: '#b91c1c' },
                            ]}
                          >
                            {act.status.charAt(0).toUpperCase() + act.status.slice(1)}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.itemDateRow}>
                      <Text style={[styles.itemDateText, isToday && styles.itemDateTextToday]}>
                        {formatDisplayDate(act.date)}
                        {isToday && '  •  Today'}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                    </View>

                    {detailsRows.length > 0 && (
                      <View style={styles.detailsRow}>
                        {detailsRows.map((detail, dIdx) => (
                          <Text key={dIdx} style={styles.detailText}>
                            <Text style={styles.detailTextBold}>{detail.label}:</Text> {detail.value}
                            {dIdx < detailsRows.length - 1 ? '   ' : ''}
                          </Text>
                        ))}
                      </View>
                    )}

                    {act.notes ? (
                      <Text style={styles.notesText}>
                        <Text style={{ fontWeight: '700' }}>Notes:</Text> {act.notes}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}

              {renderPagination(
                activitiesPage,
                activitiesLastPage,
                activitiesTotal,
                activitiesFrom,
                activitiesTo,
                (p) => fetchGeneralActivities(farm.id!, p)
              )}
            </View>
          )}
        </View>

        {/* Section 2: General Expenses matching PWA */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>General Expenses</Text>
              <Text style={styles.sectionSubtitle}>Expenses not assigned to any crop cycle</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{expensesTotal}</Text>
            </View>
          </View>

          {expensesLoading ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color="#16a34a" />
              <Text style={styles.inlineLoadingText}>Loading expenses...</Text>
            </View>
          ) : expenses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No general expenses logged for this farm yet.</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {expenses.map((item) => {
                const isCompleted =
                  item.payment_status?.toLowerCase() === 'completed' || item.payment_status?.toLowerCase() === 'paid';
                const isToday = isTodayDate(item.date);

                return (
                  <TouchableOpacity
                    key={item.id || item.ulid}
                    style={styles.expenseItemCard}
                    onPress={() =>
                      router.push({
                        pathname: '/expense-view',
                        params: {
                          expense_id: item.id?.toString(),
                          expense_ulid: item.ulid,
                          farm_name: farm.name,
                          source: 'farm-view',
                        },
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.expenseMainRow}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={styles.itemName}>{item.expense_category}</Text>
                          <View
                            style={[
                              styles.statusPill,
                              isCompleted ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#fee2e2' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusPillText,
                                isCompleted ? { color: '#15803d' } : { color: '#b91c1c' },
                              ]}
                            >
                              {isCompleted ? 'Paid' : 'Pending'}
                            </Text>
                          </View>
                        </View>

                        <Text style={[styles.itemDateText, isToday && styles.itemDateTextToday, { marginTop: 4 }]}>
                          {formatDisplayDate(item.date)}
                          {isToday && '  •  Today'}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={[styles.expenseAmountText, { color: isCompleted ? '#16a34a' : '#ef4444' }]}>
                            ₹{parseFloat((item.amount as unknown as string) || '0').toFixed(2)}
                          </Text>
                          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                        </View>
                        {item.payment_method ? (
                          <Text style={styles.expenseMethodText}>
                            Method: {item.payment_method.toUpperCase()}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {item.notes ? (
                      <Text style={[styles.notesText, { marginTop: 6 }]}>
                        <Text style={{ fontWeight: '700' }}>Note:</Text> {item.notes}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}

              {renderPagination(
                expensesPage,
                expensesLastPage,
                expensesTotal,
                expensesFrom,
                expensesTo,
                (p) => fetchGeneralExpenses(farm.id!, p)
              )}
            </View>
          )}
        </View>

        {/* Section 3: Staff Members matching PWA */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>
              Staff Members <Text style={styles.sectionTitleCount}>({staffTotal})</Text>
            </Text>
            <TouchableOpacity style={styles.inlineActionBtn} onPress={handleOpenAddStaffModal} activeOpacity={0.7}>
              <Ionicons name="add" size={16} color="#166534" />
              <Text style={styles.inlineActionBtnText}>Add Staff</Text>
            </TouchableOpacity>
          </View>

          {/* Search input if staff exist */}
          {staffTotal > 0 && (
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search staff members..."
                placeholderTextColor="#94a3b8"
                value={staffSearchQuery}
                onChangeText={setStaffSearchQuery}
              />
              {staffSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setStaffSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {staffLoading ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color="#16a34a" />
              <Text style={styles.inlineLoadingText}>Loading staff...</Text>
            </View>
          ) : staffList.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {staffSearchQuery ? 'No staff match your search.' : 'No staff assigned to this farm yet.'}
              </Text>
              {!staffSearchQuery && (
                <TouchableOpacity
                  style={[styles.inlineActionBtn, { marginTop: 12 }]}
                  onPress={handleOpenAddStaffModal}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={16} color="#166534" />
                  <Text style={styles.inlineActionBtnText}>Add Staff</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {staffList.map((staff) => {
                const roleStyle = getStaffRoleStyle(staff.roles);
                const initial = (staff.name || 'S').charAt(0).toUpperCase();

                return (
                  <TouchableOpacity
                    key={staff.id || staff.ulid}
                    style={styles.staffRow}
                    onPress={() =>
                      router.push({
                        pathname: '/staff-view',
                        params: {
                          staff_id: staff.id?.toString(),
                          staff_ulid: staff.ulid,
                        },
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <View style={[styles.staffAvatar, { backgroundColor: roleStyle.bg }]}>
                      <Text style={[styles.staffAvatarText, { color: roleStyle.text }]}>{initial}</Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.staffName}>{staff.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={styles.staffMetaText}>{roleStyle.label}</Text>
                        <Text style={styles.staffDot}>•</Text>
                        <Text
                          style={[
                            styles.staffStatusText,
                            staff.is_active !== false ? { color: '#15803d' } : { color: '#dc2626' },
                          ]}
                        >
                          {staff.is_active !== false ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                      {staff.email ? <Text style={styles.staffEmail}>{staff.email}</Text> : null}
                    </View>

                    <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                );
              })}

              {renderPagination(
                staffPage,
                staffLastPage,
                staffTotal,
                staffFrom,
                staffTo,
                (p) => fetchStaffMembers(farm.id!, p, staffSearchQuery)
              )}
            </View>
          )}
        </View>

        {/* Section 4: Danger Zone matching PWA vf-danger-zone */}
        <View style={styles.dangerZoneCard}>
          <TouchableOpacity
            style={styles.dangerZoneHeader}
            onPress={() => setDangerZoneExpanded(!dangerZoneExpanded)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
              <Text style={styles.dangerZoneSubtitle}>Deactivate or delete this farm</Text>
            </View>
            <Ionicons
              name={dangerZoneExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#b91c1c"
            />
          </TouchableOpacity>

          {dangerZoneExpanded && (
            <View style={styles.dangerZoneContent}>
              <View style={styles.dangerActionSection}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.dangerSectionHeading}>
                    {farm.is_active ? 'Deactivate Farm' : 'Activate Farm'}
                  </Text>
                  <Text style={styles.dangerSectionText}>
                    Current status: {farm.is_active ? 'Active' : 'Inactive'}.
                  </Text>
                  <Text style={styles.dangerSectionText}>
                    {farm.is_active
                      ? 'This will make the farm inactive, but keep all old records.'
                      : 'This will make the farm active again.'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.dangerBtn, farm.is_active ? styles.dangerBtnWarning : styles.dangerBtnSuccess]}
                  onPress={handleToggleStatus}
                  disabled={updatingFarm}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dangerBtnText, farm.is_active ? { color: '#b45309' } : { color: '#15803d' }]}>
                    {farm.is_active ? 'Deactivate' : 'Activate'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dangerDivider} />

              <View style={styles.dangerActionSection}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.dangerSectionHeading}>Delete Farm</Text>
                  <Text style={styles.dangerSectionText}>
                    This will remove the farm, but keep all old records.
                  </Text>
                </View>
                <TouchableOpacity style={styles.dangerBtnDanger} onPress={handleDeleteFarm} activeOpacity={0.7}>
                  <Text style={[styles.dangerBtnText, { color: '#b91c1c' }]}>Delete Farm</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit Farm Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Farm</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Farm Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Green Valley Farm"
                  placeholderTextColor="#94a3b8"
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Total Area *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 25.5"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={editArea}
                  onChangeText={setEditArea}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Area Unit</Text>
                <View style={styles.unitPillsRow}>
                  {AREA_UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitPill, editAreaUnit === u && styles.unitPillActive]}
                      onPress={() => setEditAreaUnit(u)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.unitPillText, editAreaUnit === u && styles.unitPillTextActive]}>
                        {u.charAt(0) + u.slice(1).toLowerCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Location</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Anand, Gujarat"
                  placeholderTextColor="#94a3b8"
                  value={editLocation}
                  onChangeText={setEditLocation}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
                disabled={updatingFarm}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleUpdateFarm}
                disabled={updatingFarm}
              >
                {updatingFarm ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add / Assign Staff Modal */}
      <Modal visible={addStaffModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Staff to Farm</Text>
              <TouchableOpacity onPress={() => setAddStaffModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            {loadingAvailableStaff ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#16a34a" />
                <Text style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>Checking staff members...</Text>
              </View>
            ) : availableStaff.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Ionicons name="information-circle-outline" size={32} color="#64748b" />
                <Text style={{ marginTop: 8, fontSize: 14, fontWeight: '600', color: '#1e293b', textAlign: 'center' }}>
                  All available staff members are already assigned to this farm.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
                <Text style={[styles.formLabel, { marginBottom: 8 }]}>Select Staff Member</Text>
                {availableStaff.map((s) => {
                  const isSelected = selectedStaffIdToAssign === s.id;
                  const roleStyle = getStaffRoleStyle(s.roles);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.availableStaffItem,
                        isSelected && { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
                      ]}
                      onPress={() => setSelectedStaffIdToAssign(s.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.staffAvatar, { backgroundColor: roleStyle.bg, width: 34, height: 34 }]}>
                        <Text style={[styles.staffAvatarText, { color: roleStyle.text, fontSize: 13 }]}>
                          {(s.name || 'S').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>{s.name}</Text>
                        <Text style={{ fontSize: 12, color: '#64748b' }}>{roleStyle.label}</Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color="#16a34a" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setAddStaffModalVisible(false)}
                disabled={assigningStaff}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              {availableStaff.length > 0 && (
                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleAssignStaff}
                  disabled={assigningStaff}
                >
                  {assigningStaff ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>Assign</Text>
                  )}
                </TouchableOpacity>
              )}
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
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topbarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  topbarSpacer: {
    width: 36,
    height: 36,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroName: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: '#0f172a',
  },
  heroLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  heroLocationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16a34a',
    marginTop: 6,
  },
  statusDotInactive: {
    backgroundColor: '#dc2626',
  },
  heroBadges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
  },
  heroEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 6,
  },
  heroEditBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroManageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#16a34a',
    backgroundColor: '#16a34a',
    gap: 6,
  },
  heroManageBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inactiveBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  inactiveBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991b1b',
    lineHeight: 18,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#64748b',
  },
  statValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: '#166534',
  },
  statUnit: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  sectionTitleCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  inlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    gap: 4,
  },
  inlineActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  inlineLoading: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineLoadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748b',
  },
  emptyCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
  },
  activityCardScheduled: {
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
  },
  itemHeadlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  itemDateText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  itemDateTextToday: {
    color: '#2563eb',
    fontWeight: '700',
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  detailTextBold: {
    fontWeight: '700',
    color: '#475569',
  },
  notesText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 4,
  },
  expenseItemCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
  },
  expenseMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  expenseAmountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  expenseMethodText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    padding: 0,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
  },
  staffAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  staffName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  staffMetaText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  staffDot: {
    fontSize: 12,
    color: '#94a3b8',
  },
  staffStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  staffEmail: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  paginationWrapper: {
    marginTop: 14,
    alignItems: 'center',
    gap: 8,
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paginationBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationBtnDisabled: {
    opacity: 0.4,
  },
  paginationNumBtn: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationNumBtnActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  paginationNumText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  paginationNumTextActive: {
    color: '#ffffff',
  },
  paginationCaptionRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  paginationCaption: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  dangerZoneCard: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
  },
  dangerZoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dangerZoneTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#9f1239',
  },
  dangerZoneSubtitle: {
    fontSize: 12,
    color: '#be123c',
    marginTop: 2,
  },
  dangerZoneContent: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#fecdd3',
  },
  dangerActionSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dangerSectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  dangerSectionText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
  },
  dangerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  dangerBtnWarning: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  dangerBtnSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  dangerBtnDanger: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  dangerBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  dangerDivider: {
    height: 1,
    backgroundColor: '#fecdd3',
    marginVertical: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '85%',
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
  modalCloseBtn: {
    padding: 4,
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 14,
    color: '#0f172a',
  },
  unitPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  unitPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  unitPillActive: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  unitPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  unitPillTextActive: {
    color: '#166534',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  modalSaveBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  availableStaffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
});
