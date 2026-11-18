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
  Platform,
  KeyboardAvoidingView,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { staffPaymentsApi, CreatePaymentData } from '../src/api/staffPayments';
import { staffApi } from '../src/api/staff';
import { StaffPayment, StaffMember } from '../src/types';
import { extractErrorMessage } from '../src/api/client';
import { formatCurrency } from '../src/utils/formatters';
import { colors, radius, spacing, shadows } from '../src/theme/tokens';
import { useTranslation } from '../src/i18n/I18nContext';
import {
  QuickChipGroup,
  ChipOption,
  SearchableSelect,
  ModernDatePicker,
  ModernInput,
} from '../src/components/ui';

const PAYMENT_METHOD_OPTIONS: ChipOption<'cash' | 'google_pay' | 'phonepe' | 'other_upi' | 'bank_transfer'>[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'Google Pay', value: 'google_pay' },
  { label: 'PhonePe', value: 'phonepe' },
  { label: 'Other UPI', value: 'other_upi' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
];

export default function StaffPaymentViewScreen() {
  const { t } = useTranslation();
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
      Alert.alert(t('Error'), extractErrorMessage(error));
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
      Alert.alert(t('Validation Error'), t('Please enter a valid amount.'));
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
      Alert.alert(t('Success'), t('Payment updated.'));
      setEditModalVisible(false);
      fetchPaymentDetails();
    } catch (error: any) {
      console.error('Error updating payment:', error);
      Alert.alert(t('Error'), extractErrorMessage(error));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePayment = () => {
    if (!payment) return;
    Alert.alert(
      t('Delete Payment'),
      t('This payment will be removed from the current cycle.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await staffPaymentsApi.delete(payment.ulid || payment.id);
              Alert.alert(t('Success'), t('Payment deleted.'));
              router.back();
            } catch (error) {
              console.error('Error deleting payment:', error);
              Alert.alert(t('Error'), extractErrorMessage(error));
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatDateDisplay = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getMethodConfig = (method?: string) => {
    switch (method) {
      case 'google_pay':
        return {
          label: 'Google Pay',
          icon: 'phone-portrait-outline' as const,
          bg: '#ecfeff',
          text: '#0f766e',
        };
      case 'phonepe':
        return {
          label: 'PhonePe',
          icon: 'phone-portrait-outline' as const,
          bg: '#ecfdf3',
          text: '#15803d',
        };
      case 'other_upi':
        return {
          label: 'Other UPI',
          icon: 'qr-code-outline' as const,
          bg: '#fff7ed',
          text: '#c2410c',
        };
      case 'bank_transfer':
        return {
          label: 'Bank Transfer',
          icon: 'business-outline' as const,
          bg: '#fef2f2',
          text: '#b91c1c',
        };
      case 'cash':
      default:
        return {
          label: 'Cash',
          icon: 'cash-outline' as const,
          bg: '#edf6ee',
          text: '#166534',
        };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#166534" />
        <Text style={styles.loadingText}>{t('Loading payment details...')}</Text>
      </View>
    );
  }

  if (!payment) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={styles.errorText}>{t('Payment not found.')}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>{t('Go Back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const staffInitial = payment.staff?.name
    ? payment.staff.name.trim().charAt(0).toUpperCase()
    : 'S';

  const methodConfig = getMethodConfig(payment.payment_method);
  const formattedDate = formatDateDisplay(payment.date);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* PWA-style Sticky Header */}
      <View style={styles.navbar}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityLabel={t('Back')}
        >
          <Ionicons name="arrow-back" size={18} color="#475569" />
        </TouchableOpacity>

        <Text style={styles.navbarTitle}>{t('Payment Details')}</Text>

        {!payment.is_settled ? (
          <TouchableOpacity
            style={styles.navEditBtn}
            onPress={() => setEditModalVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel={t('Edit Payment')}
          >
            <Ionicons name="create-outline" size={18} color="#166534" />
          </TouchableOpacity>
        ) : (
          <View style={styles.navPlaceholder} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Card 1: PWA Summary Card */}
        <View style={styles.card}>
          <View style={styles.summaryPadding}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>{t('Total Paid').toUpperCase()}</Text>
                <Text style={styles.summaryAmount}>
                  {formatCurrency(payment.amount)}
                </Text>
              </View>

              {payment.is_settled && (
                <View style={styles.cycleBadge}>
                  <Text style={styles.cycleBadgeText}>{t('Settled').toUpperCase()}</Text>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.tagsRow}>
              <View style={[styles.tag, { backgroundColor: methodConfig.bg }]}>
                <Ionicons name={methodConfig.icon} size={15} color={methodConfig.text} />
                <Text style={[styles.tagText, { color: methodConfig.text }]}>
                  {t(methodConfig.label)}
                </Text>
              </View>

              <View style={[styles.tag, { backgroundColor: '#f3f4f6' }]}>
                <Ionicons name="calendar-outline" size={15} color="#374151" />
                <Text style={[styles.tagText, { color: '#374151' }]}>
                  {formattedDate}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Card 2: PWA Staff Profile Card */}
        <View style={styles.card}>
          <TouchableOpacity
            onPress={() => {
              if (payment.staff?.ulid || payment.staff?.id) {
                router.push(`/staff-view?id=${payment.staff.ulid || payment.staff.id}`);
              }
            }}
            activeOpacity={0.8}
            style={styles.staffContainer}
          >
            <View style={styles.staffAvatar}>
              {payment.staff?.profile_photo_url ? (
                <Image
                  source={{ uri: payment.staff.profile_photo_url }}
                  style={styles.staffAvatarImg}
                />
              ) : (
                <Text style={styles.staffAvatarText}>{staffInitial}</Text>
              )}
            </View>

            <View style={styles.staffDetails}>
              <View style={styles.staffNameRow}>
                <Text style={styles.staffName} numberOfLines={1}>
                  {payment.staff?.name || 'Unknown Staff'}
                </Text>
                {payment.staff?.role_label ? (
                  <Text style={styles.staffRole}> ({payment.staff.role_label})</Text>
                ) : null}
              </View>

              {payment.staff?.email ? (
                <Text style={styles.staffEmail} numberOfLines={1}>
                  {payment.staff.email}
                </Text>
              ) : null}

              {payment.staff?.farm_name ? (
                <View style={styles.staffFarmRow}>
                  <Ionicons name="location-outline" size={13} color="#6b7280" />
                  <Text style={styles.staffFarmText} numberOfLines={1}>
                    {payment.staff.farm_name}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.staffNote}>
                {t('Payment made to staff member')}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Card 3: PWA Transaction Details Card */}
        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <Ionicons name="information-circle-outline" size={18} color="#166534" />
            <Text style={styles.sectionHeadTitle}>
              {t('Transaction Details').toUpperCase()}
            </Text>
          </View>

          <View style={styles.sectionBody}>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>{t('Amount')}</Text>
              <Text style={[styles.detailValue, styles.detailValueAmount]}>
                {formatCurrency(payment.amount)}
              </Text>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>{t('Payment Date')}</Text>
              <Text style={styles.detailValue}>{formattedDate}</Text>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>{t('Payment Method')}</Text>
              <Text style={styles.detailValue}>{t(methodConfig.label)}</Text>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>{t('Given By')}</Text>
              <Text style={styles.detailValue}>
                {payment.given_by?.name || '-'}
              </Text>
            </View>

            {payment.notes ? (
              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>{t('Notes').toUpperCase()}</Text>
                <Text style={styles.notesBody}>{payment.notes}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* PWA Action Buttons (when payment is unsettled) */}
        {!payment.is_settled && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={18} color="#ffffff" />
              <Text style={styles.primaryActionBtnText}>{t('Edit Payment')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dangerActionBtn}
              onPress={handleDeletePayment}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={18} color="#dc2626" />
              <Text style={styles.dangerActionBtnText}>{t('Delete Payment')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Back Link at bottom */}
        <TouchableOpacity
          style={styles.backLinkContainer}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backLinkText}>{t('Back to Payment History')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Payment Modal (PWA Form Parity) */}
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
                <Text style={styles.modalTitle}>{t('Edit Payment')}</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.slate600} />
                </TouchableOpacity>
              </View>

              <ModernInput
                label={t('Staff')}
                value={payment.staff?.name || 'Unknown Staff'}
                editable={false}
              />

              <ModernInput
                label={t('Amount')}
                required
                prefix="₹"
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                containerStyle={{ marginTop: spacing.md }}
              />

              <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>
                {t('Payment Method')}
              </Text>
              <QuickChipGroup
                options={PAYMENT_METHOD_OPTIONS.map((opt) => ({
                  ...opt,
                  label: t(opt.label),
                }))}
                selectedValue={payMethod}
                onSelect={(val) => setPayMethod(val)}
                size="sm"
              />

              <SearchableSelect
                label={t('Given By')}
                placeholder={t('Select')}
                searchPlaceholder={t('Search staff...')}
                items={owners.map((o) => ({
                  value: o.id,
                  label: o.name,
                  sublabel: o.roles[0]?.label,
                  icon: 'person-outline',
                }))}
                value={payGivenBy}
                onSelect={(val) => setPayGivenBy(val as number)}
                containerStyle={{ marginTop: spacing.md }}
              />

              <ModernDatePicker
                label={t('Date')}
                value={payDate}
                onChange={setPayDate}
                containerStyle={{ marginTop: spacing.md }}
              />

              <ModernInput
                label={t('Notes')}
                placeholder={t('Reference details, transaction ID...')}
                value={payNotes}
                onChangeText={setPayNotes}
                multiline
                numberOfLines={3}
                containerStyle={{ marginTop: spacing.md }}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setEditModalVisible(false)}
                  disabled={savingEdit}
                >
                  <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleUpdatePayment}
                  disabled={savingEdit}
                >
                  {savingEdit ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>{t('Save')}</Text>
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
    color: colors.slate500,
    fontWeight: '600',
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
    color: colors.slate800,
    marginTop: 12,
  },
  backBtn: {
    marginTop: spacing.md,
    backgroundColor: '#166534',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  backBtnText: {
    color: colors.white,
    fontWeight: '700',
  },

  // Navbar - PWA Parity
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  navBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navbarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  navEditBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.12)',
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navPlaceholder: {
    width: 38,
    height: 38,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 36,
    gap: 16,
  },

  // Card Base - PWA Parity
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  // Card 1: Summary Card
  summaryPadding: {
    padding: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#7c7a67',
    textTransform: 'uppercase',
  },
  summaryAmount: {
    marginTop: 6,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
    color: '#111827',
  },
  cycleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  cycleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#4b5563',
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Card 2: Staff Member
  staffContainer: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  staffAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#166534',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  staffAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 29,
  },
  staffAvatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  staffDetails: {
    flex: 1,
  },
  staffNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  staffName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  staffRole: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  staffEmail: {
    marginTop: 2,
    fontSize: 13,
    color: '#4b5563',
  },
  staffFarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  staffFarmText: {
    fontSize: 13,
    color: '#4b5563',
  },
  staffNote: {
    marginTop: 6,
    fontSize: 12,
    fontStyle: 'italic',
    color: '#8b8b7b',
  },

  // Card 3: Transaction Details
  sectionHead: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeadTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#2d3327',
    textTransform: 'uppercase',
  },
  sectionBody: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailKey: {
    fontSize: 14,
    color: '#20242a',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
  },
  detailValueAmount: {
    fontSize: 17,
    fontWeight: '900',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  notesContainer: {
    marginTop: 14,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#1f6b35',
    borderRadius: 10,
    backgroundColor: '#f9fafb',
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#4b5563',
    textTransform: 'uppercase',
  },
  notesBody: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    color: '#111827',
  },

  // PWA Actions
  actionsContainer: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 4,
  },
  primaryActionBtn: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    backgroundColor: '#14532d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#14532d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  dangerActionBtn: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dangerActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#dc2626',
  },
  backLinkContainer: {
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 20,
    paddingVertical: 6,
  },
  backLinkText: {
    fontSize: 14,
    color: '#44403c',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },

  // Modal
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
    backgroundColor: '#14532d',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
