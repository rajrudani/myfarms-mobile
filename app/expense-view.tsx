import React, { useState, useEffect, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { expensesApi } from '../src/api/expenses';
import { FarmExpense } from '../src/types';
import { extractErrorMessage } from '../src/api/client';
import { colors, radius, spacing, shadows } from '../src/theme/tokens';

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
const PAYMENT_STATUSES = [
  { key: 'PAID', label: 'Paid', bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  { key: 'UNPAID', label: 'Pending', bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  { key: 'PARTIALLY_PAID', label: 'Partial', bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
];

export default function ExpenseViewScreen() {
  const params = useLocalSearchParams();
  const expenseIdentifier = (params.expense_ulid as string) || (params.expense_id as string);

  const [expense, setExpense] = useState<FarmExpense | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editCategory, setEditCategory] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('Cash');
  const [editPaymentStatus, setEditPaymentStatus] = useState('PAID');
  const [editDate, setEditDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchExpense = useCallback(async () => {
    if (!expenseIdentifier) return;
    try {
      const data = await expensesApi.getById(expenseIdentifier);
      setExpense(data);
      setEditCategory(data.expense_category || '');
      setEditAmount(data.amount ? data.amount.toString() : '');
      setEditPaymentMethod(data.payment_method || 'Cash');
      setEditPaymentStatus(data.payment_status || 'PAID');
      setEditDate(data.date ? data.date.split('T')[0] : '');
      setEditNotes(data.notes || '');
    } catch (error) {
      console.error('Error fetching expense:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to load expense details.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [expenseIdentifier]);

  useEffect(() => {
    fetchExpense();
  }, [fetchExpense]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchExpense();
  };

  const handleSaveEdit = async () => {
    if (!expense) return;
    if (!editAmount || isNaN(parseFloat(editAmount))) {
      Alert.alert('Validation Error', 'Please enter a valid expense amount.');
      return;
    }

    const identifier = expense.ulid || expense.id!;
    try {
      setSaving(true);
      const updated = await expensesApi.update(identifier, {
        expense_category: editCategory,
        amount: parseFloat(editAmount),
        payment_method: editPaymentMethod,
        payment_status: editPaymentStatus,
        date: editDate,
        notes: editNotes,
      });
      setExpense(updated);
      setEditModalVisible(false);
      Alert.alert('Success', 'Expense updated successfully!');
    } catch (error) {
      console.error('Error updating expense:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to update expense.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = () => {
    if (!expense) return;
    const identifier = expense.ulid || expense.id!;
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await expensesApi.delete(identifier);
              Alert.alert('Deleted', 'Expense has been deleted.');
              router.back();
            } catch (error) {
              console.error('Error deleting expense:', error);
              Alert.alert('Error', extractErrorMessage(error, 'Failed to delete expense.'));
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading expense details...</Text>
      </View>
    );
  }

  if (!expense) {
    return (
      <View style={styles.centerBox}>
        <Ionicons name="alert-circle-outline" size={48} color="#94a3b8" />
        <Text style={styles.notFoundText}>Expense not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rawStatus = (expense.payment_status || 'PAID').toUpperCase();
  const isPaid = rawStatus === 'PAID' || rawStatus === 'COMPLETED';
  const isPartial = rawStatus === 'PARTIALLY_PAID' || rawStatus === 'PARTIAL';
  const statusConfig = isPaid
    ? PAYMENT_STATUSES[0]
    : isPartial
    ? PAYMENT_STATUSES[2]
    : PAYMENT_STATUSES[1];

  const categoryName = expense.expense_name || expense.expense_category || 'Expense';
  const farmName = expense.farm_name || expense.farm?.name || '-';
  const cycleName = expense.crop_cycle_name || expense.crop_cycle?.season_name || expense.crop_cycle?.crop_type || 'Not linked';
  const linkedActivities = expense.activities || [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Top Sticky Bar */}
      <View style={styles.topStickyBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color="#166534" />
        </TouchableOpacity>

        <Text style={styles.topBarTitle}>Expense Details</Text>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setEditModalVisible(true)}
          activeOpacity={0.7}
          accessibilityLabel="Edit Expense"
        >
          <Ionicons name="create-outline" size={20} color="#166534" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#16a34a']}
            tintColor="#16a34a"
          />
        }
      >
        {/* 1. Summary Card */}
        <View style={styles.card}>
          <View style={styles.summaryTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>EXPENSE CATEGORY</Text>
              <Text style={styles.categoryTitle}>{categoryName}</Text>
              <Text style={styles.amountDisplay}>
                ₹{parseFloat(expense.amount ? expense.amount.toString() : '0').toFixed(2)}
              </Text>
            </View>

            <View style={[styles.statusPill, { backgroundColor: statusConfig.bg, borderColor: statusConfig.border }]}>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.text }]} />
              <Text style={[styles.statusText, { color: statusConfig.text }]}>{statusConfig.label}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.tagsRow}>
            <View style={styles.tag}>
              <Ionicons name="wallet-outline" size={14} color="#166534" />
              <Text style={styles.tagText}>{expense.payment_method || 'Cash'}</Text>
            </View>

            <View style={styles.tag}>
              <Ionicons name="calendar-outline" size={14} color="#64748b" />
              <Text style={styles.tagText}>
                {expense.date ? expense.date.split('T')[0] : 'No date'}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Transaction Details Card */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="receipt-outline" size={18} color="#166534" />
            <Text style={styles.sectionTitle}>Transaction Details</Text>
          </View>

          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Amount</Text>
              <Text style={styles.infoValAmount}>
                ₹{parseFloat(expense.amount ? expense.amount.toString() : '0').toFixed(2)}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Expense Date</Text>
              <Text style={styles.infoVal}>{expense.date ? expense.date.split('T')[0] : '-'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Payment Method</Text>
              <Text style={styles.infoVal}>{expense.payment_method || 'Cash'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Farm</Text>
              <Text style={styles.infoVal}>{farmName}</Text>
            </View>

            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoKey}>Crop Cycle</Text>
              <Text style={styles.infoVal}>{cycleName}</Text>
            </View>
          </View>

          {expense.notes ? (
            <View style={styles.notesWrap}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesContent}>{expense.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* 3. Linked Activities Card */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="clipboard-outline" size={18} color="#166534" />
            <Text style={styles.sectionTitle}>Linked Activities</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{linkedActivities.length}</Text>
            </View>
          </View>

          {linkedActivities.length > 0 ? (
            <View style={styles.activityList}>
              {linkedActivities.map((act: any, idx: number) => (
                <TouchableOpacity
                  key={act.ulid || act.id || idx}
                  style={styles.activityItem}
                  activeOpacity={0.7}
                  onPress={() => router.push({
                    pathname: '/activity-view',
                    params: { activity_id: act.id?.toString(), activity_ulid: act.ulid },
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityItemTitle}>{act.activity_type || 'Farm Activity'}</Text>
                    <Text style={styles.activityItemDate}>{act.date ? act.date.split('T')[0] : ''}</Text>
                  </View>
                  <View style={styles.activityItemRight}>
                    <Text style={styles.activityItemStatus}>{act.status || 'completed'}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No activities have been linked to this expense.</Text>
          )}
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.outlineActionBtn}
            onPress={() => setEditModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={18} color="#166534" />
            <Text style={styles.outlineActionText}>Edit Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dangerActionBtn}
            onPress={handleDeleteExpense}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={18} color="#dc2626" />
            <Text style={styles.dangerActionText}>Delete Expense</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Expense Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Expense</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Category</Text>
              <TextInput
                style={styles.input}
                value={editCategory}
                onChangeText={setEditCategory}
                placeholder="e.g. Fertilizer, Seed, Labor"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Amount (₹)</Text>
              <TextInput
                style={styles.input}
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={editDate}
                onChangeText={setEditDate}
                placeholder="2026-10-24"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Payment Method</Text>
              <View style={styles.chipsRow}>
                {PAYMENT_METHODS.map((method) => {
                  const isSelected = editPaymentMethod === method;
                  return (
                    <TouchableOpacity
                      key={method}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => setEditPaymentMethod(method)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {method}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Payment Status</Text>
              <View style={styles.chipsRow}>
                {PAYMENT_STATUSES.map((st) => {
                  const isSelected = editPaymentStatus === st.key;
                  return (
                    <TouchableOpacity
                      key={st.key}
                      style={[
                        styles.chip,
                        isSelected && { backgroundColor: st.bg, borderColor: st.border },
                      ]}
                      onPress={() => setEditPaymentStatus(st.key)}
                    >
                      <Text style={[styles.chipText, isSelected && { color: st.text, fontWeight: '800' }]}>
                        {st.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Invoice details, vendor name, remarks..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveEdit}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalSaveText}>Save Changes</Text>
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
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  notFoundText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  backBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    backgroundColor: '#16a34a',
  },
  backBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  topStickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    backgroundColor: 'rgba(248, 250, 252, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#14532d',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.15)',
    ...shadows.subtle,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    ...shadows.subtle,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  categoryTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 4,
  },
  amountDisplay: {
    fontSize: 20,
    fontWeight: '900',
    color: '#166534',
    marginTop: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    gap: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  countBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  infoList: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  infoKey: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  infoValAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
  },
  notesWrap: {
    marginTop: 12,
    backgroundColor: '#f8fafc',
    borderLeftWidth: 3,
    borderLeftColor: '#16a34a',
    padding: 12,
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  notesContent: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  activityList: {
    gap: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
  },
  activityItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  activityItemDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  activityItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityItemStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803d',
    textTransform: 'capitalize',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  bottomActions: {
    gap: 10,
    marginTop: 10,
  },
  outlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#166534',
    borderRadius: 12,
    height: 48,
    gap: 8,
  },
  outlineActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
  },
  dangerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    height: 48,
    gap: 8,
  },
  dangerActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#dc2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  chipActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#15803d',
    fontWeight: '800',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  modalSaveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
