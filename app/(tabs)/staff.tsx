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
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { staffApi } from '../../src/api/staff';
import { attendanceApi, BulkMarkAttendanceData } from '../../src/api/attendance';
import { staffPaymentsApi, CreatePaymentData } from '../../src/api/staffPayments';
import { farmsApi } from '../../src/api/farms';
import { Farm, StaffMember, StaffPayment, StaffRoleValue } from '../../src/types';
import { useAuth } from '../../src/hooks/useAuth';
import { extractErrorMessage, getAbsoluteImageUrl } from '../../src/api/client';
import { colors, radius, spacing, shadows } from '../../src/theme/tokens';
import {
  BentoCard,
  StatusBadge,
  SearchFilterBar,
  QuickChipGroup,
  ChipOption,
} from '../../src/components/ui';

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
  const { tab } = useLocalSearchParams<{ tab?: 'staff' | 'attendance' | 'payments' }>();
  const { isAuthenticated, user } = useAuth();

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
  const [showFilters, setShowFilters] = useState(false);

  // TAB 2: Attendance - Filter & Date
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceFarmFilter, setAttendanceFarmFilter] = useState<string>('all');
  const [attendanceRecords, setAttendanceRecords] = useState<
    { farm_staff_id: number; farm_id?: number | null; status: 'present' | 'absent' | 'half_day'; notes: string }[]
  >([]);
  const [expandedStaffIds, setExpandedStaffIds] = useState<number[]>([]);
  const [savingAttendance, setSavingAttendance] = useState(false);

  // TAB 3: Payments - Filter & Search
  const [paymentSearch, setPaymentSearch] = useState('');

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
  const [savingStaff, setSavingStaff] = useState(false);
  const [showAddFarmDropdown, setShowAddFarmDropdown] = useState(false);

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
            status: existing ? existing.status : ('present' as const),
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

    setSavingStaff(true);
    try {
      const staffPayload = {
        name: newStaffName,
        roles: [newStaffRole],
        username: newStaffUsername || undefined,
        email: newStaffEmail || undefined,
        password: newStaffPassword || undefined,
        farms: newStaffFarms,
        status: true,
      };

      await staffApi.create(staffPayload as any);
      Alert.alert('Success', 'Staff member registered successfully!');
      setAddStaffModalVisible(false);

      setNewStaffName('');
      setNewStaffRole('Worker');
      setNewStaffUsername('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setNewStaffFarms([]);

      fetchData();
    } catch (error: any) {
      console.error('Error creating staff:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setSavingStaff(false);
    }
  };

  const handleAddPayment = async () => {
    if (!payStaffId) {
      Alert.alert('Validation Error', 'Staff member is required.');
      return;
    }
    if (!payAmount || isNaN(Number(payAmount)) || Number(payAmount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount.');
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
      Alert.alert('Success', 'Payment recorded successfully!');
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
      Alert.alert('Error', extractErrorMessage(error));
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
      Alert.alert('Success', res.message || 'Attendance saved successfully.');
      fetchData();
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      Alert.alert('Error', extractErrorMessage(error));
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
              <Text style={styles.pwaPaymentBtnText}>Payment</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.pwaViewBtn}
            onPress={() => router.push(`/staff-view?id=${item.ulid || item.id}`)}
            activeOpacity={0.7}
          >
            <Ionicons name="eye-outline" size={14} color="#166534" />
            <Text style={styles.pwaViewBtnText}>View</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAttendanceCard = ({ item }: { item: StaffMember }) => {
    const recordIndex = attendanceRecords.findIndex((r) => r.farm_staff_id === item.id);
    const record = recordIndex !== -1 ? attendanceRecords[recordIndex] : null;
    const status = record?.status || 'present';
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

    if (attendanceFarmFilter !== 'all') {
      const matchesFarm = item.farms.some(
        (f) => f.id.toString() === attendanceFarmFilter || f.ulid === attendanceFarmFilter
      );
      if (!matchesFarm) return null;
    }

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
              {isPresent ? 'Present' : 'Absent'}
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
                {isExpanded ? 'Less (-)' : 'More (+)'}
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
                HALF DAY
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Row 3: Expanded details (Work location + notes) */}
        {isPresent && isExpanded ? (
          <View style={styles.pwaAttExpanded}>
            <View style={styles.pwaWorkFarmRow}>
              <Text style={styles.pwaWorkFarmLabel}>Work Location:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                {activeFarms.map((f) => {
                  const isSelected = workFarmId === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.pwaWorkFarmChip, isSelected && styles.pwaWorkFarmChipActive]}
                      onPress={() => setFarmLocation(f.id as number)}
                    >
                      <Text style={[styles.pwaWorkFarmChipText, isSelected && styles.pwaWorkFarmChipTextActive]}>
                        {f.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.pwaAttNotesBox}>
              <TextInput
                style={styles.pwaAttNotesInput}
                placeholder="Work notes..."
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header Sticky */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Manage Staff</Text>
          <Text style={styles.headerSubtitle}>Manage staff, attendance, and payments with ease.</Text>
        </View>

        {/* PWA Segmented Tab Bar */}
        <View style={styles.segmentedTabBar}>
          <TouchableOpacity
            style={[styles.segmentedTab, activeTab === 'staff' && styles.segmentedTabActive]}
            onPress={() => setActiveTab('staff')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentedTabText, activeTab === 'staff' && styles.segmentedTabTextActive]}>
              Staff
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentedTab, activeTab === 'attendance' && styles.segmentedTabActive]}
            onPress={() => setActiveTab('attendance')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentedTabText, activeTab === 'attendance' && styles.segmentedTabTextActive]}>
              Attendance
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentedTab, activeTab === 'payments' && styles.segmentedTabActive]}
            onPress={() => setActiveTab('payments')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentedTabText, activeTab === 'payments' && styles.segmentedTabTextActive]}>
              Payment
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      {activeTab === 'staff' && (
        <View style={styles.tabContent}>
          <View style={styles.searchRow}>
            <SearchFilterBar
              query={searchQuery}
              onChangeQuery={setSearchQuery}
              placeholder="Search by name, farm and role"
              hasFilter
              isFilterActive={showFilters}
              onToggleFilter={() => setShowFilters(!showFilters)}
            />
          </View>

          {/* Filter Panel (Collapsible) */}
          {showFilters && (
            <View style={styles.filterPanel}>
              <View style={styles.filterHeader}>
                <Text style={styles.filterPanelTitle}>QUICK ROSTER FILTERS</Text>
                <TouchableOpacity
                  onPress={() => {
                    setStatusFilter('active');
                    setFarmFilter('all');
                    setRoleFilter('all');
                  }}
                >
                  <Text style={styles.filterResetText}>RESET</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.filterLabel}>STATUS</Text>
              <QuickChipGroup
                options={[
                  { label: 'Active', value: 'active' },
                  { label: 'Inactive', value: 'inactive' },
                  { label: 'All', value: 'all' },
                ]}
                selectedValue={statusFilter}
                onSelect={(val) => setStatusFilter(val as any)}
                size="sm"
              />

              <Text style={[styles.filterLabel, { marginTop: spacing.sm }]}>ASSIGNED FARM</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 6 }}
              >
                <TouchableOpacity
                  style={[
                    styles.filterPillBtn,
                    farmFilter === 'all' && styles.filterPillBtnActive,
                  ]}
                  onPress={() => setFarmFilter('all')}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      farmFilter === 'all' && styles.filterPillTextActive,
                    ]}
                  >
                    All Farms
                  </Text>
                </TouchableOpacity>
                {activeFarms.map((f) => (
                  <TouchableOpacity
                    key={f.ulid || f.id}
                    style={[
                      styles.filterPillBtn,
                      farmFilter === (f.ulid || f.id!.toString()) && styles.filterPillBtnActive,
                    ]}
                    onPress={() => setFarmFilter((f.ulid || f.id!).toString())}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        farmFilter === (f.ulid || f.id!.toString()) && styles.filterPillTextActive,
                      ]}
                    >
                      {f.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.filterLabel, { marginTop: spacing.sm }]}>ROLE</Text>
              <QuickChipGroup
                options={[
                  { label: 'All', value: 'all' },
                  { label: 'Worker', value: 'Worker' },
                  { label: 'Manager', value: 'Manager' },
                  { label: 'Owner', value: 'Owner' },
                  { label: 'Consultant', value: 'Consultant' },
                ]}
                selectedValue={roleFilter}
                onSelect={(val) => setRoleFilter(val)}
                size="sm"
              />
            </View>
          )}

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
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={36} color={colors.slate300} />
                  <Text style={styles.emptyText}>No staff members found.</Text>
                </View>
              }
            />
          )}

          <TouchableOpacity
            style={styles.fab}
            onPress={() => setAddStaffModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add" size={22} color={colors.white} />
          </TouchableOpacity>
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
              <Text style={styles.markAllBtnText}>All Present</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Metrics Ticker */}
          <View style={styles.musterTicker}>
            <View style={styles.musterTickerItem}>
              <Text style={styles.musterTickerValGreen}>{presentCount}</Text>
              <Text style={styles.musterTickerLabel}>Present</Text>
            </View>
            <View style={styles.musterTickerItem}>
              <Text style={styles.musterTickerValAmber}>{halfDayCount}</Text>
              <Text style={styles.musterTickerLabel}>Half Day</Text>
            </View>
            <View style={styles.musterTickerItem}>
              <Text style={styles.musterTickerValRed}>{absentCount}</Text>
              <Text style={styles.musterTickerLabel}>Absent</Text>
            </View>
            <View style={styles.musterTickerItem}>
              <Text style={styles.musterTickerValBlue}>{staff.length}</Text>
              <Text style={styles.musterTickerLabel}>Total Staff</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={staff}
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
                <View style={styles.emptyContainer}>
                  <Ionicons name="calendar-outline" size={36} color={colors.slate300} />
                  <Text style={styles.emptyText}>No active staff members found.</Text>
                </View>
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
                  <Text style={styles.saveAttendanceBtnText}>Save Attendance</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {activeTab === 'payments' && (
        <View style={styles.tabContent}>
          <View style={styles.searchRow}>
            <SearchFilterBar
              query={paymentSearch}
              onChangeQuery={setPaymentSearch}
              placeholder="Search by name, given by and type"
            />
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={payments}
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
                <View style={styles.emptyContainer}>
                  <Ionicons name="cash-outline" size={36} color={colors.slate300} />
                  <Text style={styles.emptyText}>No payment history found.</Text>
                </View>
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

      {/* Add Staff Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addStaffModalVisible}
        onRequestClose={() => setAddStaffModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
            >
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Register New Staff</Text>
                <TouchableOpacity onPress={() => setAddStaffModalVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.slate600} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>
                Full Name <Text style={{ color: colors.danger }}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor={colors.slate400}
                value={newStaffName}
                onChangeText={setNewStaffName}
              />

              <Text style={styles.inputLabel}>Staff Role</Text>
              <QuickChipGroup
                options={ROLE_OPTIONS}
                selectedValue={newStaffRole}
                onSelect={(val) => setNewStaffRole(val)}
                size="sm"
              />

              <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Username (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. ramesh_farm"
                placeholderTextColor={colors.slate400}
                value={newStaffUsername}
                onChangeText={setNewStaffUsername}
                autoCapitalize="none"
              />

              {(newStaffRole === 'Owner' || newStaffRole === 'Manager') && (
                <>
                  <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>
                    Email Address <Text style={{ color: colors.danger }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. ramesh@agri.com"
                    placeholderTextColor={colors.slate400}
                    value={newStaffEmail}
                    onChangeText={setNewStaffEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Initial Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Create a temporary password"
                    placeholderTextColor={colors.slate400}
                    secureTextEntry
                    value={newStaffPassword}
                    onChangeText={setNewStaffPassword}
                  />
                </>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setAddStaffModalVisible(false)}
                  disabled={savingStaff}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleAddStaff}
                  disabled={savingStaff}
                >
                  {savingStaff ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Staff</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Payment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addPaymentModalVisible}
        onRequestClose={() => setAddPaymentModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
            >
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Record Staff Payment</Text>
                <TouchableOpacity onPress={() => setAddPaymentModalVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.slate600} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>
                Staff Member <Text style={{ color: colors.danger }}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setShowPayStaffDropdown(!showPayStaffDropdown)}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownTriggerText}>{selectedStaffName}</Text>
                <Ionicons
                  name={showPayStaffDropdown ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.slate500}
                />
              </TouchableOpacity>

              {showPayStaffDropdown && (
                <View style={styles.dropdownList}>
                  {staff.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setPayStaffId(s.id);
                        setShowPayStaffDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.inputLabel}>
                Payment Amount (₹) <Text style={{ color: colors.danger }}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 5000"
                placeholderTextColor={colors.slate400}
                keyboardType="decimal-pad"
                value={payAmount}
                onChangeText={setPayAmount}
              />

              <Text style={styles.inputLabel}>Payment Method</Text>
              <QuickChipGroup
                options={PAYMENT_METHOD_OPTIONS}
                selectedValue={payMethod}
                onSelect={(val) => setPayMethod(val)}
                size="sm"
              />

              <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.slate400}
                value={payDate}
                onChangeText={setPayDate}
              />

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="e.g. Weekly wages, harvest bonus..."
                placeholderTextColor={colors.slate400}
                value={payNotes}
                onChangeText={setPayNotes}
                multiline
                numberOfLines={2}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setAddPaymentModalVisible(false)}
                  disabled={savingPayment}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleAddPayment}
                  disabled={savingPayment}
                >
                  {savingPayment ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Record Payment</Text>
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
    backgroundColor: colors.slate50,
  },
  header: {
    backgroundColor: colors.white,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 12,
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
    marginBottom: 12,
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
    marginBottom: 12,
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
    marginBottom: 12,
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
    gap: spacing.md,
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
});
