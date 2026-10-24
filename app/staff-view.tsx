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
  Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { staffApi } from '../src/api/staff';
import { staffPaymentsApi } from '../src/api/staffPayments';
import { attendanceApi } from '../src/api/attendance';
import { farmsApi } from '../src/api/farms';
import { Farm, StaffMember, StaffPayment, StaffAttendance, StaffRoleValue } from '../src/types';
import { useAuth } from '../src/hooks/useAuth';
import { extractErrorMessage } from '../src/api/client';

export default function StaffViewScreen() {
  const { id } = useLocalSearchParams();
  const staffIdentifier = id as string;

  const { user } = useAuth();
  
  // States
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [payments, setPayments] = useState<StaffPayment[]>([]);
  const [attendances, setAttendances] = useState<StaffAttendance[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showFarmsDropdown, setShowFarmsDropdown] = useState(false);

  // Add Payment Modal State
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'google_pay' | 'phonepe' | 'other_upi' | 'bank_transfer'>('cash');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState('');
  const [payGivenBy, setPayGivenBy] = useState<number | null>(null);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [savingPayment, setSavingPayment] = useState(false);
  const [showPayMethodDropdown, setShowPayMethodDropdown] = useState(false);
  const [showPayGivenDropdown, setShowPayGivenDropdown] = useState(false);

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
      Alert.alert('Success', 'Staff member details updated successfully.');
      setPassword('');
      setEditModalVisible(false);
      fetchStaffDetails();
    } catch (error: any) {
      console.error('Error updating staff:', error);
      Alert.alert('Error', extractErrorMessage(error));
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
      Alert.alert('Success', `Staff member ${result.is_active ? 'activated' : 'deactivated'} successfully.`);
      fetchStaffDetails();
    } catch (error) {
      console.error('Error toggling status:', error);
      Alert.alert('Error', extractErrorMessage(error));
    }
  };

  const handleDeleteStaff = () => {
    if (!staff || !staffIdentifier) return;
    Alert.alert(
      'Delete Staff Member',
      'Are you sure you want to delete this staff member? This will remove them from active views.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await staffApi.delete(staffIdentifier);
              Alert.alert('Success', 'Staff member deleted successfully.');
              router.back();
            } catch (error) {
              console.error('Error deleting staff:', error);
              Alert.alert('Error', extractErrorMessage(error));
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAddPayment = async () => {
    if (!staff) return;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount.');
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
      Alert.alert('Success', 'Payment recorded successfully!');
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
      Alert.alert('Error', extractErrorMessage(error));
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
      Alert.alert('Validation Error', 'Please select a farm to assign.');
      return;
    }
    setAssigningFarm(true);
    try {
      await staffApi.assignFarm(staff.id, selectedAssignFarmId);
      Alert.alert('Success', 'Farm assigned successfully.');
      setAssignFarmModalVisible(false);
      setSelectedAssignFarmId(null);
      fetchStaffDetails();
    } catch (error: any) {
      console.error('Error assigning farm:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setAssigningFarm(false);
    }
  };

  const handleUnassignFarm = (farmId: number, farmName: string) => {
    if (!staff) return;
    Alert.alert(
      'Unassign Farm',
      `Are you sure you want to unassign ${farmName}? Past records will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await staffApi.unassignFarm(staff.id, farmId);
              Alert.alert('Success', 'Farm unassigned successfully.');
              fetchStaffDetails();
            } catch (error: any) {
              console.error('Error unassigning farm:', error);
              Alert.alert('Error', extractErrorMessage(error));
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSettlePayments = async () => {
    if (!staff) return;
    setSettlingPayments(true);
    try {
      await staffApi.settlePayments(staff.id, {
        settled_on: settleDate,
        notes: settleNotes || undefined,
      });
      Alert.alert('Success', 'Payments settled successfully. Current cycle reset to zero.');
      setSettleModalVisible(false);
      setSettleNotes('');
      setSettleDate(new Date().toISOString().split('T')[0]);
      fetchStaffDetails();
    } catch (error: any) {
      console.error('Error settling payments:', error);
      Alert.alert('Error', extractErrorMessage(error));
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
      Alert.alert('Success', 'Attendance updated successfully.');
      setAttendanceModalVisible(false);
      fetchStaffDetails();
    } catch (error: any) {
      console.error('Error saving day attendance:', error);
      Alert.alert('Error', extractErrorMessage(error));
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

  const selectedGivenByName = payGivenBy
    ? allStaff.find(s => s.id === payGivenBy)?.name || 'Select Owner/Manager'
    : 'Select Owner/Manager';

  return (
    <SafeAreaView style={styles.container}>
      {/* Sticky Header */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navBackBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#475569" />
        </TouchableOpacity>
        <Text style={styles.navbarTitle}>Staff Overview</Text>
        <TouchableOpacity style={styles.navEditBtn} onPress={() => setEditModalVisible(true)} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={20} color="#166534" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#16a34a']} />}
      >
        {/* 2. Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={[styles.avatarCircle, { backgroundColor: roleColor + '20' }]}>
              <Text style={[styles.avatarText, { color: roleColor }]}>{initials}</Text>
              <View style={[styles.statusDot, { backgroundColor: staff.is_active ? '#22c55e' : '#94a3b8' }]} />
            </View>
            <View style={styles.heroMeta}>
              <Text style={styles.heroName}>{staff.name}</Text>
              <Text style={styles.heroSubtext}>@{staff.username || 'no_username'}</Text>
              <View style={styles.roleBadgeContainer}>
                {staff.roles.map((r, i) => (
                  <View key={i} style={[styles.rolePill, { backgroundColor: getRoleColor(r.value) + '15' }]}>
                    <Text style={[styles.rolePillText, { color: getRoleColor(r.value) }]}>{r.label}</Text>
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
              <Text style={styles.heroFooterText}>Family Head: {staff.family_head.name}</Text>
            </View>
          )}
        </View>

        {/* 3. Quick Action Buttons */}
        <View style={styles.quickActionsRow}>
          {isWorkerOrConsultant && (
            <TouchableOpacity
              style={styles.quickActionBtnPayment}
              onPress={() => setPaymentModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="card-outline" size={16} color="#d97706" style={{ marginRight: 6 }} />
              <Text style={styles.quickActionBtnTextPayment}>Payment</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.quickActionBtnAttendance}
            onPress={() => {
              const todayStr = new Date().toISOString().split('T')[0];
              const todayAtt = attendances.find((a) => a.date === todayStr);
              setSelectedAttendanceDate(todayStr);
              setAttendanceStatus(todayAtt ? todayAtt.status : 'present');
              setAttendanceFarmId(todayAtt ? todayAtt.farm?.id || todayAtt.farm_id || null : null);
              setAttendanceNotes(todayAtt ? todayAtt.notes || '' : '');
              setAttendanceModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={16} color="#2563eb" style={{ marginRight: 6 }} />
            <Text style={styles.quickActionBtnTextAttendance}>Attendance</Text>
          </TouchableOpacity>

          {staff.phone ? (
            <TouchableOpacity
              style={styles.quickActionBtnCall}
              onPress={() => Linking.openURL(`tel:${staff.phone}`)}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={16} color="#166534" style={{ marginRight: 6 }} />
              <Text style={styles.quickActionBtnTextCall}>Call</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.quickActionBtnOutline}
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={16} color="#475569" style={{ marginRight: 6 }} />
              <Text style={styles.quickActionBtnTextOutline}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 4. Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { borderLeftColor: '#22c55e', borderLeftWidth: 4 }]}>
            <Text style={styles.statLabel}>THIS MONTH PAID</Text>
            <Text style={[styles.statValue, { color: '#166534' }]}>
              ₹{Number(staff.payment_stats?.month_paid || 0).toLocaleString('en-IN')}
            </Text>
            <Text style={styles.statSublabel}>Current Cycle</Text>
          </View>

          <View style={[styles.statBox, { borderLeftColor: '#3b82f6', borderLeftWidth: 4 }]}>
            <Text style={styles.statLabel}>ATTENDANCE</Text>
            <Text style={styles.statValue}>
              {staff.attendance_stats?.present_count || 0}
              <Text style={styles.statUnit}>d</Text>
            </Text>
            <Text style={styles.statSublabel}>
              {staff.attendance_stats?.half_day_count || 0} Half Days
            </Text>
          </View>
        </View>

        {/* 5. Assigned Farms Card */}
        <View style={styles.card}>
          <View style={styles.cardSectionHeader}>
            <Ionicons name="map-outline" size={18} color="#0f172a" style={{ marginRight: 8 }} />
            <Text style={styles.cardSectionTitle}>Assigned Farms</Text>
            {(!staff.roles.some(r => r.value === 'Owner')) && (
              <TouchableOpacity
                style={[styles.addInlineBtn, { marginLeft: 'auto' }]}
                onPress={() => setAssignFarmModalVisible(true)}
              >
                <Text style={styles.addInlineBtnText}>+ Assign</Text>
              </TouchableOpacity>
            )}
          </View>
          {staff.farms.length === 0 ? (
            <Text style={styles.emptyCardText}>No farms assigned.</Text>
          ) : (
            staff.farms.map((f, i) => (
              <View key={i} style={[styles.listRow, i > 0 && styles.listRowBorder]}>
                <View style={[styles.statusDotSmall, { backgroundColor: f.is_active ? '#22c55e' : '#94a3b8' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowItemTitle}>{f.name}</Text>
                  <Text style={styles.rowItemSubtitle}>{f.location || 'Location not set'} {f.area_label ? `• ${f.area_label}` : ''}</Text>
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
            <Ionicons name="calendar-outline" size={18} color="#0f172a" style={{ marginRight: 8 }} />
            <Text style={styles.cardSectionTitle}>Attendance This Month</Text>
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
              <Text style={styles.legendText}>Present</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#fef3c7', borderColor: '#f59e0b', borderWidth: 1 }]} />
              <Text style={styles.legendText}>Half Day</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#fee2e2', borderColor: '#ef4444', borderWidth: 1 }]} />
              <Text style={styles.legendText}>Absent</Text>
            </View>
          </View>

          <Text style={styles.statsSummaryText}>
            Month total: {staff.attendance_stats?.present_count || 0} Present, {staff.attendance_stats?.half_day_count || 0} Half Day, {staff.attendance_stats?.absent_count || 0} Absent
          </Text>
        </View>

        {/* 7. Family Details Card */}
        {(staff.family_head || (staff.family_members && staff.family_members.length > 0)) && (
          <View style={styles.card}>
            <View style={styles.cardSectionHeader}>
              <Ionicons name="people-outline" size={18} color="#0f172a" style={{ marginRight: 8 }} />
              <Text style={styles.cardSectionTitle}>Family Details</Text>
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
                  <Text style={styles.familyBadgeHead}>Family Head</Text>
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
                  <Text style={styles.rowItemSubtitle}>Family Member</Text>
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
                <Text style={styles.cardSectionTitle}>Payment History</Text>
              </View>
              <TouchableOpacity
                style={styles.addInlineBtn}
                onPress={() => setPaymentModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.addInlineBtnText}>+ Record Payment</Text>
              </TouchableOpacity>
            </View>

            {payments.length === 0 ? (
              <Text style={styles.emptyCardText}>No payments logged.</Text>
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
                      <Text style={styles.paymentRowGivenBy}>Given by: {pay.given_by?.name || 'Owner'}</Text>
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
                      <Text style={[styles.pageBtnText, paymentPage === 1 && styles.pageBtnTextDisabled]}>Prev</Text>
                    </TouchableOpacity>

                    <Text style={styles.pageInfoText}>
                      Page {paymentPage} of {totalPaymentPages}
                    </Text>

                    <TouchableOpacity
                      style={[styles.pageBtn, paymentPage === totalPaymentPages && styles.pageBtnDisabled]}
                      onPress={() => setPaymentPage((p) => Math.min(totalPaymentPages, p + 1))}
                      disabled={paymentPage === totalPaymentPages}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pageBtnText, paymentPage === totalPaymentPages && styles.pageBtnTextDisabled]}>Next</Text>
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
              <Ionicons name="analytics-outline" size={18} color="#0f172a" style={{ marginRight: 8 }} />
              <Text style={styles.cardSectionTitle}>Payment Summary</Text>
            </View>

            <View style={styles.summaryStatsRow}>
              <View style={styles.summaryStatItem}>
                <Text style={styles.summaryStatLabel}>Unsettled</Text>
                <Text style={[styles.summaryStatValue, { color: '#dc2626' }]}>
                  ₹{Number(staff.payment_stats?.current_paid || 0).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.summaryStatItem}>
                <Text style={styles.summaryStatLabel}>This Month</Text>
                <Text style={[styles.summaryStatValue, { color: '#166534' }]}>
                  ₹{Number(staff.payment_stats?.month_paid || 0).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.summaryStatItem}>
                <Text style={styles.summaryStatLabel}>Lifetime</Text>
                <Text style={styles.summaryStatValue}>
                  ₹{Number(staff.payment_stats?.lifetime_paid || 0).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {staff.payment_stats?.last_payment_date && (
              <Text style={styles.lastPaymentText}>
                Last Payment Date: {staff.payment_stats.last_payment_date}
              </Text>
            )}

            {staff.payment_stats?.current_paid && staff.payment_stats.current_paid > 0 ? (
              <TouchableOpacity
                style={styles.settleBtn}
                onPress={() => setSettleModalVisible(true)}
              >
                <Ionicons name="refresh-outline" size={14} color="#d97706" style={{ marginRight: 4 }} />
                <Text style={styles.settleBtnText}>Settle & Restart</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* 10. Danger Zone */}
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
      </ScrollView>

      {/* Edit Staff Modal */}
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
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Edit Staff details</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Name"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.inputLabel}>Role</Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setShowRoleDropdown(!showRoleDropdown)}
              >
                <Text style={styles.dropdownTriggerText}>{role}</Text>
                <Ionicons name={showRoleDropdown ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
              </TouchableOpacity>

              {showRoleDropdown && (
                <View style={styles.dropdownList}>
                  {(['Owner', 'Manager', 'Worker', 'Consultant'] as StaffRoleValue[]).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setRole(r);
                        setShowRoleDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {(role === 'Owner' || role === 'Manager') && (
                <>
                  <Text style={styles.inputLabel}>Username</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Username"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                  />

                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Text style={styles.inputLabel}>New Password (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Type to change password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </>
              )}

              {role !== 'Owner' && (
                <>
                  <Text style={styles.inputLabel}>Assign Farms</Text>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setShowFarmsDropdown(!showFarmsDropdown)}
                  >
                    <Text style={styles.dropdownTriggerText}>
                      {selectedFarms.length > 0 ? `${selectedFarms.length} Farms Selected` : 'Select Farms'}
                    </Text>
                    <Ionicons name={showFarmsDropdown ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
                  </TouchableOpacity>

                  {showFarmsDropdown && (
                    <View style={styles.dropdownList}>
                      {activeFarmsList.map((f) => {
                        const isSelected = selectedFarms.includes(f.id as number);
                        return (
                          <TouchableOpacity
                            key={f.id}
                            style={styles.dropdownCheckboxItem}
                            onPress={() => toggleFarmSelection(f.id as number)}
                          >
                            <Text style={styles.dropdownItemText}>{f.name}</Text>
                            <Ionicons
                              name={isSelected ? "checkbox" : "square-outline"}
                              size={18}
                              color={isSelected ? "#166534" : "#64748b"}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

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
                  onPress={handleUpdateStaff}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
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
        visible={paymentModalVisible}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Record Payment</Text>
                <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Staff Member</Text>
              <TextInput style={[styles.input, { color: '#64748b' }]} value={staff.name} editable={false} />

              <Text style={styles.inputLabel}>Amount Paid (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 5000"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={styles.inputLabel}>Payment Method</Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setShowPayMethodDropdown(!showPayMethodDropdown)}
              >
                <Text style={styles.dropdownTriggerText}>
                  {payMethod.replace('_', ' ').toUpperCase()}
                </Text>
                <Ionicons name={showPayMethodDropdown ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
              </TouchableOpacity>

              {showPayMethodDropdown && (
                <View style={styles.dropdownList}>
                  {([
                    { value: 'cash', label: 'CASH' },
                    { value: 'google_pay', label: 'GOOGLE PAY' },
                    { value: 'phonepe', label: 'PHONEPE' },
                    { value: 'other_upi', label: 'OTHER UPI' },
                    { value: 'bank_transfer', label: 'BANK TRANSFER' },
                  ] as const).map((m) => (
                    <TouchableOpacity
                      key={m.value}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setPayMethod(m.value);
                        setShowPayMethodDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.inputLabel}>Given By</Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setShowPayGivenDropdown(!showPayGivenDropdown)}
              >
                <Text style={styles.dropdownTriggerText}>{selectedGivenByName}</Text>
                <Ionicons name={showPayGivenDropdown ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
              </TouchableOpacity>

              {showPayGivenDropdown && (
                <View style={styles.dropdownList}>
                  {allStaff
                    .filter((s) => s.roles.some((r) => r.value === 'Owner' || r.value === 'Manager'))
                    .map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setPayGivenBy(s.id);
                          setShowPayGivenDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{s.name} ({s.roles[0]?.label})</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              )}

              <Text style={styles.inputLabel}>Payment Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={payDate}
                onChangeText={setPayDate}
              />

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Reference details..."
                value={payNotes}
                onChangeText={setPayNotes}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setPaymentModalVisible(false)}
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
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Record Payment</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Assign Farm Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={assignFarmModalVisible}
        onRequestClose={() => setAssignFarmModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Assign Farm</Text>
              <TouchableOpacity onPress={() => setAssignFarmModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Select Farm</Text>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => setShowAssignFarmDropdown(!showAssignFarmDropdown)}
            >
              <Text style={styles.dropdownTriggerText}>
                {selectedAssignFarmId
                  ? farms.find(f => f.id === selectedAssignFarmId)?.name || 'Select Farm'
                  : 'Select Farm'}
              </Text>
              <Ionicons name={showAssignFarmDropdown ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
            </TouchableOpacity>

            {showAssignFarmDropdown && (
              <View style={styles.dropdownList}>
                {activeFarmsList
                  .filter(f => !staff.farms.some(sf => sf.id === f.id))
                  .map(f => (
                    <TouchableOpacity
                      key={f.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedAssignFarmId(f.id as number);
                        setShowAssignFarmDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{f.name}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setAssignFarmModalVisible(false)}
                disabled={assigningFarm}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={handleAssignFarm}
                disabled={assigningFarm}
              >
                {assigningFarm ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>Assign</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settle Payments Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={settleModalVisible}
        onRequestClose={() => setSettleModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Settle Payments</Text>
                <TouchableOpacity onPress={() => setSettleModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Current Total Unsettled</Text>
              <TextInput
                style={[styles.input, { color: '#64748b' }]}
                value={`₹${Number(staff.payment_stats?.current_paid || 0).toLocaleString('en-IN')}`}
                editable={false}
              />

              <Text style={styles.inputLabel}>Settlement Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={settleDate}
                onChangeText={setSettleDate}
              />

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Example: Season Closed, Completed cycle payment..."
                value={settleNotes}
                onChangeText={setSettleNotes}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setSettleModalVisible(false)}
                  disabled={settlingPayments}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#d97706' }]}
                  onPress={handleSettlePayments}
                  disabled={settlingPayments}
                >
                  {settlingPayments ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Settle & Restart</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Attendance Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={attendanceModalVisible}
        onRequestClose={() => setAttendanceModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Attendance Details</Text>
                <TouchableOpacity onPress={() => setAttendanceModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Date</Text>
              <TextInput style={[styles.input, { color: '#64748b' }]} value={selectedAttendanceDate} editable={false} />

              <Text style={styles.inputLabel}>Status</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity
                  style={[
                    styles.attBtn,
                    attendanceStatus === 'present' && { backgroundColor: '#dcfce7', borderColor: '#22c55e' }
                  ]}
                  onPress={() => setAttendanceStatus('present')}
                >
                  <Text style={[styles.attBtnText, attendanceStatus === 'present' && { color: '#15803d' }]}>Present</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.attBtn,
                    attendanceStatus === 'half_day' && { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }
                  ]}
                  onPress={() => setAttendanceStatus('half_day')}
                >
                  <Text style={[styles.attBtnText, attendanceStatus === 'half_day' && { color: '#b45309' }]}>Half Day</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.attBtn,
                    attendanceStatus === 'absent' && { backgroundColor: '#fee2e2', borderColor: '#ef4444' }
                  ]}
                  onPress={() => setAttendanceStatus('absent')}
                >
                  <Text style={[styles.attBtnText, attendanceStatus === 'absent' && { color: '#b91c1c' }]}>Absent</Text>
                </TouchableOpacity>
              </View>

              {attendanceStatus !== 'absent' && (
                <>
                  <Text style={styles.inputLabel}>Work Location</Text>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setShowAttendanceFarmDropdown(!showAttendanceFarmDropdown)}
                  >
                    <Text style={styles.dropdownTriggerText}>
                      {attendanceFarmId
                        ? farms.find(f => f.id === attendanceFarmId)?.name || 'Select Farm'
                        : 'Select Farm'}
                    </Text>
                    <Ionicons name={showAttendanceFarmDropdown ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
                  </TouchableOpacity>

                  {showAttendanceFarmDropdown && (
                    <View style={styles.dropdownList}>
                      {staff.farms.map(f => (
                        <TouchableOpacity
                          key={f.id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setAttendanceFarmId(f.id);
                            setShowAttendanceFarmDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{f.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.inputLabel}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    placeholder="E.g. check in/out time, tasks..."
                    value={attendanceNotes}
                    onChangeText={setAttendanceNotes}
                    multiline
                    numberOfLines={3}
                  />
                </>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setAttendanceModalVisible(false)}
                  disabled={savingAttendance}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleSaveDayAttendance}
                  disabled={savingAttendance}
                >
                  {savingAttendance ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
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
