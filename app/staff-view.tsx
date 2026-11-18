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
  Platform,
  KeyboardAvoidingView,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { staffApi } from '../src/api/staff';
import { staffPaymentsApi } from '../src/api/staffPayments';
import { attendanceApi } from '../src/api/attendance';
import { farmsApi } from '../src/api/farms';
import { Farm, StaffMember, StaffPayment, StaffAttendance, StaffRoleValue } from '../src/types';
import { useAuth } from '../src/hooks/useAuth';
import { extractErrorMessage, getAbsoluteImageUrl } from '../src/api/client';
import { permissions } from '../src/utils/permissions';
import { useResponsive } from '../src/utils/responsive';
import { formatCurrency } from '../src/utils/formatters';
import { ModalSheet, ModernInput, SearchableSelect, ModernDatePicker, ConfirmModal, QuickChipGroup, ChipOption } from '../src/components/ui';
import { useTranslation } from '../src/i18n/I18nContext';
import { useToast } from '../src/context/ToastContext';

const PAYMENT_METHOD_OPTIONS: ChipOption<'cash' | 'google_pay' | 'phonepe' | 'other_upi' | 'bank_transfer'>[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'GPay', value: 'google_pay' },
  { label: 'PhonePe', value: 'phonepe' },
  { label: 'UPI', value: 'other_upi' },
  { label: 'Bank', value: 'bank_transfer' },
];

export default function StaffViewScreen() {
  const { id } = useLocalSearchParams();
  const staffIdentifier = id as string;

  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { containerMaxWidth, isTablet } = useResponsive();
  
  // States
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [payments, setPayments] = useState<StaffPayment[]>([]);
  const [attendances, setAttendances] = useState<StaffAttendance[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);

  // Confirm Modals state
  const [deleteStaffModalVisible, setDeleteStaffModalVisible] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState(false);
  const [unassignFarmTarget, setUnassignFarmTarget] = useState<{ id: number; name: string } | null>(null);
  const [unassigningFarm, setUnassigningFarm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentPage, setPaymentPage] = useState(1);

  // Edit Staff Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRoleValue>('Worker');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(true);
  const [selectedFarms, setSelectedFarms] = useState<number[]>([]);
  const [updating, setUpdating] = useState(false);

  // Add Payment Modal State
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'google_pay' | 'phonepe' | 'other_upi' | 'bank_transfer'>('cash');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState('');
  const [payGivenBy, setPayGivenBy] = useState<number | null>(null);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [savingPayment, setSavingPayment] = useState(false);

  // Collapsible danger zone state
  const [showDangerZone, setShowDangerZone] = useState(false);

  // Assign Farm Modal State
  const [assignFarmModalVisible, setAssignFarmModalVisible] = useState(false);
  const [selectedAssignFarmId, setSelectedAssignFarmId] = useState<number | null>(null);
  const [showAssignFarmDropdown, setShowAssignFarmDropdown] = useState(false);
  const [assigningFarm, setAssigningFarm] = useState(false);

  // Settle Payments Modal State
  const [settleModalVisible, setSettleModalVisible] = useState(false);
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);
  const [settleNotes, setSettleNotes] = useState('');
  const [settlingPayments, setSettlingPayments] = useState(false);

  // Edit Attendance Modal State
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'absent' | 'half_day'>('present');
  const [attendanceFarmId, setAttendanceFarmId] = useState<number | null>(null);
  const [attendanceNotes, setAttendanceNotes] = useState('');
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [showAttendanceFarmDropdown, setShowAttendanceFarmDropdown] = useState(false);

  const fetchStaffDetails = async () => {
    if (!staffIdentifier) return;
    try {
      // 1. Fetch Staff Member Details
      const data = await staffApi.getById(staffIdentifier);
      setStaff(data);
      setName(data.name);
      const roleVal = data.roles[0]?.value || 'Worker';
      setRole(roleVal);
      setUsername(data.username || '');
      setEmail(data.email || '');
      setStatus(data.is_active);
      setSelectedFarms(data.farms.map(f => f.id as number));

      // 2. Fetch Payments for this Staff member
      const paymentData = await staffPaymentsApi.getAll({ staff_id: data.id });
      setPayments(paymentData);

      // 3. Fetch Attendances for this Staff member
      const attendanceData = await attendanceApi.getAll({ staff_id: data.id });
      setAttendances(attendanceData);

      // 4. Fetch Farms (for editing assignment)
      const farmData = await farmsApi.getAll();
      setFarms(farmData);

      // 5. Fetch all staff for given-by selector in payment modal
      const staffList = await staffApi.getAll({ status: 'active' });
      setAllStaff(staffList);

    } catch (error) {
      console.error('Error fetching staff details:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStaffDetails();
  }, [staffIdentifier]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStaffDetails();
  };

  const handleUpdateStaff = async () => {
    if (!staff || !staffIdentifier) return;
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Full Name is required.');
      return;
    }

    setUpdating(true);
    try {
      const payload: any = {
        name,
        roles: [role],
        username: username || null,
        email: email || null,
        status,
        farms: selectedFarms,
      };

      if (password) {
        payload.password = password;
      }

      const result = await staffApi.update(staffIdentifier, payload);
      setStaff(result);
      showToast('Staff member details updated successfully.', 'success');
      setPassword('');
      setEditModalVisible(false);
      fetchStaffDetails();
    } catch (error: any) {
      console.error('Error updating staff:', error);
      showToast(extractErrorMessage(error), 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!staff || !staffIdentifier) return;
    try {
      const result = await staffApi.toggleStatus(staffIdentifier);
      setStaff(result);
      setStatus(result.is_active);
      showToast(`Staff member ${result.is_active ? 'activated' : 'deactivated'} successfully.`, 'success');
      fetchStaffDetails();
    } catch (error) {
      console.error('Error toggling status:', error);
      showToast(extractErrorMessage(error), 'error');
    }
  };

  const handleDeleteStaff = () => {
    if (!staff || !staffIdentifier) return;
    setDeleteStaffModalVisible(true);
  };

  const handleConfirmDeleteStaff = async () => {
    if (!staffIdentifier) return;
    setDeletingStaff(true);
    try {
      await staffApi.delete(staffIdentifier);
      setDeleteStaffModalVisible(false);
      showToast('Staff member deleted successfully.', 'success');
      router.back();
    } catch (error) {
      console.error('Error deleting staff:', error);
      showToast(extractErrorMessage(error), 'error');
    } finally {
      setDeletingStaff(false);
    }
  };

  const handleAddPayment = async () => {
    if (!staff) return;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      showToast('Please enter a valid amount.', 'warning');
      return;
    }

    setSavingPayment(true);
    try {
      const payload = {
        farm_staff_id: staff.id,
        amount: parseFloat(amount),
        date: payDate,
        payment_method: payMethod,
        notes: payNotes || null,
        given_by_id: payGivenBy || null,
      };

      await staffPaymentsApi.create(payload);
      showToast('Payment recorded successfully!', 'success');
      setPaymentModalVisible(false);

      // Reset
      setAmount('');
      setPayMethod('cash');
      setPayNotes('');
      setPayDate(new Date().toISOString().split('T')[0]);
      setPayGivenBy(null);

      fetchStaffDetails();
    } catch (error: any) {
      console.error('Error creating payment:', error);
      showToast(extractErrorMessage(error), 'error');
    } finally {
      setSavingPayment(false);
    }
  };

  const toggleFarmSelection = (farmId: number) => {
    if (selectedFarms.includes(farmId)) {
      setSelectedFarms(selectedFarms.filter(id => id !== farmId));
    } else {
      setSelectedFarms([...selectedFarms, farmId]);
    }
  };

  const handleAssignFarm = async () => {
    if (!staff || !selectedAssignFarmId) {
      showToast('Please select a farm to assign.', 'warning');
      return;
    }
    setAssigningFarm(true);
    try {
      await staffApi.assignFarm(staff.id, selectedAssignFarmId);
      showToast('Farm assigned successfully.', 'success');
      setAssignFarmModalVisible(false);
      setSelectedAssignFarmId(null);
      fetchStaffDetails();
    } catch (error: any) {
      console.error('Error assigning farm:', error);
      showToast(extractErrorMessage(error), 'error');
    } finally {
      setAssigningFarm(false);
    }
  };

  const handleUnassignFarm = (farmId: number, farmName: string) => {
    if (!staff) return;
    setUnassignFarmTarget({ id: farmId, name: farmName });
  };

  const handleConfirmUnassignFarm = async () => {
    if (!staff || !unassignFarmTarget) return;
    setUnassigningFarm(true);
    try {
      await staffApi.unassignFarm(staff.id, unassignFarmTarget.id);
      showToast('Farm unassigned successfully.', 'success');
      setUnassignFarmTarget(null);
      fetchStaffDetails();
    } catch (error: any) {
      console.error('Error unassigning farm:', error);
      showToast(extractErrorMessage(error), 'error');
    } finally {
      setUnassigningFarm(false);
    }
  };

  const handleSettlePayments = async () => {
    if (!staff) return;
    setSettlingPayments(true);
    try {
      await staffApi.settlePayments(staff.id, {
        settled_on: settleDate,
        notes: settleNotes || undefined,
      });
      showToast('Payments settled successfully. Current cycle reset to zero.', 'success');
      setSettleModalVisible(false);
      setSettleNotes('');
      setSettleDate(new Date().toISOString().split('T')[0]);
      fetchStaffDetails();
    } catch (error: any) {
      console.error('Error settling payments:', error);
      showToast(extractErrorMessage(error), 'error');
    } finally {
      setSettlingPayments(false);
    }
  };

  const handleSaveDayAttendance = async () => {
    if (!staff) return;
    setSavingAttendance(true);
    try {
      const payload = {
        farm_staff_id: staff.id,
        date: selectedAttendanceDate,
        status: attendanceStatus,
        farm_id: attendanceStatus !== 'absent' ? attendanceFarmId : null,
        notes: attendanceNotes || null,
      };

      await attendanceApi.mark(payload);
      showToast('Attendance updated successfully.', 'success');
      setAttendanceModalVisible(false);
      fetchStaffDetails();
    } catch (error: any) {
      console.error('Error saving day attendance:', error);
      showToast(extractErrorMessage(error), 'error');
    } finally {
      setSavingAttendance(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#166534" />
        <Text style={styles.loadingText}>Loading staff details...</Text>
      </View>
    );
  }

  if (!staff) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Staff member not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Initials
  const initials = staff.name ? staff.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';

  const getRoleColor = (roleVal: string) => {
    switch (roleVal) {
      case 'Owner': return '#2563eb';
      case 'Manager': return '#0891b2';
      case 'Worker': return '#dc2626';
      case 'Consultant': return '#16a34a';
      default: return '#64748b';
    }
  };

  const isWorkerOrConsultant = staff.roles.some(r => r.value === 'Worker' || r.value === 'Consultant');
  const roleColor = getRoleColor(staff.roles[0]?.value || '');
  const activeFarmsList = farms.filter(f => f.is_active);

  // Generate attendance days for the current month
  const getDaysInMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  };

  const getDayDetails = (dayNum: number) => {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), dayNum);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const dateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const found = attendances.find((a) => a.date === dateString);
    const isToday = now.getDate() === dayNum;
    return {
      dayName,
      dateString,
      status: found ? found.status : 'none',
      isToday,
      record: found || null,
    };
  };

  const daysCount = getDaysInMonth();
  const dayStrip = Array.from({ length: daysCount }, (_, i) => i + 1);

  const paymentsPerPage = 5;
  const totalPaymentPages = Math.max(1, Math.ceil(payments.length / paymentsPerPage));
  const paginatedPayments = payments.slice((paymentPage - 1) * paymentsPerPage, paymentPage * paymentsPerPage);

  const currentCyclePaid = staff.payment_stats?.current_paid !== undefined
    ? Number(staff.payment_stats.current_paid)
    : payments.filter((p) => !p.settlement_id && !p.is_settled).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const monthPaid = staff.payment_stats?.month_paid !== undefined
    ? Number(staff.payment_stats.month_paid)
    : payments.filter((p) => {
        if (!p.date) return false;
        const d = new Date(p.date);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const presentCount = staff.attendance_stats?.present_count !== undefined
    ? staff.attendance_stats.present_count
    : attendances.filter((a) => a.status === 'present').length;

  const halfDayCount = staff.attendance_stats?.half_day_count !== undefined
    ? staff.attendance_stats.half_day_count
    : attendances.filter((a) => a.status === 'half_day').length;

  const absentCount = staff.attendance_stats?.absent_count !== undefined
    ? staff.attendance_stats.absent_count
    : attendances.filter((a) => a.status === 'absent').length;

  const selectedGivenByName = payGivenBy
    ? allStaff.find(s => s.id === payGivenBy)?.name || t('Select Owner or Manager')
    : t('Select Owner or Manager');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={[styles.mainWrapper, { maxWidth: containerMaxWidth }]}>
        {/* Sticky Header */}
        <View style={styles.navbar}>
        <TouchableOpacity style={styles.navBackBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#475569" />
        </TouchableOpacity>
        <Text style={styles.navbarTitle}>{t('Staff Overview')}</Text>
        {permissions.canManageStaff(user) ? (
          <TouchableOpacity style={styles.navEditBtn} onPress={() => setEditModalVisible(true)} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={20} color="#166534" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#16a34a']} />}
      >
        {/* 2. Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={[styles.avatarCircle, { backgroundColor: roleColor + '20' }]}>
              {staff.profile_photo_url || staff.profile_photo_path ? (
                <Image
                  source={{
                    uri: staff.profile_photo_url || getAbsoluteImageUrl(staff.profile_photo_path),
                  }}
                  style={styles.avatarImg}
                />
              ) : (
                <Text style={[styles.avatarText, { color: roleColor }]}>{initials}</Text>
              )}
              <View style={[styles.statusDot, { backgroundColor: staff.is_active ? '#22c55e' : '#94a3b8' }]} />
            </View>
            <View style={styles.heroMeta}>
              <Text style={styles.heroName}>{staff.name}</Text>
              <View style={styles.roleBadgeContainer}>
                {staff.roles.map((r, i) => (
                  <View key={i} style={[styles.rolePill, { backgroundColor: getRoleColor(r.value) + '15' }]}>
                    <Text style={[styles.rolePillText, { color: getRoleColor(r.value) }]}>{t(r.label || r.value)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {staff.email && (
            <View style={styles.heroFooter}>
              <Ionicons name="mail-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
              <Text style={styles.heroFooterText}>{staff.email}</Text>
            </View>
          )}

          {staff.family_head && (
            <View style={[styles.heroFooter, { marginTop: 4 }]}>
              <Ionicons name="people-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
              <Text style={styles.heroFooterText}>{t('Family Head')}: {staff.family_head.name}</Text>
            </View>
          )}
        </View>

        {/* 3. Quick Action Buttons */}
        <View style={styles.quickActionsRow}>
          {permissions.canManageStaff(user) && (
            <TouchableOpacity
              style={styles.quickActionBtnOutline}
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={16} color="#475569" style={{ marginRight: 6 }} />
              <Text style={styles.quickActionBtnTextOutline}>{t('Edit Staff')}</Text>
            </TouchableOpacity>
          )}

          {isWorkerOrConsultant && permissions.canManageStaff(user) && (
            <TouchableOpacity
              style={styles.quickActionBtnPayment}
              onPress={() => {
                if (!payGivenBy && user?.id) {
                  const currentStaffUser = allStaff.find(s => s.id === user.id || s.email === user.email);
                  if (currentStaffUser) setPayGivenBy(currentStaffUser.id);
                }
                setPaymentModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="card-outline" size={16} color="#d97706" style={{ marginRight: 6 }} />
              <Text style={styles.quickActionBtnTextPayment}>{t('Record Payment')}</Text>
            </TouchableOpacity>
          )}

          {staff.phone ? (
            <TouchableOpacity
              style={styles.quickActionBtnCall}
              onPress={() => Linking.openURL(`tel:${staff.phone}`)}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={16} color="#166534" style={{ marginRight: 6 }} />
              <Text style={styles.quickActionBtnTextCall}>{t('Call')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* 4. Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { borderLeftColor: '#d97706', borderLeftWidth: 4 }]}>
            <Text style={styles.statLabel}>{t('Current Paid').toUpperCase()}</Text>
            <Text style={[styles.statValue, { color: '#d97706' }]}>
              ₹{Number(currentCyclePaid).toLocaleString('en-IN')}
            </Text>
            <Text style={styles.statSublabel}>
              {t('This Month')}: ₹{Number(monthPaid).toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={[styles.statBox, { borderLeftColor: '#16a34a', borderLeftWidth: 4 }]}>
            <Text style={styles.statLabel}>{t('Attendance').toUpperCase()}</Text>
            <View style={styles.attendanceCountsRow}>
              <View style={styles.attendanceCountCol}>
                <Text style={[styles.attendanceCountNum, { color: '#16a34a' }]}>
                  {presentCount}
                </Text>
                <Text style={styles.attendanceCountLabel}>{t('Present')}</Text>
              </View>
              <View style={styles.attendanceCountCol}>
                <Text style={[styles.attendanceCountNum, { color: '#d97706' }]}>
                  {halfDayCount}
                </Text>
                <Text style={styles.attendanceCountLabel}>{t('Half Day')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 5. Assigned Farms Card */}
        <View style={styles.card}>
          <View style={styles.cardSectionHeader}>
            <Ionicons name="map-outline" size={18} color="#0f172a" style={{ marginRight: 8 }} />
            <Text style={styles.cardSectionTitle}>{t('Assigned Farms')}</Text>
            {(!staff.roles.some(r => r.value === 'Owner')) && staff.farms.length === 0 && (
              <TouchableOpacity
                style={[styles.addInlineBtn, { marginLeft: 'auto' }]}
                onPress={() => setAssignFarmModalVisible(true)}
              >
                <Text style={styles.addInlineBtnText}>+ {t('Assign')}</Text>
              </TouchableOpacity>
            )}
          </View>
          {staff.farms.length === 0 ? (
            <Text style={styles.emptyCardText}>{t('No farm assigned')}</Text>
          ) : (
            staff.farms.map((f, i) => (
              <View key={i} style={[styles.listRow, i > 0 && styles.listRowBorder]}>
                <View style={[styles.statusDotSmall, { backgroundColor: f.is_active ? '#22c55e' : '#94a3b8' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowItemTitle}>{f.name}</Text>
                  <Text style={styles.rowItemSubtitle}>{f.location || t('Location not set')} {f.area_label ? `• ${f.area_label}` : ''}</Text>
                </View>
                {(!staff.roles.some(r => r.value === 'Owner')) && (
                  <TouchableOpacity
                    style={{ padding: 4 }}
                    onPress={() => handleUnassignFarm(f.id as number, f.name)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#dc2626" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {/* 6. Attendance Log Card */}
        <View style={styles.card}>
          <View style={styles.cardSectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="calendar-outline" size={18} color="#0f172a" style={{ marginRight: 8 }} />
              <View>
                <Text style={styles.cardSectionTitle}>{t('Attendance This Month')}</Text>
                <Text style={styles.cardSectionSubtitle}>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.headerReportBtn}
              onPress={() => router.push(`/reports?type=attendance&worker_id=${staff.id}`)}
              activeOpacity={0.7}
            >
              <Ionicons name="clipboard-outline" size={14} color="#1d4ed8" style={{ marginRight: 4 }} />
              <Text style={styles.headerReportBtnText}>{t('Report')}</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayStripContainer}>
            {dayStrip.map((dayNum) => {
              const details = getDayDetails(dayNum);
              let capsuleBg = '#f1f5f9';
              let capsuleText = '#64748b';
              if (details.status === 'present') {
                capsuleBg = '#dcfce7';
                capsuleText = '#15803d';
              } else if (details.status === 'half_day') {
                capsuleBg = '#fef3c7';
                capsuleText = '#b45309';
              } else if (details.status === 'absent') {
                capsuleBg = '#fee2e2';
                capsuleText = '#b91c1c';
              }
              return (
                <TouchableOpacity
                  key={dayNum}
                  style={[
                    styles.dayCapsule,
                    { backgroundColor: capsuleBg },
                    details.isToday && styles.dayCapsuleToday,
                  ]}
                  onPress={() => {
                    setSelectedAttendanceDate(details.dateString);
                    setAttendanceStatus(details.record ? details.record.status : 'present');
                    setAttendanceFarmId(details.record ? details.record.farm?.id || details.record.farm_id || null : null);
                    setAttendanceNotes(details.record ? details.record.notes || '' : '');
                    setAttendanceModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayCapsuleNum, { color: capsuleText }]}>{dayNum}</Text>
                  <Text style={[styles.dayCapsuleName, { color: capsuleText }]}>{details.dayName}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#dcfce7', borderColor: '#22c55e', borderWidth: 1 }]} />
              <Text style={styles.legendText}>{t('Present')} ({presentCount})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#fef3c7', borderColor: '#f59e0b', borderWidth: 1 }]} />
              <Text style={styles.legendText}>{t('Half Day')} ({halfDayCount})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#fee2e2', borderColor: '#ef4444', borderWidth: 1 }]} />
              <Text style={styles.legendText}>{t('Absent')} ({absentCount})</Text>
            </View>
          </View>
        </View>

        {/* 7. Family Details Card */}
        {(staff.family_head || (staff.family_members && staff.family_members.length > 0)) && (
          <View style={styles.card}>
            <View style={styles.cardSectionHeader}>
              <Ionicons name="people-outline" size={18} color="#0f172a" style={{ marginRight: 8 }} />
              <Text style={styles.cardSectionTitle}>{t('Family Details')}</Text>
            </View>

            {staff.family_head && (
              <TouchableOpacity
                style={styles.familyRow}
                onPress={() => router.push(`/staff-view?id=${staff.family_head?.ulid || staff.family_head?.id}`)}
              >
                <View style={[styles.avatarCircleSmall, { backgroundColor: '#2563eb20' }]}>
                  <Text style={[styles.avatarTextSmall, { color: '#2563eb' }]}>
                    {staff.family_head.name.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowItemTitle}>{staff.family_head.name}</Text>
                  <Text style={styles.familyBadgeHead}>{t('Family Head')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#64748b" />
              </TouchableOpacity>
            )}

            {staff.family_members && staff.family_members.map((member, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.familyRow, (idx > 0 || staff.family_head) && styles.listRowBorder]}
                onPress={() => router.push(`/staff-view?id=${member.ulid || member.id}`)}
              >
                <View style={[styles.avatarCircleSmall, { backgroundColor: '#dc262620' }]}>
                  <Text style={[styles.avatarTextSmall, { color: '#dc2626' }]}>
                    {member.name.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowItemTitle}>{member.name}</Text>
                  <Text style={styles.rowItemSubtitle}>{t('Family Member')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#64748b" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 8. Payment History Card */}
        {isWorkerOrConsultant && (
          <View style={styles.card}>
            <View style={styles.cardSectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="cash-outline" size={18} color="#0f172a" style={{ marginRight: 8 }} />
                <Text style={styles.cardSectionTitle}>{t('Payment History')}</Text>
              </View>
              {permissions.canManageStaff(user) && (
                <TouchableOpacity
                  style={styles.addInlineBtn}
                  onPress={() => {
                    if (!payGivenBy && user?.id) {
                      const currentStaffUser = allStaff.find(s => s.id === user.id || s.email === user.email);
                      if (currentStaffUser) setPayGivenBy(currentStaffUser.id);
                    }
                    setPaymentModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addInlineBtnText}>+ {t('Record Payment')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {payments.length === 0 ? (
              <Text style={styles.emptyCardText}>{t('No payments logged.')}</Text>
            ) : (
              <>
                {paginatedPayments.map((pay, i) => (
                  <TouchableOpacity
                    key={pay.ulid || pay.id || i}
                    style={[styles.paymentListRow, i > 0 && styles.listRowBorder]}
                    onPress={() => router.push(`/staff-payment-view?id=${pay.ulid || pay.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.paymentRowDate}>{pay.date ? pay.date.split('T')[0] : 'N/A'}</Text>
                      <Text style={styles.paymentRowGivenBy}>{t('By')} {pay.given_by?.name || t('Owner')}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.paymentRowAmount}>₹{Number(pay.amount).toLocaleString('en-IN')}</Text>
                      <Text style={styles.paymentRowMethod}>{pay.payment_method.toUpperCase()}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#64748b" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                ))}

                {totalPaymentPages > 1 && (
                  <View style={styles.paginationRow}>
                    <TouchableOpacity
                      style={[styles.pageBtn, paymentPage === 1 && styles.pageBtnDisabled]}
                      onPress={() => setPaymentPage((p) => Math.max(1, p - 1))}
                      disabled={paymentPage === 1}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chevron-back" size={14} color={paymentPage === 1 ? '#cbd5e1' : '#334155'} />
                      <Text style={[styles.pageBtnText, paymentPage === 1 && styles.pageBtnTextDisabled]}>{t('Prev')}</Text>
                    </TouchableOpacity>

                    <Text style={styles.pageInfoText}>
                      {t('Page %{current} of %{total}', { current: paymentPage, total: totalPaymentPages })}
                    </Text>

                    <TouchableOpacity
                      style={[styles.pageBtn, paymentPage === totalPaymentPages && styles.pageBtnDisabled]}
                      onPress={() => setPaymentPage((p) => Math.min(totalPaymentPages, p + 1))}
                      disabled={paymentPage === totalPaymentPages}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pageBtnText, paymentPage === totalPaymentPages && styles.pageBtnTextDisabled]}>{t('Next')}</Text>
                      <Ionicons name="chevron-forward" size={14} color={paymentPage === totalPaymentPages ? '#cbd5e1' : '#334155'} />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* 9. Payment Summary Card */}
        {isWorkerOrConsultant && (
          <View style={styles.card}>
            <View style={styles.cardSectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="analytics-outline" size={18} color="#0f172a" style={{ marginRight: 8 }} />
                <Text style={styles.cardSectionTitle}>{t('Payment Summary')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.headerReportBtn, styles.headerPaymentReportBtn]}
                onPress={() => router.push(`/reports?type=payment&worker_id=${staff.id}`)}
                activeOpacity={0.7}
              >
                <Ionicons name="document-text-outline" size={14} color="#b45309" style={{ marginRight: 4 }} />
                <Text style={[styles.headerReportBtnText, styles.headerPaymentReportBtnText]}>{t('Report')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryList}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryRowLabel}>{t('Current cycle paid')}</Text>
                <Text style={styles.summaryRowValue}>
                  ₹{Number(currentCyclePaid).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryRowLabel}>{t('Total paid this month')}</Text>
                <Text style={styles.summaryRowValue}>
                  ₹{Number(monthPaid).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryRowLabel}>{t('Lifetime paid')}</Text>
                <Text style={styles.summaryRowValue}>
                  ₹{Number(staff.payment_stats?.lifetime_paid || 0).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {/* Last Settlement Information */}
            {staff.last_settlement ? (
              <View style={styles.settlementCard}>
                <View style={styles.settlementCardHeader}>
                  <Ionicons name="receipt-outline" size={15} color="#475569" style={{ marginRight: 6 }} />
                  <Text style={styles.settlementTitle}>{t('Last Settlement')}</Text>
                </View>
                <View style={styles.settlementGrid}>
                  <View style={styles.settlementCol}>
                    <Text style={styles.settlementLabel}>{t('Settlement Date')}</Text>
                    <Text style={styles.settlementValue}>{staff.last_settlement.date || '-'}</Text>
                  </View>
                  <View style={styles.settlementCol}>
                    <Text style={styles.settlementLabel}>{t('Settlement Amount')}</Text>
                    <Text style={[styles.settlementValue, { color: '#0f172a' }]}>
                      ₹{Number(staff.last_settlement.amount || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
                {staff.last_settlement.notes ? (
                  <Text style={styles.settlementNotes} numberOfLines={2}>
                    {staff.last_settlement.notes}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {staff.payment_stats?.last_payment_date && (
              <Text style={styles.lastPaymentText}>
                {t('Last Payment Date')}: {staff.payment_stats.last_payment_date}
              </Text>
            )}

            {currentCyclePaid > 0 && permissions.canManageStaff(user) ? (
              <TouchableOpacity
                style={styles.settleBtn}
                onPress={() => setSettleModalVisible(true)}
              >
                <Ionicons name="refresh-outline" size={14} color="#d97706" style={{ marginRight: 4 }} />
                <Text style={styles.settleBtnText}>{t('Settle & Restart Payments')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* 10. Danger Zone */}
        {permissions.canAccessDangerZone(user) && (
          <View style={[styles.card, styles.dangerZoneCard]}>
            <TouchableOpacity
              style={styles.dangerZoneHeader}
              onPress={() => setShowDangerZone(!showDangerZone)}
            >
              <Ionicons name="warning-outline" size={18} color="#dc2626" style={{ marginRight: 8 }} />
              <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
              <Ionicons name={showDangerZone ? "chevron-up" : "chevron-down"} size={16} color="#dc2626" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>

            {showDangerZone && (
              <View style={styles.dangerZoneContent}>
                <Text style={styles.dangerZoneDesc}>
                  Actions here can affect this staff member's active status and portal access.
                </Text>

                <TouchableOpacity
                  style={[styles.dangerZoneBtn, { backgroundColor: staff.is_active ? '#ffebd9' : '#dcfce7' }]}
                  onPress={handleToggleStatus}
                >
                  <Text style={[styles.dangerZoneBtnText, { color: staff.is_active ? '#d97706' : '#15803d' }]}>
                    {staff.is_active ? 'Deactivate Staff' : 'Activate Staff'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dangerZoneBtn, { backgroundColor: '#fee2e2', marginTop: 10 }]}
                  onPress={handleDeleteStaff}
                >
                  <Text style={[styles.dangerZoneBtnText, { color: '#b91c1c' }]}>Delete Staff Member</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      </View>

      {/* Edit Staff Modal */}
      <ModalSheet
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        title="Edit Staff details"
        maxHeight="88%"
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          <ModernInput
            label="Full Name"
            placeholder="Name"
            value={name}
            onChangeText={setName}
            containerStyle={{ marginBottom: 12 }}
          />

          <SearchableSelect
            label="Role"
            items={[
              { value: 'Owner', label: 'Owner', icon: 'shield-checkmark-outline' },
              { value: 'Manager', label: 'Manager', icon: 'briefcase-outline' },
              { value: 'Worker', label: 'Worker', icon: 'person-outline' },
              { value: 'Consultant', label: 'Consultant', icon: 'medkit-outline' },
            ]}
            value={role}
            onSelect={(val) => setRole(val as StaffRoleValue)}
            containerStyle={{ marginBottom: 12 }}
          />

          {(role === 'Owner' || role === 'Manager') && (
            <>
              <ModernInput
                label="Username"
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                containerStyle={{ marginTop: 12 }}
              />

              <ModernInput
                label="Email"
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                containerStyle={{ marginTop: 12 }}
              />

              <ModernInput
                label="New Password (Optional)"
                placeholder="Type to change password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                containerStyle={{ marginTop: 12 }}
              />
            </>
          )}

          {role !== 'Owner' && (
            <SearchableSelect<number>
              label="Assign Farms"
              placeholder="Select farms"
              searchPlaceholder="Search farms..."
              multiple
              items={activeFarmsList.map((f) => ({
                value: f.id as number,
                label: f.name,
                sublabel: f.area ? `${f.area} ${f.area_unit}` : undefined,
                icon: 'business-outline',
              }))}
              selectedValues={selectedFarms}
              onMultiSelect={(vals) => setSelectedFarms(vals)}
              containerStyle={{ marginTop: 12, marginBottom: 12 }}
            />
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn]}
              onPress={() => setEditModalVisible(false)}
              disabled={updating}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, styles.saveBtn]}
              onPress={handleUpdateStaff}
              disabled={updating}
              activeOpacity={0.7}
            >
              {updating ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ModalSheet>

      {/* Record Payment Modal */}
      <ModalSheet
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        title={t('Record Staff Payment')}
        maxHeight="88%"
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          <ModernInput
            label={t('Staff Member')}
            value={staff.name}
            editable={false}
            containerStyle={{ marginBottom: 12 }}
          />

          <ModernInput
            label={t('Amount')}
            required
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            prefix={<Text style={{ color: '#059669', fontWeight: '700', marginRight: 4 }}>₹</Text>}
            containerStyle={{ marginBottom: 12 }}
          />

          <Text style={[styles.inputLabel, { marginBottom: 8 }]}>
            {t('Payment Method')} <Text style={{ color: '#dc2626' }}>*</Text>
          </Text>
          <QuickChipGroup
            options={PAYMENT_METHOD_OPTIONS}
            selectedValue={payMethod}
            onSelect={(val) => setPayMethod(val)}
            size="sm"
          />

          <SearchableSelect
            label={`${t('Authorized Given By')} *`}
            placeholder={t('Select Owner or Manager')}
            searchPlaceholder={t('Search managers...')}
            items={allStaff
              .filter((s) => s.roles.some((r) => r.value === 'Owner' || r.value === 'Manager'))
              .map((s) => ({
                value: s.id,
                label: s.name,
                sublabel: s.roles.map((r) => r.label || r.value).join(', '),
                icon: 'person-circle-outline',
              }))}
            value={payGivenBy}
            onSelect={setPayGivenBy}
            containerStyle={{ marginTop: 12, marginBottom: 12 }}
            emptyMessage={t('No managers found')}
          />

          <ModernDatePicker
            label={t('Payment Date')}
            value={payDate}
            onChange={setPayDate}
            containerStyle={{ marginBottom: 12 }}
          />

          <ModernInput
            label={t('Notes')}
            placeholder={t('Reference details...')}
            value={payNotes}
            onChangeText={setPayNotes}
            multiline
            numberOfLines={3}
            containerStyle={{ marginBottom: 16 }}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn]}
              onPress={() => setPaymentModalVisible(false)}
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
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>{t('Record Payment')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ModalSheet>

      {/* Assign Farm Modal */}
      <ModalSheet
        visible={assignFarmModalVisible}
        onClose={() => setAssignFarmModalVisible(false)}
        title="Assign Farm"
        maxHeight="60%"
      >
        <SearchableSelect
          label="Select Farm"
          required
          placeholder="Select farm to assign"
          searchPlaceholder="Search available farms..."
          items={activeFarmsList
            .filter((f) => !staff.farms.some((sf) => sf.id === f.id))
            .map((f) => ({
              value: Number(f.id),
              label: f.name,
              sublabel: `${f.area} ${f.area_unit}`,
              icon: 'business-outline',
            }))}
          value={selectedAssignFarmId}
          onSelect={(val) => setSelectedAssignFarmId(val as number)}
          emptyMessage="No unassigned farms found"
        />

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={[styles.modalBtn, styles.cancelBtn]}
            onPress={() => setAssignFarmModalVisible(false)}
            disabled={assigningFarm}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modalBtn, styles.saveBtn]}
            onPress={handleAssignFarm}
            disabled={assigningFarm}
            activeOpacity={0.7}
          >
            {assigningFarm ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveBtnText}>Assign</Text>
            )}
          </TouchableOpacity>
        </View>
      </ModalSheet>

      {/* Settle Payments Modal */}
      <ModalSheet
        visible={settleModalVisible}
        onClose={() => setSettleModalVisible(false)}
        title="Settle Payments"
        maxHeight="75%"
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          <ModernInput
            label="Current Total Unsettled"
            value={formatCurrency(Number(staff.payment_stats?.current_paid || 0))}
            editable={false}
            containerStyle={{ marginBottom: 12 }}
          />

          <ModernDatePicker
            label="Settlement Date"
            value={settleDate}
            onChange={setSettleDate}
            containerStyle={{ marginBottom: 12 }}
          />

          <ModernInput
            label="Notes"
            placeholder="Example: Season Closed, Completed cycle payment..."
            value={settleNotes}
            onChangeText={setSettleNotes}
            multiline
            numberOfLines={3}
            containerStyle={{ marginBottom: 16 }}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn]}
              onPress={() => setSettleModalVisible(false)}
              disabled={settlingPayments}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: '#d97706' }]}
              onPress={handleSettlePayments}
              disabled={settlingPayments}
              activeOpacity={0.7}
            >
              {settlingPayments ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Settle & Restart</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ModalSheet>

      {/* Edit Attendance Modal */}
      <ModalSheet
        visible={attendanceModalVisible}
        onClose={() => setAttendanceModalVisible(false)}
        title="Attendance Details"
        maxHeight="75%"
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          <ModernInput
            label="Date"
            value={selectedAttendanceDate}
            editable={false}
            containerStyle={{ marginBottom: 12 }}
          />

          <Text style={styles.inputLabel}>Status</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <TouchableOpacity
              style={[
                styles.attBtn,
                attendanceStatus === 'present' && { backgroundColor: '#dcfce7', borderColor: '#22c55e' }
              ]}
              onPress={() => setAttendanceStatus('present')}
              activeOpacity={0.7}
            >
              <Text style={[styles.attBtnText, attendanceStatus === 'present' && { color: '#15803d' }]}>Present</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.attBtn,
                attendanceStatus === 'half_day' && { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }
              ]}
              onPress={() => setAttendanceStatus('half_day')}
              activeOpacity={0.7}
            >
              <Text style={[styles.attBtnText, attendanceStatus === 'half_day' && { color: '#b45309' }]}>Half Day</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.attBtn,
                attendanceStatus === 'absent' && { backgroundColor: '#fee2e2', borderColor: '#ef4444' }
              ]}
              onPress={() => setAttendanceStatus('absent')}
              activeOpacity={0.7}
            >
              <Text style={[styles.attBtnText, attendanceStatus === 'absent' && { color: '#b91c1c' }]}>Absent</Text>
            </TouchableOpacity>
          </View>

          {attendanceStatus !== 'absent' && (
            <>
              <SearchableSelect
                label="Work Location"
                placeholder="Select farm location"
                searchPlaceholder="Search staff farms..."
                items={staff.farms.map((f) => ({
                  value: Number(f.id),
                  label: f.name,
                  icon: 'business-outline',
                }))}
                value={attendanceFarmId}
                onSelect={(val) => setAttendanceFarmId(val as number)}
                emptyMessage="No farms found for this staff"
              />

              <ModernInput
                label="Notes"
                placeholder="E.g. check in/out time, tasks..."
                value={attendanceNotes}
                onChangeText={setAttendanceNotes}
                multiline
                numberOfLines={3}
                containerStyle={{ marginTop: 12, marginBottom: 12 }}
              />
            </>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn]}
              onPress={() => setAttendanceModalVisible(false)}
              disabled={savingAttendance}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, styles.saveBtn]}
              onPress={handleSaveDayAttendance}
              disabled={savingAttendance}
              activeOpacity={0.7}
            >
              {savingAttendance ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ModalSheet>

      <ConfirmModal
        visible={deleteStaffModalVisible}
        title="Delete Staff Member"
        message={`Are you sure you want to delete "${staff?.name || 'this staff member'}"? This will remove them from active views.`}
        confirmText="Delete Staff Member"
        destructive
        loading={deletingStaff}
        onConfirm={handleConfirmDeleteStaff}
        onCancel={() => setDeleteStaffModalVisible(false)}
      />

      <ConfirmModal
        visible={!!unassignFarmTarget}
        title="Unassign Farm"
        message={`Are you sure you want to unassign "${unassignFarmTarget?.name || 'this farm'}"? Past records will be preserved.`}
        confirmText="Unassign Farm"
        destructive
        loading={unassigningFarm}
        onConfirm={handleConfirmUnassignFarm}
        onCancel={() => setUnassignFarmTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mainWrapper: {
    width: '100%',
    alignSelf: 'center',
    flex: 1,
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
    color: '#64748b',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 20,
  },
  backBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#16a34a',
  },
  backBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  navBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  navbarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  navEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  heroMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  heroName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  heroSubtext: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  roleBadgeContainer: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 14,
    paddingTop: 12,
  },
  heroFooterText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    gap: 6,
  },
  quickActionBtnTextOutline: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  quickActionBtnPayment: {
    flex: 1,
    flexDirection: 'row',
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    gap: 6,
  },
  quickActionBtnTextPayment: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
  },
  quickActionBtnAttendance: {
    flex: 1,
    flexDirection: 'row',
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    gap: 6,
  },
  quickActionBtnTextAttendance: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  quickActionBtnCall: {
    flex: 1,
    flexDirection: 'row',
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    gap: 6,
  },
  quickActionBtnTextCall: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803d',
  },
  quickActionBtnSolid: {
    flex: 1,
    flexDirection: 'row',
    height: 42,
    borderRadius: 10,
    backgroundColor: '#166534',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  quickActionBtnTextSolid: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 6,
  },
  statUnit: {
    fontSize: 12,
    color: '#64748b',
  },
  statSublabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
    padding: 16,
  },
  cardSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyCardText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  listRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  statusDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  rowItemSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  dayStripContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dayStripCol: {
    alignItems: 'center',
    marginRight: 8,
  },
  dayCapsule: {
    width: 48,
    height: 56,
    minWidth: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayCapsuleToday: {
    borderColor: 'rgba(22, 101, 52, 0.45)',
    borderWidth: 1.5,
  },
  dayCapsuleNum: {
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 17,
  },
  dayCapsuleName: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  pageBtnTextDisabled: {
    color: '#94a3b8',
  },
  pageInfoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  statsSummaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  familyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  avatarCircleSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextSmall: {
    fontSize: 11,
    fontWeight: '800',
  },
  familyBadgeHead: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  paymentListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  paymentRowDate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  paymentRowGivenBy: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  paymentRowAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
  },
  paymentRowMethod: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    marginTop: 2,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryStatItem: {
    alignItems: 'center',
  },
  summaryStatLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  summaryStatValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
    marginTop: 4,
  },
  lastPaymentText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  attendanceCountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 6,
  },
  attendanceCountCol: {
    alignItems: 'flex-start',
  },
  attendanceCountNum: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
  },
  attendanceCountLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 2,
  },
  headerReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  headerReportBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  headerPaymentReportBtn: {
    backgroundColor: '#fffbeb',
    borderColor: 'rgba(217, 119, 6, 0.22)',
  },
  headerPaymentReportBtnText: {
    color: '#b45309',
  },
  summaryList: {
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  summaryRowLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  summaryRowValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  settlementCard: {
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  settlementCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  settlementTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#64748b',
  },
  settlementGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  settlementCol: {
    flex: 1,
  },
  settlementLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  settlementValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  settlementNotes: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
    fontStyle: 'italic',
  },
  cardSectionSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  dangerZoneCard: {
    borderColor: '#fee2e2',
  },
  dangerZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dangerZoneTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#dc2626',
  },
  dangerZoneContent: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#fee2e2',
    paddingTop: 12,
  },
  dangerZoneDesc: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 14,
  },
  dangerZoneBtn: {
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerZoneBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '90%',
  },
  modalHeaderRow: {
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
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  multilineInput: {
    height: 70,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
  },
  dropdownTriggerText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  dropdownList: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginTop: 4,
    paddingVertical: 6,
    maxHeight: 180,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  dropdownCheckboxItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  dropdownItemText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  saveBtn: {
    backgroundColor: '#166534',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  addInlineBtn: {
    backgroundColor: '#f4f7ef',
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.15)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  addInlineBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2f8b43',
    textTransform: 'uppercase',
  },
  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  settleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#d97706',
  },
  attBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  attBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
});
