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
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { staffApi } from '../../src/api/staff';
import { attendanceApi, BulkMarkAttendanceData } from '../../src/api/attendance';
import { staffPaymentsApi, CreatePaymentData } from '../../src/api/staffPayments';
import { farmsApi } from '../../src/api/farms';
import { Farm, StaffMember, StaffPayment, StaffRoleValue } from '../../src/types';
import { useAuth } from '../../src/hooks/useAuth';
import { extractErrorMessage, getAbsoluteImageUrl } from '../../src/api/client';
import { permissions } from '../../src/utils/permissions';
import { useTranslation } from '../../src/i18n/I18nContext';
import { colors, radius, spacing, shadows } from '../../src/theme/tokens';
import { useResponsive } from '../../src/utils/responsive';
import {
  BentoCard,
  StatusBadge,
  SearchFilterBar,
  QuickChipGroup,
  ChipOption,
  ModalSheet,
  ModernInput,
  SearchableSelect,
  ModernDatePicker,
  EmptyState,
} from '../../src/components/ui';
import { useToast } from '../../src/context/ToastContext';

const ROLE_OPTIONS: ChipOption<StaffRoleValue>[] = [
  { label: 'Worker', value: 'Worker' },
  { label: 'Manager', value: 'Manager' },
  { label: 'Owner', value: 'Owner' },
  { label: 'Consultant', value: 'Consultant' },
];

const PAYMENT_METHOD_OPTIONS: ChipOption<'cash' | 'google_pay' | 'phonepe' | 'other_upi' | 'bank_transfer'>[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'GPay', value: 'google_pay' },
  { label: 'PhonePe', value: 'phonepe' },
  { label: 'UPI', value: 'other_upi' },
  { label: 'Bank', value: 'bank_transfer' },
];

export default function StaffScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { tab } = useLocalSearchParams<{ tab?: 'staff' | 'attendance' | 'payments' }>();
  const { isAuthenticated, user } = useAuth();
  const { containerMaxWidth, isTablet } = useResponsive();

  // Active Tab state: 'staff' | 'attendance' | 'payments'
  const [activeTab, setActiveTab] = useState<'staff' | 'attendance' | 'payments'>('staff');

  useEffect(() => {
    if (tab === 'attendance' || tab === 'payments' || tab === 'staff') {
      setActiveTab(tab);
    }
  }, [tab]);

  // Loading & Refreshing
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Core Data
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [payments, setPayments] = useState<StaffPayment[]>([]);

  // TAB 1: Staff - Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [farmFilter, setFarmFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // TAB 2: Attendance - Filter & Date
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
  const [attendanceFarmFilter, setAttendanceFarmFilter] = useState<string>('all');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'all' | 'present' | 'absent' | 'half_day'>('all');
  const [attendanceRecords, setAttendanceRecords] = useState<
    { farm_staff_id: number; farm_id?: number | null; status: 'present' | 'absent' | 'half_day'; notes: string }[]
  >([]);
  const [expandedStaffIds, setExpandedStaffIds] = useState<number[]>([]);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [workLocationModalStaffId, setWorkLocationModalStaffId] = useState<number | null>(null);

  // TAB 3: Payments - Filter & Search
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [paymentStaffFilter, setPaymentStaffFilter] = useState<string>('all');

  // Filter bottom sheet modal state
  const [filterModalTab, setFilterModalTab] = useState<'staff' | 'attendance' | 'payments' | null>(null);
  const [staffFilterOpenDropdown, setStaffFilterOpenDropdown] = useState<'status' | 'farm' | 'role' | null>(null);
  const [attendanceFilterOpenDropdown, setAttendanceFilterOpenDropdown] = useState<'status' | 'farm' | null>(null);
  const [paymentFilterOpenDropdown, setPaymentFilterOpenDropdown] = useState<'method' | 'staff' | null>(null);
  const [farmFilterSearch, setFarmFilterSearch] = useState('');
  const [attendanceFarmFilterSearch, setAttendanceFarmFilterSearch] = useState('');
  const [paymentStaffSearch, setPaymentStaffSearch] = useState('');

  // Modals state
  const [addStaffModalVisible, setAddStaffModalVisible] = useState(false);
  const [addPaymentModalVisible, setAddPaymentModalVisible] = useState(false);

  // Add Staff Form State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRoleValue>('Worker');
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffFarms, setNewStaffFarms] = useState<number[]>([]);
  const [newStaffFamilyHeadId, setNewStaffFamilyHeadId] = useState<number | null>(null);
  const [savingStaff, setSavingStaff] = useState(false);
  const [showAddFarmDropdown, setShowAddFarmDropdown] = useState(false);
  const [showFamilyHeadDropdown, setShowFamilyHeadDropdown] = useState(false);

  // Add Payment Form State
  const [payStaffId, setPayStaffId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'google_pay' | 'phonepe' | 'other_upi' | 'bank_transfer'>('cash');
  const [payNotes, setPayNotes] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payGivenBy, setPayGivenBy] = useState<number | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [showPayStaffDropdown, setShowPayStaffDropdown] = useState(false);
  const [showPayGivenDropdown, setShowPayGivenDropdown] = useState(false);

  // Fetch initial data
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const farmData = await farmsApi.getAll();
      setFarms(farmData);

      if (activeTab === 'staff') {
        const staffData = await staffApi.getAll({
          status: statusFilter === 'all' ? undefined : statusFilter,
          farm_id: farmFilter === 'all' ? undefined : farmFilter,
          role: roleFilter === 'all' ? undefined : roleFilter,
          search: searchQuery || undefined,
        });
        setStaff(staffData);
      } else if (activeTab === 'attendance') {
        const staffData = await staffApi.getAll({ status: 'active' });
        setStaff(staffData);

        const attendanceData = await attendanceApi.getAll({
          date: attendanceDate,
        });

        const records = staffData.map((s) => {
          const existing = attendanceData.find((a) => a.farm_staff_id === s.id);
          return {
            farm_staff_id: s.id,
            farm_id: existing?.farm?.id || existing?.farm_id || (s.farms?.[0]?.id as number | undefined) || null,
            status: existing ? existing.status : ('absent' as const),
            notes: existing?.notes || '',
          };
        });
        setAttendanceRecords(records);
      } else if (activeTab === 'payments') {
        const paymentData = await staffPaymentsApi.getAll({
          search: paymentSearch || undefined,
        });
        setPayments(paymentData);

        const staffData = await staffApi.getAll({ status: 'active' });
        setStaff(staffData);
      }
    } catch (error: any) {
      console.error('Error fetching staff data:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [
    isAuthenticated,
    activeTab,
    statusFilter,
    farmFilter,
    roleFilter,
    searchQuery,
    attendanceDate,
    paymentSearch,
  ]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const handleAddStaff = async () => {
    if (!newStaffName.trim()) {
      Alert.alert('Validation Error', 'Full Name is required.');
      return;
    }

    if ((newStaffRole === 'Owner' || newStaffRole === 'Manager') && !newStaffEmail.trim()) {
      Alert.alert('Validation Error', 'Email is required for Owners and Managers.');
      return;
    }

    if (newStaffRole === 'Worker' && newStaffFarms.length === 0) {
      Alert.alert('Validation Error', 'Please select an assigned farm for this worker.');
      return;
    }

    if ((newStaffRole === 'Manager' || newStaffRole === 'Consultant') && newStaffFarms.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one assigned farm.');
      return;
    }

    setSavingStaff(true);
    try {
      const staffPayload = {
        name: newStaffName,
        roles: [newStaffRole],
        username: newStaffUsername || undefined,
        email: newStaffEmail || undefined,
        password: newStaffPassword || undefined,
        farms: newStaffRole === 'Owner' ? [] : newStaffFarms,
        family_head_id: newStaffRole === 'Worker' ? (newStaffFamilyHeadId || undefined) : undefined,
        status: true,
      };

      await staffApi.create(staffPayload as any);
      showToast('Staff member registered successfully!', 'success');
      setAddStaffModalVisible(false);

      setNewStaffName('');
      setNewStaffRole('Worker');
      setNewStaffUsername('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setNewStaffFarms([]);
      setNewStaffFamilyHeadId(null);

      fetchData();
    } catch (error: any) {
      console.error('Error creating staff:', error);
      showToast(extractErrorMessage(error), 'error');
    } finally {
      setSavingStaff(false);
    }
  };

  const handleAddPayment = async () => {
    if (!payStaffId) {
      showToast('Staff member is required.', 'warning');
      return;
    }
    if (!payAmount || isNaN(Number(payAmount)) || Number(payAmount) <= 0) {
      showToast('Please enter a valid amount.', 'warning');
      return;
    }

    setSavingPayment(true);
    try {
      const paymentPayload: CreatePaymentData = {
        farm_staff_id: payStaffId,
        amount: parseFloat(payAmount),
        date: payDate,
        payment_method: payMethod,
        notes: payNotes || null,
        given_by_id: payGivenBy || null,
      };

      await staffPaymentsApi.create(paymentPayload);
      showToast('Payment recorded successfully!', 'success');
      setAddPaymentModalVisible(false);

      setPayStaffId(null);
      setPayAmount('');
      setPayMethod('cash');
      setPayNotes('');
      setPayDate(new Date().toISOString().split('T')[0]);
      setPayGivenBy(null);

      fetchData();
    } catch (error: any) {
      console.error('Error creating payment:', error);
      showToast(extractErrorMessage(error), 'error');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleSaveAttendance = async () => {
    setSavingAttendance(true);
    try {
      const assocFarmId =
        attendanceFarmFilter !== 'all' ? parseInt(attendanceFarmFilter, 10) : null;

      const recordsToSave = attendanceRecords.map((r) => ({
        farm_staff_id: r.farm_staff_id,
        farm_id: r.farm_id || null,
        status: r.status,
        notes: r.notes || null,
      }));

      const payload: BulkMarkAttendanceData = {
        date: attendanceDate,
        farm_id: assocFarmId,
        records: recordsToSave,
      };

      const res = await attendanceApi.bulkMark(payload);
      showToast(res.message || 'Attendance saved successfully.', 'success');
      fetchData();
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      showToast(extractErrorMessage(error), 'error');
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleMarkAllPresent = () => {
    setAttendanceRecords((prev) =>
      prev.map((r) => ({
        ...r,
        status: 'present',
      }))
    );
  };

  const setFarmLocationForStaff = (staffId: number, farmId: number | null) => {
    setAttendanceRecords((prev) =>
      prev.map((r) => (r.farm_staff_id === staffId ? { ...r, farm_id: farmId } : r))
    );
  };

  const handlePrevDay = () => {
    const d = new Date(attendanceDate);
    d.setDate(d.getDate() - 1);
    setAttendanceDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(attendanceDate);
    d.setDate(d.getDate() + 1);
    setAttendanceDate(d.toISOString().split('T')[0]);
  };

  const openPaymentModalForStaff = (staffId: number) => {
    setPayStaffId(staffId);
    setAddPaymentModalVisible(true);
  };

  const getRoleColor = (roleVal: string) => {
    switch (roleVal) {
      case 'Owner':
        return '#2563eb';
      case 'Manager':
        return '#7e22ce';
      case 'Worker':
        return '#d97706';
      case 'Consultant':
        return '#16a34a';
      default:
        return '#64748b';
    }
  };

  const getRoleVariant = (roleVal: string) => {
    switch (roleVal) {
      case 'Owner':
        return 'info' as const;
      case 'Manager':
        return 'purple' as const;
      case 'Worker':
        return 'warning' as const;
      case 'Consultant':
        return 'success' as const;
      default:
        return 'neutral' as const;
    }
  };

  const toggleExpandedStaff = (staffId: number) => {
    setExpandedStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  const renderStaffCard = ({ item }: { item: StaffMember }) => {
    const isCurrentUser = user && user.id === item.id;
    const isOwnerOrManager = item.roles.some(
      (r) => r.value === 'Owner' || r.value === 'Manager'
    );
    const canAddPayment = !isOwnerOrManager;
    const primaryRole = item.roles[0]?.value || 'Worker';
    const roleColor = getRoleColor(primaryRole);
    const initials = item.name
      ? item.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase()
      : 'U';

    const hasFarms = item.farms && item.farms.length > 0;
    const farmsText = hasFarms ? item.farms.map((f) => f.name).join(', ') : '';

    return (
      <View style={styles.pwaStaffCard}>
        {/* Role badge top-right */}
        <View style={styles.pwaRoleStack}>
          {item.roles.map((r, i) => {
            const rc = getRoleColor(r.value);
            return (
              <View
                key={i}
                style={[
                  styles.pwaRoleBadge,
                  { backgroundColor: rc + '18' },
                ]}
              >
                <Text style={[styles.pwaRoleBadgeText, { color: rc }]}>
                  {r.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Staff Main */}
        <View style={styles.pwaStaffMain}>
          {/* Avatar (52x52 rounded 14 with status dot) */}
          <View style={[styles.pwaAvatar, { backgroundColor: roleColor + '20' }]}>
            {item.profile_photo_url || item.profile_photo_path ? (
              <Image
                source={{
                  uri: item.profile_photo_url || getAbsoluteImageUrl(item.profile_photo_path),
                }}
                style={styles.pwaAvatarImg}
              />
            ) : (
              <Text style={[styles.pwaAvatarText, { color: roleColor }]}>{initials}</Text>
            )}
            <View
              style={[
                styles.pwaStatusDot,
                item.is_active ? styles.pwaStatusDotActive : styles.pwaStatusDotInactive,
              ]}
            />
          </View>

          {/* Info */}
          <View style={styles.pwaStaffInfo}>
            <View style={styles.pwaNameRow}>
              <Text style={styles.pwaStaffName} numberOfLines={1}>
                {item.name}
              </Text>
              {isCurrentUser ? <Text style={styles.pwaYouTag}>(You)</Text> : null}
            </View>

            {/* Farms row */}
            {hasFarms ? (
              <View style={styles.pwaMetaRow}>
                <Ionicons name="location-outline" size={13} color="#64748b" />
                <Text style={styles.pwaMetaText} numberOfLines={1}>
                  {farmsText}
                </Text>
              </View>
            ) : !item.roles.some((r) => r.value === 'Owner') ? (
              <View style={styles.pwaMetaRow}>
                <Ionicons name="warning-outline" size={13} color="#b45309" />
                <Text style={styles.pwaWarningText} numberOfLines={1}>
                  No farm assigned
                </Text>
              </View>
            ) : null}

            {/* Family head */}
            {item.family_head ? (
              <View style={styles.pwaMetaRow}>
                <Ionicons name="person-outline" size={13} color="#64748b" />
                <Text style={styles.pwaMetaText} numberOfLines={1}>
                  Family Head: {item.family_head.name}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Staff Actions */}
        <View style={styles.pwaStaffActions}>
          {canAddPayment ? (
            <TouchableOpacity
              style={styles.pwaPaymentBtn}
              onPress={() => openPaymentModalForStaff(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="card-outline" size={13} color="#334155" />
              <Text style={styles.pwaPaymentBtnText}>{t('Payment')}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.pwaViewBtn}
            onPress={() => router.push(`/staff-view?id=${item.ulid || item.id}`)}
            activeOpacity={0.7}
          >
            <Ionicons name="eye-outline" size={14} color="#166534" />
            <Text style={styles.pwaViewBtnText}>{t('View')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAttendanceCard = ({ item }: { item: StaffMember }) => {
    const recordIndex = attendanceRecords.findIndex((r) => r.farm_staff_id === item.id);
    const record = recordIndex !== -1 ? attendanceRecords[recordIndex] : null;
    const status = record?.status || 'absent';
    const isPresent = status === 'present' || status === 'half_day';
    const isHalfDay = status === 'half_day';
    const notes = record?.notes || '';
    const workFarmId = record?.farm_id || (item.farms[0]?.id || null);
    const isExpanded = expandedStaffIds.includes(item.id);

    const togglePresent = () => {
      if (recordIndex !== -1) {
        const updated = [...attendanceRecords];
        updated[recordIndex].status = isPresent ? 'absent' : 'present';
        setAttendanceRecords(updated);
      }
    };

    const toggleHalfDay = () => {
      if (recordIndex !== -1) {
        const updated = [...attendanceRecords];
        updated[recordIndex].status = isHalfDay ? 'present' : 'half_day';
        setAttendanceRecords(updated);
      }
    };

    const setFarmLocation = (farmId: number | null) => {
      if (recordIndex !== -1) {
        const updated = [...attendanceRecords];
        updated[recordIndex].farm_id = farmId;
        setAttendanceRecords(updated);
      }
    };

    const setNotes = (newNotes: string) => {
      if (recordIndex !== -1) {
        const updated = [...attendanceRecords];
        updated[recordIndex].notes = newNotes;
        setAttendanceRecords(updated);
      }
    };

    const primaryRole = item.roles[0]?.value || 'Worker';
    const roleColor = getRoleColor(primaryRole);
    const initials = item.name
      ? item.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase()
      : 'U';

    const isUnassigned = !item.farms || item.farms.length === 0;

    return (
      <View style={[styles.pwaAttendanceCard, isHalfDay && styles.pwaAttendanceCardHalf]}>
        {/* Top row */}
        <View style={styles.pwaAttTopRow}>
          <View style={styles.pwaAttMain}>
            <View style={[styles.pwaAvatarSmall, { backgroundColor: roleColor + '20' }]}>
              {item.profile_photo_url || item.profile_photo_path ? (
                <Image
                  source={{
                    uri: item.profile_photo_url || getAbsoluteImageUrl(item.profile_photo_path),
                  }}
                  style={styles.pwaAvatarImg}
                />
              ) : (
                <Text style={[styles.pwaAvatarTextSmall, { color: roleColor }]}>{initials}</Text>
              )}
            </View>
            <View style={styles.pwaAttNameWrap}>
              <Text style={styles.pwaAttStaffName} numberOfLines={1}>
                {item.name}
              </Text>
              {isUnassigned ? (
                <Ionicons name="warning-outline" size={13} color="#b45309" style={{ marginLeft: 4 }} />
              ) : null}
            </View>
          </View>

          {/* Present Switch Toggle */}
          <TouchableOpacity
            style={[styles.pwaPresentSwitch, isPresent && styles.pwaPresentSwitchOn]}
            onPress={togglePresent}
            activeOpacity={0.8}
          >
            <View style={[styles.pwaSwitchKnob, isPresent && styles.pwaSwitchKnobOn]}>
              {isPresent ? (
                <Ionicons name="checkmark" size={12} color="#166534" />
              ) : null}
            </View>
            <Text style={[styles.pwaPresentSwitchLabel, isPresent && styles.pwaPresentSwitchLabelOn]}>
              {isPresent ? t('Present') : t('Absent')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Row 2: Shown when Present */}
        {isPresent ? (
          <View style={styles.pwaAttDetailsRow}>
            <TouchableOpacity
              style={styles.pwaDetailsToggle}
              onPress={() => toggleExpandedStaff(item.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.pwaDetailsToggleText}>
                {isExpanded ? t('Less (-)') : t('More (+)')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pwaHalfDayCheck, isHalfDay && styles.pwaHalfDayCheckActive]}
              onPress={toggleHalfDay}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isHalfDay ? 'checkbox' : 'square-outline'}
                size={16}
                color={isHalfDay ? '#d97706' : '#94a3b8'}
              />
              <Text style={[styles.pwaHalfDayText, isHalfDay && styles.pwaHalfDayTextActive]}>
                {t('Half Day').toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Row 3: Expanded details (Work location + notes) */}
        {isPresent && isExpanded ? (
          <View style={styles.pwaAttExpanded}>
            <View style={styles.pwaWorkFarmRow}>
              <Text style={styles.pwaWorkFarmLabel}>{t('Work Location')}:</Text>
              <TouchableOpacity
                style={styles.locationDropdownTrigger}
                onPress={() => setWorkLocationModalStaffId(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.locationDropdownLeft}>
                  <Ionicons name="business-outline" size={16} color="#16a34a" />
                  <Text style={styles.locationDropdownText} numberOfLines={1}>
                    {activeFarms.find((f) => f.id === workFarmId)?.name || t('Select Work Location')}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.pwaAttNotesBox}>
              <TextInput
                style={styles.pwaAttNotesInput}
                placeholder={t('Work notes...')}
                placeholderTextColor="#94a3b8"
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderPaymentCard = ({ item }: { item: StaffPayment }) => {
    const staffName = item.staff?.name || 'Unknown Staff';
    const givenBy = item.given_by?.name || 'Group Owner';
    const formattedDate = item.date ? item.date.split('T')[0] : 'N/A';
    const cleanMethodLabel = item.payment_method
      ? item.payment_method.replace('_', ' ').toUpperCase()
      : 'CASH';

    return (
      <TouchableOpacity
        onPress={() => router.push(`/staff-payment-view?id=${item.ulid || item.id}`)}
        activeOpacity={0.8}
        style={styles.pwaPaymentCard}
      >
        <View style={styles.pwaPaymentCardContent}>
          <View style={styles.pwaPaymentHeaderRow}>
            <View style={styles.pwaPaymentStaffCol}>
              <Text style={styles.pwaPaymentStaffName} numberOfLines={1}>
                {staffName}
              </Text>
              <Text style={styles.pwaPaymentDate}>{formattedDate}</Text>
            </View>
            <Text style={styles.pwaPaymentAmount}>
              ₹{Number(item.amount).toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={styles.pwaPaymentMetaRow}>
            <Text style={styles.pwaPaymentGivenBy}>Given By: {givenBy}</Text>
            <View style={styles.pwaPaymentMethodPill}>
              <Text style={styles.pwaPaymentMethodText}>{cleanMethodLabel}</Text>
            </View>
          </View>

          {item.notes ? (
            <View style={styles.pwaPaymentNotesRow}>
              <Text style={styles.pwaPaymentNotesText} numberOfLines={2}>
                <Text style={{ fontWeight: '700' }}>Note: </Text>
                {item.notes}
              </Text>
            </View>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </TouchableOpacity>
    );
  };

  const activeFarms = farms.filter((f) => f.is_active);
  const selectedStaffName = payStaffId
    ? staff.find((s) => s.id === payStaffId)?.name || 'Select Staff Member'
    : 'Select Staff Member';
  const selectedGivenByName = payGivenBy
    ? staff.find((s) => s.id === payGivenBy)?.name || 'Select Owner/Manager'
    : 'Select Owner/Manager';

  const presentCount = attendanceRecords.filter((r) => r.status === 'present').length;
  const halfDayCount = attendanceRecords.filter((r) => r.status === 'half_day').length;
  const absentCount = attendanceRecords.filter((r) => r.status === 'absent').length;

  const filteredAttendanceStaff = staff.filter((item) => {
    if (attendanceFarmFilter !== 'all') {
      const matchesFarm = item.farms.some(
        (f) =>
          (f.id ? f.id.toString() === attendanceFarmFilter : false) ||
          f.ulid === attendanceFarmFilter
      );
      if (!matchesFarm) return false;
    }
    if (attendanceStatusFilter !== 'all') {
      const record = attendanceRecords.find((r) => r.farm_staff_id === item.id);
      const stat = record?.status || 'absent';
      if (attendanceStatusFilter === 'present' && stat !== 'present') return false;
      if (attendanceStatusFilter === 'half_day' && stat !== 'half_day') return false;
      if (attendanceStatusFilter === 'absent' && stat !== 'absent') return false;
    }
    if (attendanceSearchQuery.trim()) {
      const q = attendanceSearchQuery.trim().toLowerCase();
      const name = (item.name || '').toLowerCase();
      const phone = (item.phone || '').toLowerCase();
      const roles = item.roles.map((r) => r.label.toLowerCase()).join(' ');
      if (!name.includes(q) && !phone.includes(q) && !roles.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const filteredPayments = payments.filter((item) => {
    if (paymentMethodFilter !== 'all') {
      const method = (item.payment_method || '').toLowerCase();
      if (method !== paymentMethodFilter.toLowerCase()) return false;
    }
    if (paymentStaffFilter !== 'all') {
      const sid = (item.staff?.id || item.farm_staff_id)?.toString();
      if (sid !== paymentStaffFilter) return false;
    }
    if (paymentSearch.trim()) {
      const q = paymentSearch.trim().toLowerCase();
      const name = (item.staff?.name || '').toLowerCase();
      const givenBy = (item.given_by?.name || '').toLowerCase();
      const notes = (item.notes || '').toLowerCase();
      const method = (item.payment_method || '').toLowerCase();
      if (!name.includes(q) && !givenBy.includes(q) && !notes.includes(q) && !method.includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <View style={[styles.mainWrapper, { maxWidth: containerMaxWidth }]}>
        {/* Header Sticky */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>{t('Manage Staff') || t('Staff')}</Text>
            <Text style={styles.headerSubtitle}>{t('Manage staff, attendance, and payments with ease.')}</Text>
          </View>

        {/* PWA Segmented Tab Bar */}
        <View style={styles.segmentedTabBar}>
          <TouchableOpacity
            style={[styles.segmentedTab, activeTab === 'staff' && styles.segmentedTabActive]}
            onPress={() => setActiveTab('staff')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentedTabText, activeTab === 'staff' && styles.segmentedTabTextActive]}>
              {t('Staff')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentedTab, activeTab === 'attendance' && styles.segmentedTabActive]}
            onPress={() => setActiveTab('attendance')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentedTabText, activeTab === 'attendance' && styles.segmentedTabTextActive]}>
              {t('Attendance')}
            </Text>
          </TouchableOpacity>

          {permissions.canManageStaff(user) && (
            <TouchableOpacity
              style={[styles.segmentedTab, activeTab === 'payments' && styles.segmentedTabActive]}
              onPress={() => setActiveTab('payments')}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentedTabText, activeTab === 'payments' && styles.segmentedTabTextActive]}>
                {t('Payment')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Content Area */}
      {activeTab === 'staff' && (
        <View style={styles.tabContent}>
          {/* Search & Filter Row */}
          <View style={styles.filterSection}>
            <View style={styles.searchFilterRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color="#64748b" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t('Search by name, farm and role') || 'Search by name, farm and role'}
                  placeholderTextColor="#94a3b8"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  (statusFilter !== 'active' || farmFilter !== 'all' || roleFilter !== 'all') &&
                    styles.filterBtnActive,
                ]}
                onPress={() => {
                  setStaffFilterOpenDropdown(null);
                  setFilterModalTab('staff');
                }}
                activeOpacity={0.7}
                accessibilityLabel="Filter staff"
              >
                <Ionicons
                  name="funnel-outline"
                  size={19}
                  color={
                    statusFilter !== 'active' || farmFilter !== 'all' || roleFilter !== 'all'
                      ? '#ffffff'
                      : '#64748b'
                  }
                />
              </TouchableOpacity>
            </View>

            {/* Active Filter Chips */}
            {(statusFilter !== 'active' || farmFilter !== 'all' || roleFilter !== 'all') && (
              <View style={styles.activeFilterRow}>
                {statusFilter !== 'active' && (
                  <View style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText}>
                      {t('Status')}: {statusFilter === 'inactive' ? t('Inactive') : t('All')}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setStatusFilter('active')}
                      style={styles.activeFilterChipClear}
                      accessibilityLabel="Reset status filter"
                    >
                      <Ionicons name="close" size={13} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                )}
                {farmFilter !== 'all' && (
                  <View style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText}>
                      {t('Farm')}:{' '}
                      {activeFarms.find(
                        (f) =>
                          (f.ulid || (f.id ? f.id.toString() : '')) === farmFilter ||
                          (f.id ? f.id.toString() === farmFilter : false)
                      )?.name || farmFilter}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setFarmFilter('all')}
                      style={styles.activeFilterChipClear}
                      accessibilityLabel="Reset farm filter"
                    >
                      <Ionicons name="close" size={13} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                )}
                {roleFilter !== 'all' && (
                  <View style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText}>
                      {t('Role')}: {roleFilter}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setRoleFilter('all')}
                      style={styles.activeFilterChipClear}
                      accessibilityLabel="Reset role filter"
                    >
                      <Ionicons name="close" size={13} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={staff}
              keyExtractor={(item) => item.ulid || item.id.toString()}
              renderItem={renderStaffCard}
              contentContainerStyle={styles.listContent}
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
                  icon="people-outline"
                  title={
                    searchQuery || statusFilter !== 'active' || farmFilter !== 'all' || roleFilter !== 'all'
                      ? t('No Matching Staff')
                      : t('No Staff Members')
                  }
                  message={
                    searchQuery || statusFilter !== 'active' || farmFilter !== 'all' || roleFilter !== 'all'
                      ? t('No staff members match your search or filter options.')
                      : t('Register workers, managers, and consultants to manage tasks and payroll.')
                  }
                  actionLabel={
                    permissions.canManageStaff(user) &&
                    !searchQuery &&
                    statusFilter === 'active' &&
                    farmFilter === 'all' &&
                    roleFilter === 'all'
                      ? t('+ Register First Staff')
                      : undefined
                  }
                  onAction={() => setAddStaffModalVisible(true)}
                  secondaryActionLabel={
                    searchQuery || statusFilter !== 'active' || farmFilter !== 'all' || roleFilter !== 'all'
                      ? t('Clear Filters')
                      : undefined
                  }
                  onSecondaryAction={() => {
                    setSearchQuery('');
                    setStatusFilter('active');
                    setFarmFilter('all');
                    setRoleFilter('all');
                  }}
                />
              }
            />
          )}

          {permissions.canManageStaff(user) && (
            <TouchableOpacity
              style={styles.fab}
              onPress={() => setAddStaffModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add" size={22} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {activeTab === 'attendance' && (
        <View style={styles.tabContent}>
          {/* Date Picker Row with Fast Attendance Banner */}
          <View style={styles.datePickerRow}>
            <TouchableOpacity style={styles.arrowBtn} onPress={handlePrevDay} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={colors.slate700} />
            </TouchableOpacity>

            <View style={styles.dateDisplay}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.dateDisplayText}>{attendanceDate}</Text>
            </View>

            <TouchableOpacity style={styles.arrowBtn} onPress={handleNextDay} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={20} color={colors.slate700} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.markAllBtn}
              onPress={handleMarkAllPresent}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={15} color={colors.primaryDark} />
              <Text style={styles.markAllBtnText}>{t('All Present')}</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Metrics Ticker */}
          <View style={styles.musterTicker}>
            <View style={styles.musterTickerItem}>
              <Text style={styles.musterTickerValGreen}>{presentCount}</Text>
              <Text style={styles.musterTickerLabel}>{t('Present')}</Text>
            </View>
            <View style={styles.musterTickerItem}>
              <Text style={styles.musterTickerValAmber}>{halfDayCount}</Text>
              <Text style={styles.musterTickerLabel}>{t('Half Day')}</Text>
            </View>
            <View style={styles.musterTickerItem}>
              <Text style={styles.musterTickerValRed}>{absentCount}</Text>
              <Text style={styles.musterTickerLabel}>{t('Absent')}</Text>
            </View>
            <View style={styles.musterTickerItem}>
              <Text style={styles.musterTickerValBlue}>{staff.length}</Text>
              <Text style={styles.musterTickerLabel}>{t('Total Staff')}</Text>
            </View>
          </View>

          {/* Search & Filter Row for Attendance */}
          <View style={styles.filterSection}>
            <View style={styles.searchFilterRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color="#64748b" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  value={attendanceSearchQuery}
                  onChangeText={setAttendanceSearchQuery}
                  placeholder={t('Search staff in attendance...')}
                  placeholderTextColor="#94a3b8"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {attendanceSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setAttendanceSearchQuery('')} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  (attendanceFarmFilter !== 'all' || attendanceStatusFilter !== 'all') &&
                    styles.filterBtnActive,
                ]}
                onPress={() => {
                  setAttendanceFilterOpenDropdown(null);
                  setFilterModalTab('attendance');
                }}
                activeOpacity={0.7}
                accessibilityLabel="Filter attendance"
              >
                <Ionicons
                  name="funnel-outline"
                  size={19}
                  color={
                    attendanceFarmFilter !== 'all' || attendanceStatusFilter !== 'all'
                      ? '#ffffff'
                      : '#64748b'
                  }
                />
              </TouchableOpacity>
            </View>

            {/* Active Filter Chips */}
            {(attendanceFarmFilter !== 'all' || attendanceStatusFilter !== 'all') && (
              <View style={styles.activeFilterRow}>
                {attendanceStatusFilter !== 'all' && (
                  <View style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText}>
                      {t('Status')}:{' '}
                      {attendanceStatusFilter === 'present'
                        ? t('Present')
                        : attendanceStatusFilter === 'half_day'
                        ? t('Half Day')
                        : t('Absent')}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setAttendanceStatusFilter('all')}
                      style={styles.activeFilterChipClear}
                      accessibilityLabel="Reset attendance status filter"
                    >
                      <Ionicons name="close" size={13} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                )}
                {attendanceFarmFilter !== 'all' && (
                  <View style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText}>
                      {t('Farm')}:{' '}
                      {activeFarms.find(
                        (f) =>
                          (f.id ? f.id.toString() === attendanceFarmFilter : false) ||
                          f.ulid === attendanceFarmFilter
                      )?.name || attendanceFarmFilter}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setAttendanceFarmFilter('all')}
                      style={styles.activeFilterChipClear}
                      accessibilityLabel="Reset attendance farm filter"
                    >
                      <Ionicons name="close" size={13} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filteredAttendanceStaff}
              keyExtractor={(item) => item.ulid || item.id.toString()}
              renderItem={renderAttendanceCard}
              contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
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
                  icon="calendar-outline"
                  title={
                    attendanceSearchQuery || attendanceFarmFilter !== 'all' || attendanceStatusFilter !== 'all'
                      ? t('No Matching Staff')
                      : t('No Active Staff for Attendance')
                  }
                  message={
                    attendanceSearchQuery || attendanceFarmFilter !== 'all' || attendanceStatusFilter !== 'all'
                      ? t('No staff members match your filter criteria for this date.')
                      : t('Only active workers and staff members appear in the daily attendance sheet.')
                  }
                  secondaryActionLabel={
                    attendanceSearchQuery || attendanceFarmFilter !== 'all' || attendanceStatusFilter !== 'all'
                      ? t('Clear Filters')
                      : undefined
                  }
                  onSecondaryAction={() => {
                    setAttendanceSearchQuery('');
                    setAttendanceFarmFilter('all');
                    setAttendanceStatusFilter('all');
                  }}
                />
              }
            />
          )}

          {/* Save Attendance Sticky Footer */}
          <View style={styles.stickyFooterBtnContainer}>
            <TouchableOpacity
              style={styles.saveAttendanceBtn}
              onPress={handleSaveAttendance}
              disabled={savingAttendance}
              activeOpacity={0.8}
            >
              {savingAttendance ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color={colors.white} />
                  <Text style={styles.saveAttendanceBtnText}>{t('Save Attendance')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {activeTab === 'payments' && (
        <View style={styles.tabContent}>
          {/* Search & Filter Row for Payments */}
          <View style={styles.filterSection}>
            <View style={styles.searchFilterRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color="#64748b" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  value={paymentSearch}
                  onChangeText={setPaymentSearch}
                  placeholder={t('Search by name, given by and type')}
                  placeholderTextColor="#94a3b8"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {paymentSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setPaymentSearch('')} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  (paymentMethodFilter !== 'all' || paymentStaffFilter !== 'all') &&
                    styles.filterBtnActive,
                ]}
                onPress={() => {
                  setPaymentFilterOpenDropdown(null);
                  setFilterModalTab('payments');
                }}
                activeOpacity={0.7}
                accessibilityLabel="Filter payments"
              >
                <Ionicons
                  name="funnel-outline"
                  size={19}
                  color={
                    paymentMethodFilter !== 'all' || paymentStaffFilter !== 'all'
                      ? '#ffffff'
                      : '#64748b'
                  }
                />
              </TouchableOpacity>
            </View>

            {/* Active Filter Chips */}
            {(paymentMethodFilter !== 'all' || paymentStaffFilter !== 'all') && (
              <View style={styles.activeFilterRow}>
                {paymentMethodFilter !== 'all' && (
                  <View style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText}>
                      {t('Method')}: {paymentMethodFilter.replace('_', ' ').toUpperCase()}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setPaymentMethodFilter('all')}
                      style={styles.activeFilterChipClear}
                      accessibilityLabel="Reset payment method filter"
                    >
                      <Ionicons name="close" size={13} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                )}
                {paymentStaffFilter !== 'all' && (
                  <View style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText}>
                      {t('Staff')}: {staff.find((s) => s.id.toString() === paymentStaffFilter)?.name || paymentStaffFilter}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setPaymentStaffFilter('all')}
                      style={styles.activeFilterChipClear}
                      accessibilityLabel="Reset payment staff filter"
                    >
                      <Ionicons name="close" size={13} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filteredPayments}
              keyExtractor={(item) => item.ulid || item.id.toString()}
              renderItem={renderPaymentCard}
              contentContainerStyle={styles.listContent}
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
                  icon="cash-outline"
                  title={
                    paymentSearch || paymentMethodFilter !== 'all' || paymentStaffFilter !== 'all'
                      ? t('No Matching Payments')
                      : t('No Payments Recorded')
                  }
                  message={
                    paymentSearch || paymentMethodFilter !== 'all' || paymentStaffFilter !== 'all'
                      ? t('No payment records match your search or filter options.')
                      : t('Disburse advance or wage payments to staff members.')
                  }
                  actionLabel={
                    permissions.canManageStaff(user) &&
                    !paymentSearch &&
                    paymentMethodFilter === 'all' &&
                    paymentStaffFilter === 'all'
                      ? t('+ Record First Payment')
                      : undefined
                  }
                  onAction={() => setAddPaymentModalVisible(true)}
                  secondaryActionLabel={
                    paymentSearch || paymentMethodFilter !== 'all' || paymentStaffFilter !== 'all'
                      ? t('Clear Filters')
                      : undefined
                  }
                  onSecondaryAction={() => {
                    setPaymentSearch('');
                    setPaymentMethodFilter('all');
                    setPaymentStaffFilter('all');
                  }}
                />
              }
            />
          )}

          <TouchableOpacity
            style={styles.fab}
            onPress={() => setAddPaymentModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}
      </View>

      {/* Add Staff Modal */}
      <ModalSheet
        visible={addStaffModalVisible}
        onClose={() => setAddStaffModalVisible(false)}
        title="Register New Staff"
        maxHeight="88%"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          <ModernInput
            label="Full Name"
            required
            placeholder="e.g. Ramesh Kumar"
            placeholderTextColor={colors.slate400}
            value={newStaffName}
            onChangeText={setNewStaffName}
            containerStyle={{ marginBottom: spacing.md }}
          />

          <Text style={styles.inputLabel}>{t('Staff Role')}</Text>
          <QuickChipGroup
            options={ROLE_OPTIONS}
            selectedValue={newStaffRole}
            onSelect={(val) => {
              setNewStaffRole(val as StaffRoleValue);
              if (val === 'Owner') {
                setNewStaffFarms([]);
                setNewStaffFamilyHeadId(null);
              } else if (val === 'Worker') {
                if (farms.length > 0 && newStaffFarms.length === 0) {
                  setNewStaffFarms([Number(farms[0].id)]);
                }
              }
            }}
            size="sm"
          />

          {/* Role-Specific Farm Assignment */}
          {newStaffRole === 'Owner' ? (
            <View style={styles.roleInfoBox}>
              <Ionicons name="information-circle-outline" size={16} color="#1e40af" />
              <Text style={styles.roleInfoText}>{t('Owners automatically have full access to all farms.')}</Text>
            </View>
          ) : newStaffRole === 'Worker' ? (
            <SearchableSelect
              label="Assigned Farm"
              required
              placeholder="Select assigned farm"
              searchPlaceholder="Search farms..."
              items={farms.map((f) => ({
                value: Number(f.id),
                label: f.name,
                sublabel: `${f.area} ${f.area_unit}`,
                icon: 'business-outline',
              }))}
              value={newStaffFarms[0] ?? null}
              onSelect={(val) => setNewStaffFarms(val ? [val] : [])}
              containerStyle={{ marginTop: spacing.md }}
              emptyMessage="No farms found"
            />
          ) : (
            <SearchableSelect
              label="Assigned Farms"
              required
              multiple
              placeholder="Select assigned farms"
              searchPlaceholder="Search farms to assign..."
              items={farms.map((f) => ({
                value: Number(f.id),
                label: f.name,
                sublabel: `${f.area} ${f.area_unit}`,
                icon: 'business-outline',
              }))}
              selectedValues={newStaffFarms}
              onMultiSelect={setNewStaffFarms}
              containerStyle={{ marginTop: spacing.md }}
              emptyMessage="No farms found"
            />
          )}

          {/* Family Head Selection (Worker Only) */}
          {newStaffRole === 'Worker' && (
            <SearchableSelect
              label="Family Head (Optional)"
              allowClear
              clearLabel="None (Independent Worker)"
              placeholder="None (Independent Worker)"
              searchPlaceholder="Search workers..."
              items={staff
                .filter((s) => s.roles.some((r) => r.value === 'Worker'))
                .map((w) => ({
                  value: w.id,
                  label: w.name,
                  sublabel: w.phone || undefined,
                  icon: 'person-outline',
                }))}
              value={newStaffFamilyHeadId}
              onSelect={setNewStaffFamilyHeadId}
              containerStyle={{ marginTop: spacing.md }}
              emptyMessage="No workers found"
            />
          )}

          <ModernInput
            label="Username (Optional)"
            placeholder="e.g. ramesh_farm"
            placeholderTextColor={colors.slate400}
            value={newStaffUsername}
            onChangeText={setNewStaffUsername}
            autoCapitalize="none"
            containerStyle={{ marginTop: spacing.md }}
          />

          {(newStaffRole === 'Owner' || newStaffRole === 'Manager') && (
            <>
              <ModernInput
                label="Email Address"
                required
                placeholder="e.g. ramesh@agri.com"
                placeholderTextColor={colors.slate400}
                value={newStaffEmail}
                onChangeText={setNewStaffEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                containerStyle={{ marginTop: spacing.md }}
              />

              <ModernInput
                label="Initial Password"
                placeholder="Create a temporary password"
                placeholderTextColor={colors.slate400}
                secureTextEntry
                value={newStaffPassword}
                onChangeText={setNewStaffPassword}
                containerStyle={{ marginTop: spacing.md }}
              />
            </>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn]}
              onPress={() => setAddStaffModalVisible(false)}
              disabled={savingStaff}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, styles.saveBtn]}
              onPress={handleAddStaff}
              disabled={savingStaff}
              activeOpacity={0.7}
            >
              {savingStaff ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>{t('Save Staff')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ModalSheet>

      {/* Add Payment Modal */}
      <ModalSheet
        visible={addPaymentModalVisible}
        onClose={() => setAddPaymentModalVisible(false)}
        title={t('Record Staff Payment')}
        maxHeight="88%"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          <SearchableSelect
            label={`${t('Staff Member')} *`}
            placeholder={t('Select Staff Member')}
            searchPlaceholder={t('Search staff members...')}
            items={staff
              .filter((s) => !s.roles.some((r) => r.value === 'Owner'))
              .map((s) => ({
                value: s.id,
                label: s.name,
                sublabel: s.roles.map((r) => t(r.label || r.value)).join(', '),
                icon: 'person-outline',
              }))}
            value={payStaffId}
            onSelect={(val) => setPayStaffId(val ? Number(val) : null)}
            emptyMessage={t('No staff found')}
          />

          <ModernInput
            label={t('Payment Amount')}
            required
            placeholder="0.00"
            placeholderTextColor={colors.slate400}
            keyboardType="decimal-pad"
            value={payAmount}
            onChangeText={setPayAmount}
            prefix={<Text style={{ color: '#059669', fontWeight: '700', marginRight: 4 }}>₹</Text>}
            containerStyle={{ marginTop: spacing.md }}
          />

          <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>{t('Payment Method')} *</Text>
          <QuickChipGroup
            options={PAYMENT_METHOD_OPTIONS}
            selectedValue={payMethod}
            onSelect={(val) => setPayMethod(val)}
            size="sm"
          />

          <ModernDatePicker
            label={t('Payment Date')}
            value={payDate}
            onChange={setPayDate}
            containerStyle={{ marginTop: spacing.md }}
          />

          <SearchableSelect
            label={t('Authorized Given By')}
            allowClear
            clearLabel={t('Current User (Self)')}
            placeholder={t('Current User (Self)')}
            searchPlaceholder={t('Search owners or managers...')}
            items={staff
              .filter((s) => s.roles.some((r) => r.value === 'Owner' || r.value === 'Manager'))
              .map((s) => ({
                value: s.id,
                label: s.name,
                sublabel: s.roles.map((r) => t(r.label || r.value)).join(', '),
                icon: 'person-circle-outline',
              }))}
            value={payGivenBy}
            onSelect={setPayGivenBy}
            containerStyle={{ marginTop: spacing.md }}
            emptyMessage={t('No managers found')}
          />

          <ModernInput
            label={t('Notes')}
            placeholder={t('Weekly wages, harvest bonus...')}
            placeholderTextColor={colors.slate400}
            value={payNotes}
            onChangeText={setPayNotes}
            multiline
            numberOfLines={2}
            containerStyle={{ marginTop: spacing.md, marginBottom: spacing.md }}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn]}
              onPress={() => setAddPaymentModalVisible(false)}
              disabled={savingPayment}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, styles.saveBtn]}
              onPress={handleAddPayment}
              disabled={savingPayment}
              activeOpacity={0.7}
            >
              {savingPayment ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>{t('Record Payment')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ModalSheet>

      {/* Work Location Picker ModalSheet */}
      <ModalSheet
        visible={workLocationModalStaffId !== null}
        onClose={() => setWorkLocationModalStaffId(null)}
        title={t('Select Work Location')}
        maxHeight="55%"
      >
        <ScrollView style={{ maxHeight: 350, paddingBottom: 20 }}>
          {(() => {
            const currentStaffRecord = attendanceRecords.find(
              (r) => r.farm_staff_id === workLocationModalStaffId
            );
            const currentSelectedFarmId = currentStaffRecord?.farm_id ?? null;

            return (
              <>
                <TouchableOpacity
                  style={[
                    styles.filterOptionItem,
                    currentSelectedFarmId === null && styles.filterOptionItemActive,
                  ]}
                  onPress={() => {
                    if (workLocationModalStaffId) {
                      setFarmLocationForStaff(workLocationModalStaffId, null);
                    }
                    setWorkLocationModalStaffId(null);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.filterOptionLeft}>
                    <Ionicons name="close-circle-outline" size={18} color="#64748b" />
                    <Text style={styles.filterOptionText}>{t('Unassigned')}</Text>
                  </View>
                  {currentSelectedFarmId === null && (
                    <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                  )}
                </TouchableOpacity>

                {activeFarms.map((f) => {
                  const isSelected = currentSelectedFarmId === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id ?? f.ulid}
                      style={[
                        styles.filterOptionItem,
                        isSelected && styles.filterOptionItemActive,
                      ]}
                      onPress={() => {
                        if (workLocationModalStaffId) {
                          setFarmLocationForStaff(workLocationModalStaffId, f.id as number);
                        }
                        setWorkLocationModalStaffId(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.filterOptionLeft}>
                        <Ionicons name="business-outline" size={18} color="#16a34a" />
                        <View>
                          <Text style={[styles.filterOptionText, isSelected && styles.filterOptionTextActive]}>
                            {f.name}
                          </Text>
                          {f.area ? (
                            <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                              {f.area} {f.area_unit}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            );
          })()}
        </ScrollView>
      </ModalSheet>

      {/* Manage Staff Filter Bottom Sheet */}
      <ModalSheet
        visible={filterModalTab !== null}
        onClose={() => {
          setStaffFilterOpenDropdown(null);
          setAttendanceFilterOpenDropdown(null);
          setPaymentFilterOpenDropdown(null);
          setFilterModalTab(null);
        }}
        title={
          filterModalTab === 'staff'
            ? t('Filter Staff')
            : filterModalTab === 'attendance'
            ? t('Filter Attendance')
            : t('Filter Payments')
        }
        maxHeight="80%"
      >
        <View style={{ paddingBottom: 20 }}>
          {/* TAB 1: STAFF FILTERS (3 Dropdowns: Status, Assigned Farm, Role) */}
          {filterModalTab === 'staff' && (
            <View>
              {(statusFilter !== 'active' || farmFilter !== 'all' || roleFilter !== 'all') && (
                <TouchableOpacity
                  style={styles.filterResetBtnContainer}
                  onPress={() => {
                    setStatusFilter('active');
                    setFarmFilter('all');
                    setRoleFilter('all');
                    setStaffFilterOpenDropdown(null);
                    setFilterModalTab(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.filterResetBtn}>{t('RESET FILTERS')}</Text>
                </TouchableOpacity>
              )}

              {/* 1. Status Dropdown */}
              <View style={styles.filterDropdownGroup}>
                <Text style={styles.filterDropdownLabel}>{t('STATUS')}</Text>
                <TouchableOpacity
                  style={[
                    styles.filterDropdownTrigger,
                    staffFilterOpenDropdown === 'status' && styles.filterDropdownTriggerActive,
                  ]}
                  onPress={() =>
                    setStaffFilterOpenDropdown(
                      staffFilterOpenDropdown === 'status' ? null : 'status'
                    )
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.filterDropdownTriggerLeft}>
                    <View
                      style={[
                        styles.filterOptionDot,
                        {
                          backgroundColor:
                            statusFilter === 'active'
                              ? '#22c55e'
                              : statusFilter === 'inactive'
                              ? '#ef4444'
                              : '#64748b',
                        },
                      ]}
                    />
                    <Text style={styles.filterDropdownTriggerText} numberOfLines={1}>
                      {statusFilter === 'active'
                        ? t('Active Staff')
                        : statusFilter === 'inactive'
                        ? t('Inactive Staff')
                        : t('All Staff')}
                    </Text>
                  </View>
                  <Ionicons
                    name={staffFilterOpenDropdown === 'status' ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#64748b"
                  />
                </TouchableOpacity>

                {staffFilterOpenDropdown === 'status' && (
                  <View style={styles.filterDropdownMenu}>
                    {[
                      { label: t('Active Staff'), value: 'active', color: '#22c55e' },
                      { label: t('Inactive Staff'), value: 'inactive', color: '#ef4444' },
                      { label: t('All Staff'), value: 'all', color: '#64748b' },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.filterDropdownItem,
                          statusFilter === opt.value && styles.filterDropdownItemActive,
                        ]}
                        onPress={() => {
                          setStatusFilter(opt.value as any);
                          setStaffFilterOpenDropdown(null);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.filterDropdownItemLeft}>
                          <View
                            style={[styles.filterOptionDot, { backgroundColor: opt.color }]}
                          />
                          <Text
                            style={[
                              styles.filterDropdownItemText,
                              statusFilter === opt.value && styles.filterDropdownItemTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </View>
                        {statusFilter === opt.value && (
                          <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* 2. Assigned Farm Dropdown */}
              <View style={styles.filterDropdownGroup}>
                <Text style={styles.filterDropdownLabel}>{t('ASSIGNED FARM')}</Text>
                <TouchableOpacity
                  style={[
                    styles.filterDropdownTrigger,
                    staffFilterOpenDropdown === 'farm' && styles.filterDropdownTriggerActive,
                  ]}
                  onPress={() =>
                    setStaffFilterOpenDropdown(
                      staffFilterOpenDropdown === 'farm' ? null : 'farm'
                    )
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.filterDropdownTriggerLeft}>
                    <Ionicons name="business-outline" size={18} color="#16a34a" />
                    <Text style={styles.filterDropdownTriggerText} numberOfLines={1}>
                      {farmFilter === 'all'
                        ? t('All Farms')
                        : activeFarms.find(
                            (f) =>
                              (f.ulid || (f.id ? f.id.toString() : '')) === farmFilter ||
                              (f.id ? f.id.toString() === farmFilter : false)
                          )?.name || farmFilter}
                    </Text>
                  </View>
                  <Ionicons
                    name={staffFilterOpenDropdown === 'farm' ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#64748b"
                  />
                </TouchableOpacity>

                {staffFilterOpenDropdown === 'farm' && (
                  <View style={styles.filterDropdownMenu}>
                    {activeFarms.length > 5 && (
                      <View style={styles.filterDropdownSearchBox}>
                        <Ionicons name="search-outline" size={16} color="#64748b" />
                        <TextInput
                          style={styles.filterDropdownSearchInput}
                          placeholder={t('Search farms...')}
                          placeholderTextColor="#94a3b8"
                          value={farmFilterSearch}
                          onChangeText={setFarmFilterSearch}
                          autoCorrect={false}
                        />
                        {farmFilterSearch.length > 0 && (
                          <TouchableOpacity onPress={() => setFarmFilterSearch('')}>
                            <Ionicons name="close-circle" size={16} color="#94a3b8" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    <ScrollView
                      style={{ maxHeight: 200 }}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                    >
                      <TouchableOpacity
                        style={[
                          styles.filterDropdownItem,
                          farmFilter === 'all' && styles.filterDropdownItemActive,
                        ]}
                        onPress={() => {
                          setFarmFilter('all');
                          setStaffFilterOpenDropdown(null);
                          setFarmFilterSearch('');
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.filterDropdownItemLeft}>
                          <Ionicons name="grid-outline" size={16} color="#64748b" />
                          <Text
                            style={[
                              styles.filterDropdownItemText,
                              farmFilter === 'all' && styles.filterDropdownItemTextActive,
                            ]}
                          >
                            {t('All Farms')}
                          </Text>
                        </View>
                        {farmFilter === 'all' && (
                          <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                        )}
                      </TouchableOpacity>

                      {activeFarms
                        .filter((f) =>
                          farmFilterSearch.trim()
                            ? f.name.toLowerCase().includes(farmFilterSearch.toLowerCase())
                            : true
                        )
                        .map((f) => {
                          const fVal = (f.ulid || (f.id ? f.id.toString() : ''));
                          const isSelected =
                            farmFilter === fVal ||
                            (f.id ? farmFilter === f.id.toString() : false);
                          return (
                            <TouchableOpacity
                              key={f.id ?? f.ulid ?? fVal}
                              style={[
                                styles.filterDropdownItem,
                                isSelected && styles.filterDropdownItemActive,
                              ]}
                              onPress={() => {
                                setFarmFilter(fVal);
                                setStaffFilterOpenDropdown(null);
                                setFarmFilterSearch('');
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={styles.filterDropdownItemLeft}>
                                <Ionicons name="business-outline" size={16} color="#16a34a" />
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={[
                                      styles.filterDropdownItemText,
                                      isSelected && styles.filterDropdownItemTextActive,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {f.name}
                                  </Text>
                                  {f.area ? (
                                    <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                                      {f.area} {f.area_unit}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                              {isSelected && (
                                <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* 3. Role Dropdown */}
              <View style={styles.filterDropdownGroup}>
                <Text style={styles.filterDropdownLabel}>{t('ROLE')}</Text>
                <TouchableOpacity
                  style={[
                    styles.filterDropdownTrigger,
                    staffFilterOpenDropdown === 'role' && styles.filterDropdownTriggerActive,
                  ]}
                  onPress={() =>
                    setStaffFilterOpenDropdown(
                      staffFilterOpenDropdown === 'role' ? null : 'role'
                    )
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.filterDropdownTriggerLeft}>
                    <Ionicons name="shield-checkmark-outline" size={18} color="#64748b" />
                    <Text style={styles.filterDropdownTriggerText} numberOfLines={1}>
                      {roleFilter === 'all' ? t('All Roles') : roleFilter}
                    </Text>
                  </View>
                  <Ionicons
                    name={staffFilterOpenDropdown === 'role' ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#64748b"
                  />
                </TouchableOpacity>

                {staffFilterOpenDropdown === 'role' && (
                  <View style={styles.filterDropdownMenu}>
                    {[
                      { label: t('All Roles'), value: 'all', color: '#64748b' },
                      { label: t('Worker'), value: 'Worker', color: '#d97706' },
                      { label: t('Manager'), value: 'Manager', color: '#7e22ce' },
                      { label: t('Owner'), value: 'Owner', color: '#2563eb' },
                      { label: t('Consultant'), value: 'Consultant', color: '#16a34a' },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.filterDropdownItem,
                          roleFilter === opt.value && styles.filterDropdownItemActive,
                        ]}
                        onPress={() => {
                          setRoleFilter(opt.value);
                          setStaffFilterOpenDropdown(null);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.filterDropdownItemLeft}>
                          <View
                            style={[styles.filterOptionDot, { backgroundColor: opt.color }]}
                          />
                          <Text
                            style={[
                              styles.filterDropdownItemText,
                              roleFilter === opt.value && styles.filterDropdownItemTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </View>
                        {roleFilter === opt.value && (
                          <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Apply Filters Button */}
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => setFilterModalTab(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.filterApplyBtnText}>{t('Apply Filters')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 2: ATTENDANCE FILTERS (2 Dropdowns: Status, Assigned Farm) */}
          {filterModalTab === 'attendance' && (
            <View>
              {(attendanceFarmFilter !== 'all' || attendanceStatusFilter !== 'all') && (
                <TouchableOpacity
                  style={styles.filterResetBtnContainer}
                  onPress={() => {
                    setAttendanceFarmFilter('all');
                    setAttendanceStatusFilter('all');
                    setAttendanceFilterOpenDropdown(null);
                    setFilterModalTab(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.filterResetBtn}>{t('RESET FILTERS')}</Text>
                </TouchableOpacity>
              )}

              {/* 1. Status Dropdown */}
              <View style={styles.filterDropdownGroup}>
                <Text style={styles.filterDropdownLabel}>{t('ATTENDANCE STATUS')}</Text>
                <TouchableOpacity
                  style={[
                    styles.filterDropdownTrigger,
                    attendanceFilterOpenDropdown === 'status' && styles.filterDropdownTriggerActive,
                  ]}
                  onPress={() =>
                    setAttendanceFilterOpenDropdown(
                      attendanceFilterOpenDropdown === 'status' ? null : 'status'
                    )
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.filterDropdownTriggerLeft}>
                    <View
                      style={[
                        styles.filterOptionDot,
                        {
                          backgroundColor:
                            attendanceStatusFilter === 'present'
                              ? '#22c55e'
                              : attendanceStatusFilter === 'half_day'
                              ? '#d97706'
                              : attendanceStatusFilter === 'absent'
                              ? '#ef4444'
                              : '#64748b',
                        },
                      ]}
                    />
                    <Text style={styles.filterDropdownTriggerText} numberOfLines={1}>
                      {attendanceStatusFilter === 'present'
                        ? `${t('Present')} (${presentCount})`
                        : attendanceStatusFilter === 'half_day'
                        ? `${t('Half Day')} (${halfDayCount})`
                        : attendanceStatusFilter === 'absent'
                        ? `${t('Absent')} (${absentCount})`
                        : `${t('All Staff')} (${staff.length})`}
                    </Text>
                  </View>
                  <Ionicons
                    name={attendanceFilterOpenDropdown === 'status' ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#64748b"
                  />
                </TouchableOpacity>

                {attendanceFilterOpenDropdown === 'status' && (
                  <View style={styles.filterDropdownMenu}>
                    {[
                      { label: t('All Staff'), value: 'all', count: staff.length, color: '#64748b' },
                      { label: t('Present'), value: 'present', count: presentCount, color: '#22c55e' },
                      { label: t('Half Day'), value: 'half_day', count: halfDayCount, color: '#d97706' },
                      { label: t('Absent'), value: 'absent', count: absentCount, color: '#ef4444' },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.filterDropdownItem,
                          attendanceStatusFilter === opt.value && styles.filterDropdownItemActive,
                        ]}
                        onPress={() => {
                          setAttendanceStatusFilter(opt.value as any);
                          setAttendanceFilterOpenDropdown(null);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.filterDropdownItemLeft}>
                          <View
                            style={[styles.filterOptionDot, { backgroundColor: opt.color }]}
                          />
                          <Text
                            style={[
                              styles.filterDropdownItemText,
                              attendanceStatusFilter === opt.value && styles.filterDropdownItemTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </View>
                        <View style={styles.filterOptionRight}>
                          <Text style={styles.filterOptionBadge}>{opt.count}</Text>
                          {attendanceStatusFilter === opt.value && (
                            <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* 2. Assigned Farm Dropdown */}
              <View style={styles.filterDropdownGroup}>
                <Text style={styles.filterDropdownLabel}>{t('ASSIGNED FARM')}</Text>
                <TouchableOpacity
                  style={[
                    styles.filterDropdownTrigger,
                    attendanceFilterOpenDropdown === 'farm' && styles.filterDropdownTriggerActive,
                  ]}
                  onPress={() =>
                    setAttendanceFilterOpenDropdown(
                      attendanceFilterOpenDropdown === 'farm' ? null : 'farm'
                    )
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.filterDropdownTriggerLeft}>
                    <Ionicons name="business-outline" size={18} color="#16a34a" />
                    <Text style={styles.filterDropdownTriggerText} numberOfLines={1}>
                      {attendanceFarmFilter === 'all'
                        ? t('All Farms')
                        : activeFarms.find(
                            (f) =>
                              (f.id ? f.id.toString() === attendanceFarmFilter : false) ||
                              f.ulid === attendanceFarmFilter
                          )?.name || attendanceFarmFilter}
                    </Text>
                  </View>
                  <Ionicons
                    name={attendanceFilterOpenDropdown === 'farm' ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#64748b"
                  />
                </TouchableOpacity>

                {attendanceFilterOpenDropdown === 'farm' && (
                  <View style={styles.filterDropdownMenu}>
                    {activeFarms.length > 5 && (
                      <View style={styles.filterDropdownSearchBox}>
                        <Ionicons name="search-outline" size={16} color="#64748b" />
                        <TextInput
                          style={styles.filterDropdownSearchInput}
                          placeholder={t('Search farms...')}
                          placeholderTextColor="#94a3b8"
                          value={attendanceFarmFilterSearch}
                          onChangeText={setAttendanceFarmFilterSearch}
                          autoCorrect={false}
                        />
                        {attendanceFarmFilterSearch.length > 0 && (
                          <TouchableOpacity onPress={() => setAttendanceFarmFilterSearch('')}>
                            <Ionicons name="close-circle" size={16} color="#94a3b8" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    <ScrollView
                      style={{ maxHeight: 200 }}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                    >
                      <TouchableOpacity
                        style={[
                          styles.filterDropdownItem,
                          attendanceFarmFilter === 'all' && styles.filterDropdownItemActive,
                        ]}
                        onPress={() => {
                          setAttendanceFarmFilter('all');
                          setAttendanceFilterOpenDropdown(null);
                          setAttendanceFarmFilterSearch('');
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.filterDropdownItemLeft}>
                          <Ionicons name="grid-outline" size={16} color="#64748b" />
                          <Text
                            style={[
                              styles.filterDropdownItemText,
                              attendanceFarmFilter === 'all' && styles.filterDropdownItemTextActive,
                            ]}
                          >
                            {t('All Farms')}
                          </Text>
                        </View>
                        {attendanceFarmFilter === 'all' && (
                          <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                        )}
                      </TouchableOpacity>

                      {activeFarms
                        .filter((f) =>
                          attendanceFarmFilterSearch.trim()
                            ? f.name.toLowerCase().includes(attendanceFarmFilterSearch.toLowerCase())
                            : true
                        )
                        .map((f) => {
                          const fVal = (f.ulid || (f.id ? f.id.toString() : ''));
                          const isSelected =
                            attendanceFarmFilter === fVal ||
                            (f.id ? attendanceFarmFilter === f.id.toString() : false);
                          return (
                            <TouchableOpacity
                              key={f.id ?? f.ulid ?? fVal}
                              style={[
                                styles.filterDropdownItem,
                                isSelected && styles.filterDropdownItemActive,
                              ]}
                              onPress={() => {
                                setAttendanceFarmFilter(fVal);
                                setAttendanceFilterOpenDropdown(null);
                                setAttendanceFarmFilterSearch('');
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={styles.filterDropdownItemLeft}>
                                <Ionicons name="business-outline" size={16} color="#16a34a" />
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={[
                                      styles.filterDropdownItemText,
                                      isSelected && styles.filterDropdownItemTextActive,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {f.name}
                                  </Text>
                                  {f.area ? (
                                    <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                                      {f.area} {f.area_unit}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                              {isSelected && (
                                <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Apply Filters Button */}
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => setFilterModalTab(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.filterApplyBtnText}>{t('Apply Filters')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 3: PAYMENT FILTERS (2 Dropdowns: Method, Staff Member) */}
          {filterModalTab === 'payments' && (
            <View>
              {(paymentMethodFilter !== 'all' || paymentStaffFilter !== 'all') && (
                <TouchableOpacity
                  style={styles.filterResetBtnContainer}
                  onPress={() => {
                    setPaymentMethodFilter('all');
                    setPaymentStaffFilter('all');
                    setPaymentFilterOpenDropdown(null);
                    setFilterModalTab(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.filterResetBtn}>{t('RESET FILTERS')}</Text>
                </TouchableOpacity>
              )}

              {/* 1. Payment Method Dropdown */}
              <View style={styles.filterDropdownGroup}>
                <Text style={styles.filterDropdownLabel}>{t('PAYMENT METHOD')}</Text>
                <TouchableOpacity
                  style={[
                    styles.filterDropdownTrigger,
                    paymentFilterOpenDropdown === 'method' && styles.filterDropdownTriggerActive,
                  ]}
                  onPress={() =>
                    setPaymentFilterOpenDropdown(
                      paymentFilterOpenDropdown === 'method' ? null : 'method'
                    )
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.filterDropdownTriggerLeft}>
                    <Ionicons name="card-outline" size={18} color="#16a34a" />
                    <Text style={styles.filterDropdownTriggerText} numberOfLines={1}>
                      {paymentMethodFilter === 'cash'
                        ? 'Cash'
                        : paymentMethodFilter === 'google_pay'
                        ? 'Google Pay'
                        : paymentMethodFilter === 'phonepe'
                        ? 'PhonePe'
                        : paymentMethodFilter === 'other_upi'
                        ? 'UPI'
                        : paymentMethodFilter === 'bank_transfer'
                        ? 'Bank Transfer'
                        : t('All Methods')}
                    </Text>
                  </View>
                  <Ionicons
                    name={paymentFilterOpenDropdown === 'method' ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#64748b"
                  />
                </TouchableOpacity>

                {paymentFilterOpenDropdown === 'method' && (
                  <View style={styles.filterDropdownMenu}>
                    {[
                      { label: t('All Methods'), value: 'all' },
                      { label: 'Cash', value: 'cash' },
                      { label: 'Google Pay', value: 'google_pay' },
                      { label: 'PhonePe', value: 'phonepe' },
                      { label: 'UPI', value: 'other_upi' },
                      { label: 'Bank Transfer', value: 'bank_transfer' },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.filterDropdownItem,
                          paymentMethodFilter === opt.value && styles.filterDropdownItemActive,
                        ]}
                        onPress={() => {
                          setPaymentMethodFilter(opt.value);
                          setPaymentFilterOpenDropdown(null);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.filterDropdownItemLeft}>
                          <Ionicons name="card-outline" size={16} color="#16a34a" />
                          <Text
                            style={[
                              styles.filterDropdownItemText,
                              paymentMethodFilter === opt.value && styles.filterDropdownItemTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </View>
                        {paymentMethodFilter === opt.value && (
                          <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* 2. Staff Member Dropdown */}
              <View style={styles.filterDropdownGroup}>
                <Text style={styles.filterDropdownLabel}>{t('STAFF MEMBER')}</Text>
                <TouchableOpacity
                  style={[
                    styles.filterDropdownTrigger,
                    paymentFilterOpenDropdown === 'staff' && styles.filterDropdownTriggerActive,
                  ]}
                  onPress={() =>
                    setPaymentFilterOpenDropdown(
                      paymentFilterOpenDropdown === 'staff' ? null : 'staff'
                    )
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.filterDropdownTriggerLeft}>
                    <Ionicons name="person-outline" size={18} color="#16a34a" />
                    <Text style={styles.filterDropdownTriggerText} numberOfLines={1}>
                      {paymentStaffFilter === 'all'
                        ? t('All Staff Members')
                        : staff.find((s) => s.id.toString() === paymentStaffFilter)?.name ||
                          paymentStaffFilter}
                    </Text>
                  </View>
                  <Ionicons
                    name={paymentFilterOpenDropdown === 'staff' ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#64748b"
                  />
                </TouchableOpacity>

                {paymentFilterOpenDropdown === 'staff' && (
                  <View style={styles.filterDropdownMenu}>
                    {staff.length > 5 && (
                      <View style={styles.filterDropdownSearchBox}>
                        <Ionicons name="search-outline" size={16} color="#64748b" />
                        <TextInput
                          style={styles.filterDropdownSearchInput}
                          placeholder={t('Search staff members...')}
                          placeholderTextColor="#94a3b8"
                          value={paymentStaffSearch}
                          onChangeText={setPaymentStaffSearch}
                          autoCorrect={false}
                        />
                        {paymentStaffSearch.length > 0 && (
                          <TouchableOpacity onPress={() => setPaymentStaffSearch('')}>
                            <Ionicons name="close-circle" size={16} color="#94a3b8" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    <ScrollView
                      style={{ maxHeight: 200 }}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                    >
                      <TouchableOpacity
                        style={[
                          styles.filterDropdownItem,
                          paymentStaffFilter === 'all' && styles.filterDropdownItemActive,
                        ]}
                        onPress={() => {
                          setPaymentStaffFilter('all');
                          setPaymentFilterOpenDropdown(null);
                          setPaymentStaffSearch('');
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.filterDropdownItemLeft}>
                          <Ionicons name="people-outline" size={16} color="#64748b" />
                          <Text
                            style={[
                              styles.filterDropdownItemText,
                              paymentStaffFilter === 'all' && styles.filterDropdownItemTextActive,
                            ]}
                          >
                            {t('All Staff Members')}
                          </Text>
                        </View>
                        {paymentStaffFilter === 'all' && (
                          <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                        )}
                      </TouchableOpacity>

                      {staff
                        .filter((s) =>
                          paymentStaffSearch.trim()
                            ? s.name.toLowerCase().includes(paymentStaffSearch.toLowerCase())
                            : true
                        )
                        .map((s) => {
                          const isSelected = paymentStaffFilter === s.id.toString();
                          return (
                            <TouchableOpacity
                              key={s.id}
                              style={[
                                styles.filterDropdownItem,
                                isSelected && styles.filterDropdownItemActive,
                              ]}
                              onPress={() => {
                                setPaymentStaffFilter(s.id.toString());
                                setPaymentFilterOpenDropdown(null);
                                setPaymentStaffSearch('');
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={styles.filterDropdownItemLeft}>
                                <Ionicons name="person-outline" size={16} color="#16a34a" />
                                <Text
                                  style={[
                                    styles.filterDropdownItemText,
                                    isSelected && styles.filterDropdownItemTextActive,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {s.name}
                                </Text>
                              </View>
                              {isSelected && (
                                <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Apply Filters Button */}
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => setFilterModalTab(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.filterApplyBtnText}>{t('Apply Filters')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ModalSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  mainWrapper: {
    width: '100%',
    alignSelf: 'center',
    flex: 1,
  },
  header: {
    backgroundColor: colors.white,
    paddingTop: 12,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    gap: spacing.sm,
  },
  headerTitleWrap: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.slate900,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate500,
    marginTop: 2,
  },
  segmentedTabBar: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    backgroundColor: 'rgba(226, 232, 240, 0.72)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.72)',
    marginTop: 4,
  },
  segmentedTab: {
    flex: 1,
    minHeight: 38,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedTabActive: {
    backgroundColor: colors.white,
    borderColor: 'rgba(34, 197, 94, 0.22)',
    borderWidth: 1,
    ...shadows.subtle,
  },
  segmentedTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  segmentedTabTextActive: {
    color: '#14532d',
    fontWeight: '800',
  },

  // PWA Staff Card Styles
  pwaStaffCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    padding: 14,
    position: 'relative',
    ...shadows.subtle,
  },
  pwaRoleStack: {
    position: 'absolute',
    top: 12,
    right: 14,
    zIndex: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    justifyContent: 'flex-end',
    maxWidth: '45%',
  },
  pwaRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pwaRoleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pwaStaffMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  pwaAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  pwaAvatarImg: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  pwaAvatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  pwaStatusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.white,
  },
  pwaStatusDotActive: {
    backgroundColor: '#22c55e',
  },
  pwaStatusDotInactive: {
    backgroundColor: '#94a3b8',
  },
  pwaStaffInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  pwaNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  pwaStaffName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    maxWidth: '65%',
  },
  pwaYouTag: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
    marginLeft: 4,
  },
  pwaMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  pwaMetaText: {
    fontSize: 12,
    color: '#64748b',
    flexShrink: 1,
  },
  pwaWarningText: {
    fontSize: 12,
    color: '#b45309',
    fontWeight: '600',
    flexShrink: 1,
  },
  pwaStaffActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(241, 245, 249, 0.8)',
    justifyContent: 'flex-end',
  },
  pwaPaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.95)',
    backgroundColor: '#f8fafc',
  },
  pwaPaymentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  pwaViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.22)',
    backgroundColor: '#f0fdf4',
  },
  pwaViewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803d',
  },

  // PWA Attendance Card Styles
  pwaAttendanceCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    padding: 14,
    ...shadows.subtle,
  },
  pwaAttendanceCardHalf: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(254, 243, 199, 0.15)',
  },
  pwaAttTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pwaAttMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  pwaAvatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    overflow: 'hidden',
  },
  pwaAvatarTextSmall: {
    fontSize: 14,
    fontWeight: '700',
  },
  pwaAttNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pwaAttStaffName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flexShrink: 1,
  },
  pwaPresentSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pwaPresentSwitchOn: {
    backgroundColor: '#dcfce7',
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  pwaSwitchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pwaSwitchKnobOn: {
    backgroundColor: colors.white,
  },
  pwaPresentSwitchLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  pwaPresentSwitchLabelOn: {
    color: '#15803d',
  },
  pwaAttDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(241, 245, 249, 0.8)',
  },
  pwaDetailsToggle: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  pwaDetailsToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  pwaHalfDayCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  pwaHalfDayCheckActive: {
    backgroundColor: '#fef3c7',
  },
  pwaHalfDayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  pwaHalfDayTextActive: {
    color: '#b45309',
  },
  pwaAttExpanded: {
    marginTop: 10,
    gap: 8,
  },
  pwaWorkFarmRow: {
    marginTop: 4,
  },
  pwaWorkFarmLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
  },
  pwaWorkFarmChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 6,
  },
  pwaWorkFarmChipActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  pwaWorkFarmChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  pwaWorkFarmChipTextActive: {
    color: '#15803d',
    fontWeight: '700',
  },
  pwaAttNotesBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pwaAttNotesInput: {
    fontSize: 12,
    color: '#0f172a',
    minHeight: 32,
  },

  // PWA Payment Card Styles
  pwaPaymentCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.subtle,
  },
  pwaPaymentCardContent: {
    flex: 1,
    minWidth: 0,
    gap: 10,
    marginRight: 8,
  },
  pwaPaymentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  pwaPaymentStaffCol: {
    flex: 1,
  },
  pwaPaymentStaffName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  pwaPaymentDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  pwaPaymentAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#334155',
  },
  pwaPaymentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  pwaPaymentGivenBy: {
    fontSize: 12,
    color: '#475569',
  },
  pwaPaymentMethodPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  pwaPaymentMethodText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  pwaPaymentNotesRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pwaPaymentNotesText: {
    fontSize: 11,
    color: '#64748b',
  },

  tabContent: {
    flex: 1,
  },
  searchRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 4,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  filterPanel: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  filterPanelTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.slate400,
    letterSpacing: 0.8,
  },
  filterResetText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate500,
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  filterPillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
    marginRight: 6,
  },
  filterPillBtnActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryBorder,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
  },
  filterPillTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 90,
    gap: 10,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatarRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 10,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.slate900,
  },
  youIndicator: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  roleBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
  },
  cardBody: {
    marginTop: spacing.sm,
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 6,
  },
  infoText: {
    fontSize: 12,
    color: colors.slate500,
  },
  cardFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  viewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate800,
  },
  payBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  payBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },

  // Attendance Screen
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    gap: 8,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    backgroundColor: colors.primarySurface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  dateDisplayText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  markAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  musterTicker: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    justifyContent: 'space-between',
  },
  musterTickerItem: {
    alignItems: 'center',
  },
  musterTickerValGreen: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  musterTickerValAmber: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accentDark,
  },
  musterTickerValRed: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.danger,
  },
  musterTickerValBlue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.info,
  },
  musterTickerLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.slate500,
    marginTop: 2,
  },
  attendanceCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  attendanceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendanceAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  attendanceStaffName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.slate900,
  },
  staffFarmSubtitle: {
    fontSize: 11,
    color: colors.slate500,
    marginTop: 1,
  },
  attendanceButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.md,
  },
  attBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  attBtnPresentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  attBtnHalfActive: {
    backgroundColor: colors.accentDark,
    borderColor: colors.accentDark,
  },
  attBtnAbsentActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  attBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate700,
  },
  attBtnTextActive: {
    color: colors.white,
  },
  attendanceNotesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate50,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.slate100,
  },
  attendanceNotesInput: {
    flex: 1,
    height: 34,
    fontSize: 12,
    color: colors.slate800,
    marginLeft: 6,
  },
  stickyFooterBtnContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    ...shadows.medium,
  },
  saveAttendanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    ...shadows.glowPrimary,
  },
  saveAttendanceBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },

  // Payments Tab
  paymentCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  paymentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paymentCardLeft: {
    flex: 1,
    marginRight: 10,
  },
  paymentStaffName: {
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
  paymentSubtext: {
    fontSize: 12,
    color: colors.slate500,
  },
  paymentCardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  paymentAmountText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  paymentCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  paymentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paymentMetaText: {
    fontSize: 12,
    color: colors.slate500,
  },
  paymentNotesBox: {
    backgroundColor: colors.slate50,
    borderRadius: radius.xs,
    padding: 6,
    marginTop: 6,
  },
  paymentNotesText: {
    fontSize: 11,
    color: colors.slate600,
  },

  // Empty Container
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.slate500,
    marginTop: 10,
  },

  // FAB
  fab: {
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

  // Modals
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
    height: 64,
    paddingTop: 8,
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
  saveBtn: {
    backgroundColor: colors.primary,
  },
  saveBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  roleInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: spacing.sm,
  },
  roleInfoText: {
    fontSize: 13,
    color: '#1e40af',
    fontWeight: '500',
    flex: 1,
  },
  farmSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  farmSelectChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  farmSelectChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate700,
  },
  farmSelectChipTextActive: {
    color: colors.white,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
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
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
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
  filterResetBtnContainer: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  filterResetBtn: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
    letterSpacing: 0.5,
  },
  filterDropdownGroup: {
    marginBottom: 14,
  },
  filterDropdownLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  filterDropdownTriggerActive: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  filterDropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  filterDropdownTriggerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  filterDropdownMenu: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  filterDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterDropdownItemActive: {
    backgroundColor: '#f0fdf4',
  },
  filterDropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  filterDropdownItemText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  filterDropdownItemTextActive: {
    color: '#15803d',
    fontWeight: '700',
  },
  filterDropdownSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  filterDropdownSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    padding: 0,
  },
  filterApplyBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  filterApplyBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  filterOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  filterOptionItemActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  filterOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  filterOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  filterOptionText: {
    fontSize: 14,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locationDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
  },
  locationDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  locationDropdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
});
