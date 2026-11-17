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
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { farmsApi } from '../src/api/farms';
import { farmActivitiesApi } from '../src/api/farmActivities';
import { expensesApi } from '../src/api/expenses';
import { staffApi } from '../src/api/staff';
import { Farm, FarmActivity, FarmExpense, StaffMember, PaginationMeta } from '../src/types';
import { extractErrorMessage } from '../src/api/client';
import { useAuth } from '../src/hooks/useAuth';
import { permissions } from '../src/utils/permissions';
import { useToast } from '../src/context/ToastContext';
import { ConfirmModal, ModalSheet, ModernInput, QuickChipGroup, ChipOption } from '../src/components/ui';
import { useTranslation } from '../src/i18n/I18nContext';

const AREA_UNITS = ['ACRE', 'HECTARE', 'BIGHAS', 'GUNTHAS'];

const STAFF_ROLE_CHIP_OPTIONS: ChipOption<'Worker' | 'Manager' | 'Supervisor' | 'Consultant'>[] = [
  { label: 'Worker', value: 'Worker' },
  { label: 'Manager', value: 'Manager' },
  { label: 'Supervisor', value: 'Supervisor' },
  { label: 'Consultant', value: 'Consultant' },
];

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

const getStaffRoleStyle = (roles: any, t?: (k: string) => string) => {
  let roleStr = 'worker';
  if (Array.isArray(roles) && roles.length > 0) {
    roleStr = typeof roles[0] === 'object' ? (roles[0].name || 'worker') : roles[0];
  } else if (typeof roles === 'string') {
    roleStr = roles;
  }
  roleStr = (roleStr || '').toLowerCase();
  const tr = t || ((k: string) => k);

  switch (roleStr) {
    case 'owner':
      return { bg: '#fef3c7', text: '#92400e', label: tr('Owner') };
    case 'manager':
      return { bg: '#ede9fe', text: '#5b21b6', label: tr('Manager') };
    case 'supervisor':
      return { bg: '#dbeafe', text: '#1e40af', label: tr('Supervisor') };
    case 'consultant':
      return { bg: '#e0f2fe', text: '#0369a1', label: tr('Consultant') };
    case 'worker':
    default:
      return { bg: '#dcfce7', text: '#15803d', label: tr('Worker') };
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
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const formatUnitLabel = (unit?: string) => {
    if (!unit) return t('Acre');
    const u = unit.toLowerCase();
    if (u === 'acre') return t('Acre');
    if (u === 'hectare') return t('Hectare');
    if (u === 'bighas' || u === 'bigha') return t('Bigha');
    if (u === 'gunthas' || u === 'guntha') return t('Guntha');
    return t(unit) || (unit.charAt(0).toUpperCase() + unit.slice(1).toLowerCase());
  };

  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Confirm delete modal state
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  // Add / Manage Staff Modal State
  const [addStaffModalVisible, setAddStaffModalVisible] = useState(false);
  const [staffModalMode, setStaffModalMode] = useState<'manage' | 'create'>('manage');
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [loadingAvailableStaff, setLoadingAvailableStaff] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<number>>(new Set());
  const [initialAssignedIds, setInitialAssignedIds] = useState<Set<number>>(new Set());
  const [modalStaffSearch, setModalStaffSearch] = useState('');
  const [savingStaffAssignments, setSavingStaffAssignments] = useState(false);

  // Create Staff Form State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'Worker' | 'Manager' | 'Supervisor' | 'Consultant'>('Worker');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [newStaffError, setNewStaffError] = useState('');

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

  const isAssignedToThisFarm = (s: StaffMember) => {
    return (
      (s.id && initialAssignedIds.has(Number(s.id))) ||
      (s.id && selectedStaffIds.has(Number(s.id))) ||
      s.farms?.some(
        (f) => Number(f.id) === Number(farm?.id) || (farm?.ulid && f.ulid === farm.ulid)
      )
    );
  };

  const isAssignedToOtherFarm = (s: StaffMember) => {
    return s.farms?.some(
      (f) => Number(f.id) !== Number(farm?.id) && (!farm?.ulid || f.ulid !== farm.ulid)
    );
  };

  const canStaffHaveMultipleFarms = (s: StaffMember) => {
    if (!s.roles || (Array.isArray(s.roles) && s.roles.length === 0)) return false;
    const rolesList = Array.isArray(s.roles) ? s.roles : [s.roles];
    return rolesList.some((r: any) => {
      const roleName = (typeof r === 'object' ? r.value || r.name : String(r)).toLowerCase();
      return roleName === 'manager' || roleName === 'supervisor' || roleName === 'consultant';
    });
  };

  const isOwner = (s: StaffMember) => {
    if (!s.roles) return false;
    const rolesList = Array.isArray(s.roles) ? s.roles : [s.roles];
    return rolesList.some((r: any) => {
      const roleName = (typeof r === 'object' ? r.value || r.name : String(r)).toLowerCase();
      return roleName === 'owner';
    });
  };

  const filteredModalStaff = allStaff.filter((s) => {
    // Owners have global access in PWA and are not assigned to individual farms
    if (isOwner(s)) {
      return false;
    }

    const assignedHere = isAssignedToThisFarm(s);
    const assignedElsewhere = isAssignedToOtherFarm(s);

    // If staff is not assigned to this farm, but already assigned to another farm:
    // In PWA, Workers are strictly 1:1, so if already assigned to another farm, do not show in this list.
    if (!assignedHere && assignedElsewhere && !canStaffHaveMultipleFarms(s)) {
      return false;
    }

    if (!modalStaffSearch.trim()) return true;
    const q = modalStaffSearch.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  });

  const handleUpdateFarm = async () => {
    if (!farm || !farmIdentifier) return;
    if (!editName.trim() || !editArea.trim()) {
      Alert.alert(t('Validation Error') || 'Validation Error', t('Farm name and area are required.'));
      return;
    }

    const newAreaNum = parseFloat(editArea);
    if (isNaN(newAreaNum) || newAreaNum <= 0) {
      Alert.alert(t('Validation Error') || 'Validation Error', t('Area size must be a valid positive number.'));
      return;
    }

    if (farm.active_crop_cycles_area && newAreaNum < farm.active_crop_cycles_area - 0.0001) {
      Alert.alert(
        t('Area Downsize Error') || 'Area Downsize Error',
        t('Total area cannot be less than the active crop cycles area (:area).', {
          area: `${farm.active_crop_cycles_area} ${formatUnitLabel(editAreaUnit)}`,
        })
      );
      return;
    }

    setUpdatingFarm(true);
    try {
      const updated = await farmsApi.update(farmIdentifier, {
        ...farm,
        name: editName.trim(),
        area: newAreaNum,
        area_unit: editAreaUnit,
        location: editLocation.trim() || undefined,
      });
      setFarm(updated);
      setEditModalVisible(false);
      showToast(t('Farm details updated successfully.'), 'success');
    } catch (error) {
      console.error('Error updating farm:', error);
      showToast(extractErrorMessage(error), 'error');
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
      showToast(
        nextStatus
          ? t('Farm activated successfully.') || 'Farm activated successfully.'
          : t('Farm deactivated successfully.') || 'Farm deactivated successfully.',
        'success'
      );
    } catch (error) {
      console.error('Error toggling farm status:', error);
      showToast(extractErrorMessage(error), 'error');
    } finally {
      setUpdatingFarm(false);
    }
  };

  const handleDeleteFarm = () => {
    if (!farm || !farmIdentifier) return;
    setDeleteConfirmVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!farmIdentifier) return;
    setDeleting(true);
    try {
      await farmsApi.delete(farmIdentifier);
      setDeleteConfirmVisible(false);
      showToast(t('Farm deleted successfully.'), 'success');
      router.back();
    } catch (error) {
      console.error('Error deleting farm:', error);
      showToast(extractErrorMessage(error), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenAddStaffModal = async () => {
    setAddStaffModalVisible(true);
    setStaffModalMode('manage');
    setModalStaffSearch('');
    setLoadingAvailableStaff(true);
    try {
      const [all, assignedToFarm] = await Promise.all([
        staffApi.getAll({ status: 'active' }),
        farm?.id ? staffApi.getAll({ farm_id: farm.id }) : Promise.resolve([]),
      ]);
      setAllStaff(all || []);

      const assignedIds = new Set<number>();
      (assignedToFarm || []).forEach((s) => {
        if (s.id) assignedIds.add(Number(s.id));
      });
      (all || []).forEach((s) => {
        if (
          s.id &&
          s.farms?.some(
            (f) => Number(f.id) === Number(farm?.id) || (farm?.ulid && f.ulid === farm.ulid)
          )
        ) {
          assignedIds.add(Number(s.id));
        }
      });

      setSelectedStaffIds(new Set(assignedIds));
      setInitialAssignedIds(new Set(assignedIds));
    } catch (err) {
      console.error('Error loading staff for assignment:', err);
    } finally {
      setLoadingAvailableStaff(false);
    }
  };

  const handleToggleStaffSelection = (id: number) => {
    setSelectedStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFilteredStaff = () => {
    setSelectedStaffIds((prev) => {
      const next = new Set(prev);
      filteredModalStaff.forEach((s) => {
        if (s.id) next.add(Number(s.id));
      });
      return next;
    });
  };

  const handleDeselectAllFilteredStaff = () => {
    setSelectedStaffIds((prev) => {
      const next = new Set(prev);
      filteredModalStaff.forEach((s) => {
        if (s.id) next.delete(Number(s.id));
      });
      return next;
    });
  };

  const handleSaveStaffAssignments = async () => {
    if (!farm?.id) return;
    setSavingStaffAssignments(true);
    try {
      const toAssign = [...selectedStaffIds].filter((id) => !initialAssignedIds.has(id));
      const toUnassign = [...initialAssignedIds].filter((id) => !selectedStaffIds.has(id));

      const ops: Promise<any>[] = [];
      toAssign.forEach((id) => {
        ops.push(staffApi.assignFarm(id, Number(farm.id)));
      });
      toUnassign.forEach((id) => {
        ops.push(staffApi.unassignFarm(id, Number(farm.id)));
      });

      if (ops.length > 0) {
        await Promise.allSettled(ops);
        showToast(t('Staff assignments updated successfully.'), 'success');
      }

      setAddStaffModalVisible(false);
      fetchStaffMembers(farm.id, 1, staffSearchQuery);
      fetchFarmDetails();
    } catch (error) {
      console.error('Error updating staff assignments:', error);
      showToast(extractErrorMessage(error), 'error');
    } finally {
      setSavingStaffAssignments(false);
    }
  };

  const handleCreateAndAssignStaff = async () => {
    if (!farm?.id) return;
    if (!newStaffName.trim()) {
      setNewStaffError(t('Full Name is required.'));
      return;
    }
    if (newStaffRole === 'Manager' && !newStaffEmail.trim()) {
      setNewStaffError(t('Email is required for Managers.'));
      return;
    }

    setCreatingStaff(true);
    setNewStaffError('');
    try {
      const payload = {
        name: newStaffName.trim(),
        roles: [newStaffRole],
        phone: newStaffPhone.trim() || undefined,
        username: newStaffUsername.trim() || undefined,
        email: newStaffEmail.trim() || undefined,
        password: newStaffPassword.trim() || undefined,
        farms: [Number(farm.id)],
        status: true,
      };

      const created = await staffApi.create(payload as any);
      if (created?.id) {
        try {
          await staffApi.assignFarm(created.id, Number(farm.id));
        } catch {
          // ignore if already assigned via farms field
        }
      }

      showToast(t('Staff member registered and assigned successfully!'), 'success');

      setNewStaffName('');
      setNewStaffRole('Worker');
      setNewStaffPhone('');
      setNewStaffUsername('');
      setNewStaffEmail('');
      setNewStaffPassword('');

      setAddStaffModalVisible(false);
      fetchStaffMembers(farm.id, 1, staffSearchQuery);
      fetchFarmDetails();
    } catch (error: any) {
      console.error('Error creating staff member:', error);
      showToast(extractErrorMessage(error), 'error');
    } finally {
      setCreatingStaff(false);
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
              {t('Showing')} {from || 1}-{to || total} {t('of')} {total}
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
          {t('Showing')} {from || ((currentPage - 1) * 5 + 1)}-{to || Math.min(currentPage * 5, total)} {t('of')} {total}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#166534" />
        <Text style={styles.loadingText}>{t('Loading Farm Overview...')}</Text>
      </View>
    );
  }

  if (!farm) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.topbar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#475569" />
          </TouchableOpacity>
          <Text style={styles.topbarTitle}>{t('Farm Overview')}</Text>
          <View style={styles.topbarSpacer} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
          <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '600', color: '#1e293b' }}>
            {t('Farm Not Found')}
          </Text>
          <TouchableOpacity
            style={{ marginTop: 16, backgroundColor: '#16a34a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
            onPress={() => router.back()}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t('Go Back')}</Text>
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Sticky Topbar matching PWA */}
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#475569" />
        </TouchableOpacity>
        <Text style={styles.topbarTitle} numberOfLines={1} ellipsizeMode="tail">
          {isScrolled && farm?.name ? farm.name : t('Farm Overview')}
        </Text>
        <View style={styles.topbarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          const offsetY = event.nativeEvent.contentOffset.y;
          if (offsetY > 40 && !isScrolled) {
            setIsScrolled(true);
          } else if (offsetY <= 40 && isScrolled) {
            setIsScrolled(false);
          }
        }}
        scrollEventThrottle={16}
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
                <Text style={styles.heroLocationText}>{farm.location || t('Location not set')}</Text>
              </View>
            </View>
            <View style={[styles.statusDot, !farm.is_active && styles.statusDotInactive]} />
          </View>

          <View style={styles.heroBadges}>
            {permissions.canManageFarms(user) && (
              <TouchableOpacity
                style={styles.heroEditBtn}
                onPress={() => setEditModalVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="pencil-sharp" size={15} color="#166534" />
                <Text style={styles.heroEditBtnText}>{t('Edit')}</Text>
              </TouchableOpacity>
            )}

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
              <Text style={styles.heroManageBtnText}>{t('Manage')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Inactive Banner matching PWA vf-inactive-banner */}
        {!farm.is_active && (
          <View style={styles.inactiveBanner}>
            <Ionicons name="lock-closed-outline" size={18} color="#991b1b" style={{ marginTop: 1 }} />
            <Text style={styles.inactiveBannerText}>
              {t('This farm is inactive. You can view old records, but reactivate the farm before adding or editing records.')}
            </Text>
          </View>
        )}

        {/* Stats Grid matching PWA vf-stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t('TOTAL AREA')}</Text>
            <Text style={styles.statValue}>
              {parseFloat((farm.area as unknown as string) || '0').toFixed(2)}{' '}
              <Text style={styles.statUnit}>{formatUnitLabel(farm.area_unit)}</Text>
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t('ACTIVE CROPS')}</Text>
            <Text style={styles.statValue}>
              {farm.active_cycles_count ?? 0} <Text style={styles.statUnit}>{t('Cycles')}</Text>
            </Text>
          </View>
        </View>

        {/* Section 1: General Activities matching PWA */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{t('General Activities')}</Text>
              <Text style={styles.sectionSubtitle}>{t('Activities not assigned to any crop cycle')}</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{activitiesTotal}</Text>
            </View>
          </View>

          {activitiesLoading ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color="#16a34a" />
              <Text style={styles.inlineLoadingText}>{t('Loading activities...')}</Text>
            </View>
          ) : activities.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t('No general activities logged for this farm yet.')}</Text>
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
                            {t(act.status.charAt(0).toUpperCase() + act.status.slice(1))}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.itemDateRow}>
                      <Text style={[styles.itemDateText, isToday && styles.itemDateTextToday]}>
                        {formatDisplayDate(act.date)}
                        {isToday && `  •  ${t('Today')}`}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                    </View>

                    {detailsRows.length > 0 && (
                      <View style={styles.detailsRow}>
                        {detailsRows.map((detail, dIdx) => (
                          <Text key={dIdx} style={styles.detailText}>
                            <Text style={styles.detailTextBold}>{t(detail.label)}:</Text> {detail.value}
                            {dIdx < detailsRows.length - 1 ? '   ' : ''}
                          </Text>
                        ))}
                      </View>
                    )}

                    {act.notes ? (
                      <Text style={styles.notesText}>
                        <Text style={{ fontWeight: '700' }}>{t('Notes:')}</Text> {act.notes}
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
              <Text style={styles.sectionTitle}>{t('General Expenses')}</Text>
              <Text style={styles.sectionSubtitle}>{t('Expenses not assigned to any crop cycle')}</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{expensesTotal}</Text>
            </View>
          </View>

          {expensesLoading ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color="#16a34a" />
              <Text style={styles.inlineLoadingText}>{t('Loading expenses...')}</Text>
            </View>
          ) : expenses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t('No general expenses logged for this farm yet.')}</Text>
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
                              {isCompleted ? t('Paid') : t('Pending')}
                            </Text>
                          </View>
                        </View>

                        <Text style={[styles.itemDateText, isToday && styles.itemDateTextToday, { marginTop: 4 }]}>
                          {formatDisplayDate(item.date)}
                          {isToday && `  •  ${t('Today')}`}
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
                            {t('Method:')} {item.payment_method.toUpperCase()}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {item.notes ? (
                      <Text style={[styles.notesText, { marginTop: 6 }]}>
                        <Text style={{ fontWeight: '700' }}>{t('Note:')}</Text> {item.notes}
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
              {t('Staff Members')} <Text style={styles.sectionTitleCount}>({staffTotal})</Text>
            </Text>
            <TouchableOpacity style={styles.inlineActionBtn} onPress={handleOpenAddStaffModal} activeOpacity={0.7}>
              <Ionicons name="add" size={16} color="#166534" />
              <Text style={styles.inlineActionBtnText}>{t('Add Staff')}</Text>
            </TouchableOpacity>
          </View>

          {/* Search input if staff exist */}
          {staffTotal > 0 && (
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('Search staff members...')}
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
              <Text style={styles.inlineLoadingText}>{t('Loading staff...')}</Text>
            </View>
          ) : staffList.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {staffSearchQuery ? t('No staff match your search.') : t('No staff assigned to this farm yet.')}
              </Text>
              {!staffSearchQuery && (
                <TouchableOpacity
                  style={[styles.inlineActionBtn, { marginTop: 12 }]}
                  onPress={handleOpenAddStaffModal}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={16} color="#166534" />
                  <Text style={styles.inlineActionBtnText}>{t('Add Staff')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {staffList.map((staff) => {
                const roleStyle = getStaffRoleStyle(staff.roles, t);
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
                          {staff.is_active !== false ? t('Active') : t('Inactive')}
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
        {permissions.canAccessDangerZone(user) && (
          <View style={styles.dangerZoneCard}>
            <TouchableOpacity
              style={styles.dangerZoneHeader}
              onPress={() => setDangerZoneExpanded(!dangerZoneExpanded)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.dangerZoneTitle}>{t('Danger Zone')}</Text>
                <Text style={styles.dangerZoneSubtitle}>{t('Deactivate or delete this farm')}</Text>
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
                      {farm.is_active ? t('Deactivate Farm') : t('Activate Farm')}
                    </Text>
                    <Text style={styles.dangerSectionText}>
                      {t('Current status:')} {farm.is_active ? t('Active') : t('Inactive')}.
                    </Text>
                    <Text style={styles.dangerSectionText}>
                      {farm.is_active
                        ? t('This will make the farm inactive, but keep all old records.')
                        : t('This will make the farm active again.')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.dangerBtn, farm.is_active ? styles.dangerBtnWarning : styles.dangerBtnSuccess]}
                    onPress={handleToggleStatus}
                    disabled={updatingFarm}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dangerBtnText, farm.is_active ? { color: '#b45309' } : { color: '#15803d' }]}>
                      {farm.is_active ? t('Deactivate') : t('Activate')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.dangerDivider} />

                <View style={styles.dangerActionSection}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.dangerSectionHeading}>{t('Delete Farm')}</Text>
                    <Text style={styles.dangerSectionText}>
                      {t('This will remove the farm, but keep all old records.')}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.dangerBtnDanger} onPress={handleDeleteFarm} activeOpacity={0.7}>
                    <Text style={[styles.dangerBtnText, { color: '#b91c1c' }]}>{t('Delete Farm')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Edit Farm Modal */}
      <ModalSheet
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        title={t('Edit Farm Details')}
      >
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          <ModernInput
            label={t('Farm Name')}
            required
            placeholder={t('e.g. Green Valley Farm')}
            value={editName}
            onChangeText={setEditName}
          />

          <ModernInput
            label={`${t('Total Area')} (${formatUnitLabel(editAreaUnit)})`}
            required
            placeholder="e.g. 25.5"
            keyboardType="decimal-pad"
            inputMode="decimal"
            value={editArea}
            onChangeText={(text) => {
              const normalized = text.replace(/,/g, '.');
              const cleaned = normalized.replace(/[^0-9.]/g, '');
              const parts = cleaned.split('.');
              const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
              setEditArea(sanitized);
            }}
          />

          <ModernInput
            label={t('Location')}
            placeholder={t('e.g. Anand, Gujarat')}
            value={editLocation}
            onChangeText={setEditLocation}
          />
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={styles.modalCancelBtn}
            onPress={() => setEditModalVisible(false)}
            disabled={updatingFarm}
          >
            <Text style={styles.modalCancelBtnText}>{t('Cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalSaveBtn}
            onPress={handleUpdateFarm}
            disabled={updatingFarm}
          >
            {updatingFarm ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.modalSaveBtnText}>{t('Save Changes')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ModalSheet>

      {/* Add / Manage Staff Modal */}
      <ModalSheet
        visible={addStaffModalVisible}
        onClose={() => setAddStaffModalVisible(false)}
        title={staffModalMode === 'manage' ? t('Manage Farm Staff') : t('Create & Assign New Staff')}
      >
        {staffModalMode === 'manage' ? (
          <View>
            {/* Header row with + New Staff button */}
            <View style={styles.manageStaffTopRow}>
              <TouchableOpacity
                style={styles.createNewStaffBtn}
                onPress={() => {
                  setNewStaffError('');
                  setStaffModalMode('create');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="person-add" size={15} color="#166534" />
                <Text style={styles.createNewStaffBtnText}>{t('+ New Staff Member')}</Text>
              </TouchableOpacity>
            </View>

            {/* Search staff in modal */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('Search staff members...')}
                placeholderTextColor="#94a3b8"
                value={modalStaffSearch}
                onChangeText={setModalStaffSearch}
              />
              {modalStaffSearch.length > 0 && (
                <TouchableOpacity onPress={() => setModalStaffSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Multi-select header row with Select all / Deselect all */}
            <View style={styles.multiSelectHeaderRow}>
              <Text style={styles.selectedCountText}>
                {selectedStaffIds.size} {t('Assigned')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={handleSelectAllFilteredStaff} activeOpacity={0.7}>
                  <Text style={styles.selectToggleText}>{t('Select all')}</Text>
                </TouchableOpacity>
                <Text style={{ color: '#cbd5e1' }}>|</Text>
                <TouchableOpacity onPress={handleDeselectAllFilteredStaff} activeOpacity={0.7}>
                  <Text style={styles.selectToggleText}>{t('Deselect all')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {loadingAvailableStaff ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#16a34a" />
                <Text style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>{t('Loading staff...')}</Text>
              </View>
            ) : filteredModalStaff.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Ionicons name="information-circle-outline" size={32} color="#64748b" />
                <Text style={{ marginTop: 8, fontSize: 14, fontWeight: '600', color: '#1e293b', textAlign: 'center' }}>
                  {modalStaffSearch ? t('No staff match your search.') : t('No staff found.')}
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>
                {filteredModalStaff.map((s) => {
                  const isAssigned = selectedStaffIds.has(s.id);
                  const roleStyle = getStaffRoleStyle(s.roles, t);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.availableStaffItem,
                        isAssigned && styles.availableStaffItemSelected,
                      ]}
                      onPress={() => handleToggleStaffSelection(s.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.staffAvatar, { backgroundColor: roleStyle.bg, width: 36, height: 36 }]}>
                        <Text style={[styles.staffAvatarText, { color: roleStyle.text, fontSize: 14 }]}>
                          {(s.name || 'S').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>{s.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                          <Text style={{ fontSize: 12, color: '#64748b' }}>{roleStyle.label}</Text>
                          {s.phone ? (
                            <>
                              <Text style={{ fontSize: 10, color: '#94a3b8' }}>•</Text>
                              <Text style={{ fontSize: 12, color: '#64748b' }}>{s.phone}</Text>
                            </>
                          ) : null}
                          {!isAssigned && s.farms && s.farms.length > 0 ? (
                            <>
                              <Text style={{ fontSize: 10, color: '#94a3b8' }}>•</Text>
                              <Text style={{ fontSize: 11, color: '#0284c7', fontWeight: '600' }}>
                                {s.farms.map((f) => f.name).join(', ')}
                              </Text>
                            </>
                          ) : null}
                        </View>
                      </View>
                      {isAssigned ? (
                        <View style={styles.assignedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#15803d" />
                          <Text style={styles.assignedBadgeText}>{t('Assigned')}</Text>
                        </View>
                      ) : (
                        <Ionicons name="ellipse-outline" size={20} color="#cbd5e1" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setAddStaffModalVisible(false)}
                disabled={savingStaffAssignments}
              >
                <Text style={styles.modalCancelBtnText}>{t('Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveStaffAssignments}
                disabled={savingStaffAssignments}
              >
                {savingStaffAssignments ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>
                    {t('Save Assignments')} ({selectedStaffIds.size})
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            {/* Back button */}
            <TouchableOpacity
              style={styles.backToListBtn}
              onPress={() => setStaffModalMode('manage')}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={16} color="#166534" />
              <Text style={styles.backToListBtnText}>{t('Back to List')}</Text>
            </TouchableOpacity>

            {/* Auto assign notice */}
            <View style={styles.autoAssignBanner}>
              <Ionicons name="information-circle" size={18} color="#15803d" />
              <Text style={styles.autoAssignText}>
                {t('This staff member will automatically be assigned to :farm.', { farm: farm.name })}
              </Text>
            </View>

            {newStaffError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#b91c1c" />
                <Text style={styles.errorBannerText}>{newStaffError}</Text>
              </View>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <ModernInput
                label={t('Full Name')}
                required
                placeholder={t('Full Name')}
                value={newStaffName}
                onChangeText={setNewStaffName}
              />

              <View style={{ marginBottom: 14 }}>
                <Text style={styles.formLabel}>{t('Staff Role')} *</Text>
                <QuickChipGroup
                  options={STAFF_ROLE_CHIP_OPTIONS.map((opt) => ({
                    ...opt,
                    label: t(opt.value) || opt.label,
                  }))}
                  selectedValue={newStaffRole}
                  onSelect={(val) => setNewStaffRole(val as any)}
                />
              </View>

              <ModernInput
                label={t('Phone Number')}
                placeholder={t('Phone Number')}
                keyboardType="phone-pad"
                value={newStaffPhone}
                onChangeText={setNewStaffPhone}
              />

              <ModernInput
                label={t('Username')}
                placeholder={t('Username')}
                autoCapitalize="none"
                value={newStaffUsername}
                onChangeText={setNewStaffUsername}
              />

              <ModernInput
                label={`${t('Email')}${newStaffRole === 'Manager' ? ' *' : ''}`}
                placeholder={t('Email')}
                keyboardType="email-address"
                autoCapitalize="none"
                value={newStaffEmail}
                onChangeText={setNewStaffEmail}
              />

              <ModernInput
                label={t('Password')}
                placeholder={t('Password')}
                secureTextEntry
                value={newStaffPassword}
                onChangeText={setNewStaffPassword}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setStaffModalMode('manage')}
                disabled={creatingStaff}
              >
                <Text style={styles.modalCancelBtnText}>{t('Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleCreateAndAssignStaff}
                disabled={creatingStaff}
              >
                {creatingStaff ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>{t('Create & Assign')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ModalSheet>

      <ConfirmModal
        visible={deleteConfirmVisible}
        title={t('Delete Farm')}
        message={t('Are you sure you want to delete :name? This will remove the farm, but keep all old records.', {
          name: farm?.name || '',
        })}
        confirmText={t('Delete Farm')}
        cancelText={t('Cancel')}
        destructive
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmVisible(false)}
      />
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
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
  availableStaffItemSelected: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  manageStaffTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  createNewStaffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  createNewStaffBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  multiSelectHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  selectedCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  selectToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  assignedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  backToListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backToListBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  autoAssignBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  autoAssignText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803d',
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorBannerText: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
    flex: 1,
  },
});
