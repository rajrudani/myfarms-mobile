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
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { staffPaymentsApi, CreatePaymentData } from '../src/api/staffPayments';
import { staffApi } from '../src/api/staff';
import { StaffPayment, StaffMember } from '../src/types';
import { extractErrorMessage, getAbsoluteImageUrl } from '../src/api/client';
import { colors, radius, spacing, shadows } from '../src/theme/tokens';
import {
  BentoCard,
  StatusBadge,
  QuickChipGroup,
  ChipOption,
} from '../src/components/ui';

const PAYMENT_METHOD_OPTIONS: ChipOption<'cash' | 'google_pay' | 'phonepe' | 'other_upi' | 'bank_transfer'>[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'Google Pay', value: 'google_pay' },
  { label: 'PhonePe', value: 'phonepe' },
  { label: 'Other UPI', value: 'other_upi' },
  { label: 'Bank', value: 'bank_transfer' },
];

export default function StaffPaymentViewScreen() {
  const { id } = useLocalSearchParams();
  const paymentIdentifier = id as string;

  const [payment, setPayment] = useState<StaffPayment | null>(null);
  const [owners, setOwners] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Payment Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'google_pay' | 'phonepe' | 'other_upi' | 'bank_transfer'>('cash');
  const [payDate, setPayDate] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payGivenBy, setPayGivenBy] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showPayGivenDropdown, setShowPayGivenDropdown] = useState(false);

  const fetchPaymentDetails = async () => {
    if (!paymentIdentifier) return;
    try {
      const data = await staffPaymentsApi.getById(paymentIdentifier);
      setPayment(data);
      setAmount(data.amount.toString());
      setPayMethod(data.payment_method);
      setPayDate(data.date ? data.date.split('T')[0] : '');
      setPayNotes(data.notes || '');
      setPayGivenBy(data.given_by?.id || null);

      const staffList = await staffApi.getAll({ status: 'active' });
      const filteredOwners = staffList.filter((s) =>
        s.roles.some((r) => r.value === 'Owner' || r.value === 'Manager')
      );
      setOwners(filteredOwners);
    } catch (error) {
      console.error('Error fetching payment details:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentDetails();
  }, [paymentIdentifier]);

  const handleUpdatePayment = async () => {
    if (!payment) return;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount.');
      return;
    }

    setSavingEdit(true);
    try {
      const payload: Partial<CreatePaymentData> = {
        amount: parseFloat(amount),
        date: payDate,
        payment_method: payMethod,
        notes: payNotes || null,
        given_by_id: payGivenBy || null,
      };

      const result = await staffPaymentsApi.update(payment.ulid || payment.id, payload);
      setPayment(result);
      Alert.alert('Success', 'Payment details updated successfully.');
      setEditModalVisible(false);
      fetchPaymentDetails();
    } catch (error: any) {
      console.error('Error updating payment:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePayment = () => {
    if (!payment) return;
    Alert.alert(
      'Delete Payment Record',
      'Are you sure you want to delete this payment record? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await staffPaymentsApi.delete(payment.ulid || payment.id);
              Alert.alert('Success', 'Payment record deleted successfully.');
              router.back();
            } catch (error) {
              console.error('Error deleting payment:', error);
              Alert.alert('Error', extractErrorMessage(error));
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading payment voucher...</Text>
      </View>
    );
  }

  if (!payment) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.errorText}>Payment details not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const staffInitials = payment.staff?.name
    ? payment.staff.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'U';

  const selectedGivenByName = payGivenBy
    ? owners.find((o) => o.id === payGivenBy)?.name || 'Select Owner/Manager'
    : 'Select Owner/Manager';

  const cleanMethodLabel = payment.payment_method
    ? payment.payment_method.replace('_', ' ').toUpperCase()
    : 'CASH';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Sticky Header */}
      <View style={styles.navbar}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={colors.slate800} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.navbarTitle}>Payment Voucher</Text>
          <Text style={styles.navbarSubtitle}>Ref #{payment.ulid || payment.id}</Text>
        </View>

        {!payment.is_settled && (
          <TouchableOpacity
            style={styles.navEditBtn}
            onPress={() => setEditModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Amount Voucher Hero Card */}
        <BentoCard variant="elevated" style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>DISBURSED AMOUNT</Text>
          <Text style={styles.summaryAmountText}>
            ₹{Number(payment.amount).toLocaleString('en-IN')}
          </Text>

          <View style={styles.badgeRow}>
            {payment.is_settled && (
              <StatusBadge label="Settled" variant="success" dot />
            )}
            <StatusBadge label={cleanMethodLabel} variant="info" dot={false} />
            <View style={styles.dateBadge}>
              <Ionicons name="calendar-outline" size={13} color={colors.slate500} />
              <Text style={styles.dateBadgeText}>
                {payment.date ? payment.date.split('T')[0] : 'N/A'}
              </Text>
            </View>
          </View>
        </BentoCard>

        {/* Staff Profile Card */}
        <TouchableOpacity
          onPress={() =>
            router.push(`/staff-view?id=${payment.staff?.ulid || payment.staff?.id}`)
          }
          activeOpacity={0.8}
        >
          <BentoCard variant="elevated" style={styles.staffCard}>
            <View style={styles.staffAvatar}>
              {payment.staff?.profile_photo_url || payment.staff?.profile_photo_path ? (
                <Image
                  source={{
                    uri:
                      payment.staff.profile_photo_url ||
                      getAbsoluteImageUrl(payment.staff.profile_photo_path),
                  }}
                  style={styles.staffAvatarImg}
                />
              ) : (
                <Text style={styles.staffAvatarText}>{staffInitials}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.staffName}>{payment.staff?.name || 'Unknown Staff'}</Text>
              <Text style={styles.staffRoleText}>{payment.staff?.role_label || 'Staff Member'}</Text>
              {payment.staff?.email ? (
                <Text style={styles.staffEmailText}>{payment.staff.email}</Text>
              ) : null}
              {payment.staff?.farm_name ? (
                <View style={styles.farmRow}>
                  <Ionicons name="map-outline" size={12} color={colors.slate500} />
                  <Text style={styles.farmText}>{payment.staff.farm_name}</Text>
                </View>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
          </BentoCard>
        </TouchableOpacity>

        {/* Transaction Details Card */}
        <BentoCard variant="elevated" style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Voucher Information</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transaction ID</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {payment.ulid || payment.id}
            </Text>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Disbursement Mode</Text>
            <Text style={styles.detailValue}>{cleanMethodLabel}</Text>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Date</Text>
            <Text style={styles.detailValue}>
              {payment.date ? payment.date.split('T')[0] : 'N/A'}
            </Text>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Authorized Given By</Text>
            <Text style={styles.detailValue}>{payment.given_by?.name || 'Group Owner'}</Text>
          </View>

          {payment.notes ? (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Remarks & Notes</Text>
              <Text style={styles.notesText}>{payment.notes}</Text>
            </View>
          ) : null}
        </BentoCard>

        {/* Action Buttons (only if not settled) */}
        {!payment.is_settled && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={16} color={colors.white} />
              <Text style={styles.editBtnText}>Edit Voucher</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDeletePayment}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.deleteBtnText}>Delete Record</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Edit Payment Modal */}
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
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
            >
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Edit Payment Record</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.slate600} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Staff Member</Text>
              <TextInput
                style={[styles.input, { color: colors.slate500 }]}
                value={payment.staff?.name || 'Unknown Staff'}
                editable={false}
              />

              <Text style={styles.inputLabel}>
                Amount Paid (₹) <Text style={{ color: colors.danger }}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Amount"
                placeholderTextColor={colors.slate400}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={styles.inputLabel}>Payment Method</Text>
              <QuickChipGroup
                options={PAYMENT_METHOD_OPTIONS}
                selectedValue={payMethod}
                onSelect={(val) => setPayMethod(val)}
                size="sm"
              />

              <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Given By</Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setShowPayGivenDropdown(!showPayGivenDropdown)}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownTriggerText}>{selectedGivenByName}</Text>
                <Ionicons
                  name={showPayGivenDropdown ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.slate500}
                />
              </TouchableOpacity>

              {showPayGivenDropdown && (
                <View style={styles.dropdownList}>
                  {owners.map((o) => (
                    <TouchableOpacity
                      key={o.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setPayGivenBy(o.id);
                        setShowPayGivenDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{o.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.inputLabel}>Payment Date (YYYY-MM-DD)</Text>
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
                placeholder="Reference details..."
                placeholderTextColor={colors.slate400}
                value={payNotes}
                onChangeText={setPayNotes}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setEditModalVisible(false)}
                  disabled={savingEdit}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleUpdatePayment}
                  disabled={savingEdit}
                >
                  {savingEdit ? (
                    <ActivityIndicator color={colors.white} />
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
    padding: 20,
    backgroundColor: colors.slate50,
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
    width: 36,
    height: 36,
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
  },
  navEditBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
    gap: spacing.md,
  },
  summaryCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.slate400,
    letterSpacing: 1,
  },
  summaryAmountText: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.primary,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate600,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  staffAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  staffAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
  },
  staffAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate900,
  },
  staffRoleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
    marginTop: 2,
  },
  staffEmailText: {
    fontSize: 11,
    color: colors.slate500,
    marginTop: 2,
  },
  farmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  farmText: {
    fontSize: 11,
    color: colors.slate500,
  },
  detailsCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.slate900,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.slate100,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate500,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate900,
    maxWidth: '55%',
    textAlign: 'right',
  },
  notesContainer: {
    marginTop: spacing.md,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.slate50,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.slate400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 12,
    color: colors.slate700,
    marginTop: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dangerText,
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
    height: 70,
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
