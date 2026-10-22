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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { expensesApi } from '../../src/api/expenses';
import { farmsApi } from '../../src/api/farms';
import { cropCyclesApi } from '../../src/api/cropCycles';
import { FarmExpense, Farm, CropCycle } from '../../src/types';
import { useAuth } from '../../src/hooks/useAuth';
import { extractErrorMessage } from '../../src/api/client';
import { colors, radius, spacing, shadows } from '../../src/theme/tokens';
import {
  BentoCard,
  StatusBadge,
  SearchFilterBar,
  QuickChipGroup,
  ChipOption,
} from '../../src/components/ui';

const CATEGORIES = ['Labor', 'Seed', 'Fertilizer', 'Pesticide', 'Equipment', 'Fuel', 'Other'];

const CATEGORY_CHIP_OPTIONS: ChipOption<string>[] = [
  { label: 'All', value: 'all' },
  ...CATEGORIES.map((c) => ({ label: c, value: c })),
];

const STATUS_CHIP_OPTIONS: ChipOption<'PAID' | 'UNPAID' | 'all'>[] = [
  { label: 'All', value: 'all' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Unpaid', value: 'UNPAID' },
];

const PAYMENT_METHODS: ChipOption<string>[] = [
  { label: 'Cash', value: 'Cash' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Bank Transfer', value: 'Bank Transfer' },
  { label: 'Credit / Card', value: 'Credit' },
];

export default function ExpensesScreen() {
  const { isAuthenticated } = useAuth();
  const [expenses, setExpenses] = useState<FarmExpense[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [cycles, setCycles] = useState<CropCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'PAID' | 'UNPAID' | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Log Expense Modal State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [farmId, setFarmId] = useState('');
  const [cropCycleId, setCropCycleId] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseCategory, setExpenseCategory] = useState('Labor');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentStatus, setPaymentStatus] = useState('PAID');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Dropdown visibility states
  const [showFarmDropdown, setShowFarmDropdown] = useState(false);
  const [showCycleDropdown, setShowCycleDropdown] = useState(false);

  // View/Manage Modal State
  const [selectedExpense, setSelectedExpense] = useState<FarmExpense | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit Form State
  const [editFarmId, setEditFarmId] = useState('');
  const [editCropCycleId, setEditCropCycleId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editExpenseCategory, setEditExpenseCategory] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showEditFarmDropdown, setShowEditFarmDropdown] = useState(false);
  const [showEditCycleDropdown, setShowEditCycleDropdown] = useState(false);

  const isPaid = (status?: string) => {
    const s = (status || '').toLowerCase();
    return s === 'paid' || s === 'completed';
  };

  const normalizeStatus = (status?: string): 'PAID' | 'UNPAID' => {
    return isPaid(status) ? 'PAID' : 'UNPAID';
  };

  const fetchData = async () => {
    try {
      const [expenseData, farmData, cycleData] = await Promise.all([
        expensesApi.getAll(),
        farmsApi.getAll(),
        cropCyclesApi.getAll(),
      ]);
      setExpenses(expenseData);
      setFarms(farmData);
      setCycles(cycleData);
    } catch (error: any) {
      console.error('Error fetching expenses data:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to fetch data from server.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCreateExpense = async () => {
    if (!farmId || !amount || !expenseCategory) {
      Alert.alert('Validation Error', 'Farm, Category, and Amount are required.');
      return;
    }

    setSaving(true);
    try {
      const newExpense: FarmExpense = {
        farm_id: farmId,
        crop_cycle_id: cropCycleId ? cropCycleId : null,
        date,
        expense_category: expenseCategory,
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        notes: notes || undefined,
      };

      await expensesApi.create(newExpense);
      Alert.alert('Success', 'Expense recorded successfully!');

      setFarmId('');
      setCropCycleId('');
      setDate(new Date().toISOString().split('T')[0]);
      setExpenseCategory('Labor');
      setAmount('');
      setPaymentMethod('Cash');
      setPaymentStatus('PAID');
      setNotes('');
      setCreateModalVisible(false);

      fetchData();
    } catch (error: any) {
      console.error('Error creating expense:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to record expense.'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateExpense = async () => {
    if (!selectedExpense || (!selectedExpense.id && !selectedExpense.ulid)) return;
    if (!editFarmId || !editAmount || !editExpenseCategory) {
      Alert.alert('Validation Error', 'Farm, Category, and Amount are required.');
      return;
    }

    setUpdating(true);
    const identifier = selectedExpense.ulid || selectedExpense.id!;
    try {
      const updatedExpense: FarmExpense = {
        ...selectedExpense,
        farm_id: editFarmId,
        crop_cycle_id: editCropCycleId ? editCropCycleId : null,
        date: editDate,
        expense_category: editExpenseCategory,
        amount: parseFloat(editAmount),
        payment_method: editPaymentMethod,
        payment_status: editPaymentStatus,
        notes: editNotes || undefined,
      };

      const result = await expensesApi.update(identifier, updatedExpense);
      Alert.alert('Success', 'Expense updated successfully!');
      setIsEditing(false);
      setSelectedExpense(result);
      fetchData();
    } catch (error: any) {
      console.error('Error updating expense:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to update expense.'));
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteExpense = async (expense: FarmExpense) => {
    if (!expense.id && !expense.ulid) return;
    const identifier = expense.ulid || expense.id!;

    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this expense? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await expensesApi.delete(identifier);
              Alert.alert('Success', 'Expense deleted successfully!');
              setDetailModalVisible(false);
              fetchData();
            } catch (error: any) {
              console.error('Error deleting expense:', error);
              Alert.alert('Error', extractErrorMessage(error, 'Failed to delete expense.'));
            }
          },
        },
      ]
    );
  };

  const handleOpenView = (expense: FarmExpense) => {
    setSelectedExpense(expense);
    setEditFarmId(expense.farm_id?.toString() || '');
    setEditCropCycleId(expense.crop_cycle_id?.toString() || '');
    setEditDate(expense.date ? expense.date.split('T')[0] : '');
    setEditExpenseCategory(expense.expense_category || 'Labor');
    setEditAmount(expense.amount?.toString() || '');
    setEditPaymentMethod(expense.payment_method || 'Cash');
    setEditPaymentStatus(normalizeStatus(expense.payment_status));
    setEditNotes(expense.notes || '');
    setIsEditing(false);
    setDetailModalVisible(true);
  };

  const handleOpenManage = (expense: FarmExpense) => {
    setSelectedExpense(expense);
    setEditFarmId(expense.farm_id?.toString() || '');
    setEditCropCycleId(expense.crop_cycle_id?.toString() || '');
    setEditDate(expense.date ? expense.date.split('T')[0] : '');
    setEditExpenseCategory(expense.expense_category || 'Labor');
    setEditAmount(expense.amount?.toString() || '');
    setEditPaymentMethod(expense.payment_method || 'Cash');
    setEditPaymentStatus(normalizeStatus(expense.payment_status));
    setEditNotes(expense.notes || '');
    setIsEditing(true);
    setDetailModalVisible(true);
  };

  const getFilteredExpenses = () => {
    return expenses.filter((exp) => {
      const farmName =
        exp.farm?.name ||
        farms.find((f) => f.ulid === exp.farm_id || f.id === exp.farm_id)?.name ||
        '';
      const cycleName =
        exp.crop_cycle?.crop_name ||
        exp.crop_cycle?.crop_type ||
        cycles.find((c) => c.ulid === exp.crop_cycle_id || c.id === exp.crop_cycle_id)?.crop_name ||
        cycles.find((c) => c.ulid === exp.crop_cycle_id || c.id === exp.crop_cycle_id)?.crop_type ||
        '';

      const matchesSearch =
        exp.expense_category.toLowerCase().includes(search.toLowerCase()) ||
        (exp.notes && exp.notes.toLowerCase().includes(search.toLowerCase())) ||
        farmName.toLowerCase().includes(search.toLowerCase()) ||
        cycleName.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'PAID' && isPaid(exp.payment_status)) ||
        (statusFilter === 'UNPAID' && !isPaid(exp.payment_status));

      const matchesCategory =
        categoryFilter === 'all' || exp.expense_category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  };

  const filteredExpenses = getFilteredExpenses();
  const activeFarms = farms.filter((f) => f.is_active);

  const filteredCycles = cycles.filter(
    (c) => c.status === 'ACTIVE' && c.farm_id?.toString() === farmId?.toString()
  );
  const editFilteredCycles = cycles.filter(
    (c) => c.farm_id?.toString() === editFarmId?.toString()
  );

  const selectedFarmName =
    activeFarms.find((f) => f.ulid === farmId || f.id?.toString() === farmId)?.name ||
    'Select Farm';
  const selectedCycleName = (() => {
    const cy = cycles.find((c) => c.ulid === cropCycleId || c.id?.toString() === cropCycleId);
    return cy
      ? `Crop: ${cy.crop_name || cy.crop_type || 'Unknown Crop'}`
      : 'None / General Farm Expense';
  })();

  const editSelectedFarmName =
    farms.find((f) => f.ulid === editFarmId || f.id?.toString() === editFarmId)?.name ||
    'Select Farm';
  const editSelectedCycleName = (() => {
    const cy = cycles.find((c) => c.ulid === editCropCycleId || c.id?.toString() === editCropCycleId);
    return cy
      ? `Crop: ${cy.crop_name || cy.crop_type || 'Unknown Crop'}`
      : 'None / General Farm Expense';
  })();

  const totalExpenseSum = filteredExpenses.reduce(
    (sum, item) => sum + parseFloat(item.amount as string),
    0
  );

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'labor':
        return 'account-group-outline';
      case 'seed':
        return 'seed-outline';
      case 'fertilizer':
        return 'sprout-outline';
      case 'pesticide':
        return 'shield-bug-outline';
      case 'equipment':
        return 'tractor';
      case 'fuel':
        return 'gas-station-outline';
      default:
        return 'receipt-outline';
    }
  };

  const renderExpenseItem = ({ item }: { item: FarmExpense }) => {
    const farmName =
      item.farm?.name ||
      farms.find((f) => f.ulid === item.farm_id || f.id === item.farm_id)?.name ||
      'General Farm';
    const cycleName =
      item.crop_cycle?.crop_name ||
      item.crop_cycle?.crop_type ||
      cycles.find((c) => c.ulid === item.crop_cycle_id || c.id === item.crop_cycle_id)?.crop_name ||
      cycles.find((c) => c.ulid === item.crop_cycle_id || c.id === item.crop_cycle_id)?.crop_type;

    const paid = isPaid(item.payment_status);

    return (
      <BentoCard variant="elevated" style={styles.expenseCard}>
        <View style={styles.cardHeader}>
          <View style={styles.categoryLeft}>
            <View style={styles.categoryIconBox}>
              <MaterialCommunityIcons
                name={getCategoryIcon(item.expense_category) as any}
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.categoryTitle}>{item.expense_category}</Text>
              <View style={styles.farmLocationRow}>
                <Ionicons name="business-outline" size={12} color={colors.slate500} />
                <Text style={styles.farmName} numberOfLines={1}>
                  {farmName} {cycleName ? `• ${cycleName}` : ''}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.rightCol}>
            <Text style={[styles.amountText, { color: paid ? colors.slate900 : colors.danger }]}>
              ₹{parseFloat(item.amount as string).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
            <StatusBadge
              label={paid ? 'PAID' : 'UNPAID'}
              variant={paid ? 'success' : 'danger'}
              dot={paid}
            />
          </View>
        </View>

        {/* 2 Pills: Method & Date */}
        <View style={styles.pillsRow}>
          <View style={styles.pill}>
            <Ionicons name="card-outline" size={13} color={colors.primary} style={styles.pillIcon} />
            <Text style={styles.pillValue}>{item.payment_method || 'Cash'}</Text>
          </View>

          <View style={styles.pill}>
            <Ionicons name="calendar-outline" size={13} color={colors.slate500} style={styles.pillIcon} />
            <Text style={styles.pillValue}>{item.date ? item.date.split('T')[0] : 'N/A'}</Text>
          </View>
        </View>

        {item.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesText} numberOfLines={2}>
              Note: {item.notes}
            </Text>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtnView}
            onPress={() => handleOpenView(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="eye-outline" size={15} color={colors.slate800} />
            <Text style={styles.actionBtnTextView}>Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnManage}
            onPress={() => handleOpenManage(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={15} color={colors.white} />
            <Text style={styles.actionBtnTextManage}>Edit Expense</Text>
          </TouchableOpacity>
        </View>
      </BentoCard>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading farm expenses...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Sticky Header Panel */}
      <View style={styles.stickyHeader}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerTitle}>Farm Expenses</Text>
            <Text style={styles.headerSubtitle}>Operational disbursements & inputs</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{filteredExpenses.length}</Text>
          </View>
        </View>

        <SearchFilterBar
          query={search}
          onChangeQuery={setSearch}
          placeholder="Search by category, farm, or crop..."
        />

        {/* Status Filter Chips */}
        <View style={styles.chipsRow}>
          <QuickChipGroup
            options={STATUS_CHIP_OPTIONS}
            selectedValue={statusFilter}
            onSelect={(val) => setStatusFilter(val)}
            size="sm"
          />
        </View>

        {/* Category Horizontal Filter Chips */}
        <View style={styles.chipsRow}>
          <QuickChipGroup
            options={CATEGORY_CHIP_OPTIONS}
            selectedValue={categoryFilter}
            onSelect={(val) => setCategoryFilter(val)}
            scrollable
            size="sm"
          />
        </View>
      </View>

      {/* Live Total Spend Bento Banner */}
      <View style={styles.summaryBannerWrap}>
        <BentoCard variant="tinted" style={styles.summaryBanner}>
          <View>
            <Text style={styles.summaryBannerLabel}>TOTAL FILTERED SPEND</Text>
            <Text style={styles.summaryBannerAmount}>
              ₹{totalExpenseSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.summaryCountBox}>
            <Ionicons name="receipt-outline" size={16} color={colors.primary} />
            <Text style={styles.summaryCountText}>
              {filteredExpenses.length} records
            </Text>
          </View>
        </BentoCard>
      </View>

      <FlatList
        data={filteredExpenses}
        keyExtractor={(item, index) => item.ulid || item.id?.toString() || index.toString()}
        renderItem={renderExpenseItem}
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
            <View style={styles.emptyIconCircle}>
              <Ionicons name="receipt-outline" size={32} color={colors.slate400} />
            </View>
            <Text style={styles.emptyText}>No expenses found</Text>
            <Text style={styles.emptySubtext}>
              Try adjusting your category filter or tap "+" to record a new expense.
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.floatingActionBtn}
        onPress={() => setCreateModalVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Record Expense Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={createModalVisible}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Record Farm Expense</Text>
                <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.slate600} />
                </TouchableOpacity>
              </View>

              {/* Farm Selector */}
              <Text style={styles.inputLabel}>
                Associate Farm <Text style={{ color: colors.danger }}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setShowFarmDropdown(!showFarmDropdown)}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownTriggerText}>{selectedFarmName}</Text>
                <Ionicons
                  name={showFarmDropdown ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.slate500}
                />
              </TouchableOpacity>

              {showFarmDropdown && (
                <View style={styles.dropdownList}>
                  {activeFarms.map((f) => (
                    <TouchableOpacity
                      key={f.ulid || f.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFarmId((f.ulid || f.id!).toString());
                        setCropCycleId('');
                        setShowFarmDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{f.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Crop Cycle Selector (Optional) */}
              <Text style={[styles.inputLabel, { marginTop: spacing.sm }]}>
                Crop Cycle (Optional)
              </Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setShowCycleDropdown(!showCycleDropdown)}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownTriggerText}>{selectedCycleName}</Text>
                <Ionicons
                  name={showCycleDropdown ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.slate500}
                />
              </TouchableOpacity>

              {showCycleDropdown && (
                <View style={styles.dropdownList}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setCropCycleId('');
                      setShowCycleDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>None / General Farm Expense</Text>
                  </TouchableOpacity>
                  {filteredCycles.map((c) => (
                    <TouchableOpacity
                      key={c.ulid || c.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setCropCycleId((c.ulid || c.id!).toString());
                        setShowCycleDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>
                        {c.crop_name || c.crop_type} ({c.season_name || 'Current'})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={[styles.inputLabel, { marginTop: spacing.sm }]}>
                Expense Category <Text style={{ color: colors.danger }}>*</Text>
              </Text>
              <QuickChipGroup
                options={CATEGORIES.map((c) => ({ label: c, value: c }))}
                selectedValue={expenseCategory}
                onSelect={(val) => setExpenseCategory(val)}
                scrollable
                size="sm"
              />

              <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>
                Amount (₹) <Text style={{ color: colors.danger }}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2500"
                placeholderTextColor={colors.slate400}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={styles.inputLabel}>Payment Method</Text>
              <QuickChipGroup
                options={PAYMENT_METHODS}
                selectedValue={paymentMethod}
                onSelect={(val) => setPaymentMethod(val)}
                size="sm"
              />

              <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Payment Status</Text>
              <QuickChipGroup
                options={[
                  { label: 'Paid', value: 'PAID' },
                  { label: 'Unpaid', value: 'UNPAID' },
                ]}
                selectedValue={paymentStatus}
                onSelect={(val) => setPaymentStatus(val)}
                size="sm"
              />

              <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.slate400}
                value={date}
                onChangeText={setDate}
              />

              <Text style={styles.inputLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Receipt details, vendor info..."
                placeholderTextColor={colors.slate400}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setCreateModalVisible(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleCreateExpense}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Record Expense</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* View & Edit Expense Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {isEditing ? 'Edit Expense Record' : 'Expense Details'}
                </Text>
                <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.slate600} />
                </TouchableOpacity>
              </View>

              {isEditing ? (
                <View>
                  <Text style={styles.inputLabel}>Associate Farm</Text>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setShowEditFarmDropdown(!showEditFarmDropdown)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dropdownTriggerText}>{editSelectedFarmName}</Text>
                    <Ionicons
                      name={showEditFarmDropdown ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.slate500}
                    />
                  </TouchableOpacity>

                  {showEditFarmDropdown && (
                    <View style={styles.dropdownList}>
                      {farms.map((f) => (
                        <TouchableOpacity
                          key={f.ulid || f.id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setEditFarmId((f.ulid || f.id!).toString());
                            setEditCropCycleId('');
                            setShowEditFarmDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{f.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={[styles.inputLabel, { marginTop: spacing.sm }]}>Crop Cycle</Text>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setShowEditCycleDropdown(!showEditCycleDropdown)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dropdownTriggerText}>{editSelectedCycleName}</Text>
                    <Ionicons
                      name={showEditCycleDropdown ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.slate500}
                    />
                  </TouchableOpacity>

                  {showEditCycleDropdown && (
                    <View style={styles.dropdownList}>
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setEditCropCycleId('');
                          setShowEditCycleDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>None / General Farm Expense</Text>
                      </TouchableOpacity>
                      {editFilteredCycles.map((c) => (
                        <TouchableOpacity
                          key={c.ulid || c.id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setEditCropCycleId((c.ulid || c.id!).toString());
                            setShowEditCycleDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>
                            {c.crop_name || c.crop_type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={[styles.inputLabel, { marginTop: spacing.sm }]}>
                    Expense Category
                  </Text>
                  <QuickChipGroup
                    options={CATEGORIES.map((c) => ({ label: c, value: c }))}
                    selectedValue={editExpenseCategory}
                    onSelect={(val) => setEditExpenseCategory(val)}
                    scrollable
                    size="sm"
                  />

                  <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Amount (₹)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={editAmount}
                    onChangeText={setEditAmount}
                  />

                  <Text style={styles.inputLabel}>Payment Method</Text>
                  <QuickChipGroup
                    options={PAYMENT_METHODS}
                    selectedValue={editPaymentMethod}
                    onSelect={(val) => setEditPaymentMethod(val)}
                    size="sm"
                  />

                  <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Payment Status</Text>
                  <QuickChipGroup
                    options={[
                      { label: 'Paid', value: 'PAID' },
                      { label: 'Unpaid', value: 'UNPAID' },
                    ]}
                    selectedValue={editPaymentStatus}
                    onSelect={(val) => setEditPaymentStatus(val)}
                    size="sm"
                  />

                  <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Date</Text>
                  <TextInput
                    style={styles.input}
                    value={editDate}
                    onChangeText={setEditDate}
                  />

                  <Text style={styles.inputLabel}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={editNotes}
                    onChangeText={setEditNotes}
                    multiline
                    numberOfLines={3}
                  />

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.cancelBtn]}
                      onPress={() => setIsEditing(false)}
                      disabled={updating}
                    >
                      <Text style={styles.cancelBtnText}>Back to View</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalBtn, styles.saveBtn]}
                      onPress={handleUpdateExpense}
                      disabled={updating}
                    >
                      {updating ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={styles.saveBtnText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.detailsView}>
                  <View style={styles.detailCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Category:</Text>
                      <Text style={styles.detailValue}>
                        {selectedExpense?.expense_category}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Amount:</Text>
                      <Text style={[styles.detailValue, { color: colors.primary, fontSize: 16 }]}>
                        ₹{parseFloat(selectedExpense?.amount as string || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status:</Text>
                      <StatusBadge
                        label={isPaid(selectedExpense?.payment_status) ? 'PAID' : 'UNPAID'}
                        variant={isPaid(selectedExpense?.payment_status) ? 'success' : 'danger'}
                        dot={isPaid(selectedExpense?.payment_status)}
                      />
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Farm:</Text>
                      <Text style={styles.detailValue}>
                        {farms.find(
                          (f) =>
                            f.ulid === selectedExpense?.farm_id || f.id === selectedExpense?.farm_id
                        )?.name || 'General Farm'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Payment Method:</Text>
                      <Text style={styles.detailValue}>
                        {selectedExpense?.payment_method}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Date:</Text>
                      <Text style={styles.detailValue}>
                        {selectedExpense?.date ? selectedExpense.date.split('T')[0] : 'N/A'}
                      </Text>
                    </View>

                    {selectedExpense?.notes ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.detailLabel, { marginBottom: 4 }]}>Notes:</Text>
                        <Text style={[styles.detailValue, { fontWeight: 'normal', color: colors.slate600 }]}>
                          {selectedExpense.notes}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={[styles.modalActions, { gap: 10 }]}>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.deleteBtn]}
                      onPress={() => selectedExpense && handleDeleteExpense(selectedExpense)}
                    >
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.saveBtn]}
                      onPress={() => selectedExpense && setIsEditing(true)}
                    >
                      <Text style={styles.saveBtnText}>Edit Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
  stickyHeader: {
    backgroundColor: colors.white,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 12,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    gap: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.slate900,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.slate500,
    marginTop: 2,
  },
  headerBadge: {
    minWidth: 32,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  chipsRow: {
    marginTop: 2,
  },
  summaryBannerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  summaryBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  summaryBannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.8,
  },
  summaryBannerAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
    marginTop: 2,
  },
  summaryCountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  summaryCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate700,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 90,
    gap: spacing.md,
  },
  expenseCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  categoryLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 10,
  },
  categoryIconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
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
  farmName: {
    fontSize: 12,
    color: colors.slate500,
    fontWeight: '500',
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  pillIcon: {
    marginRight: 4,
  },
  pillValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate800,
  },
  notesBox: {
    backgroundColor: colors.slate50,
    borderRadius: radius.xs,
    padding: 8,
    marginTop: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  notesText: {
    fontSize: 12,
    color: colors.slate600,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: 10,
  },
  actionBtnView: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.slate100,
    gap: 6,
  },
  actionBtnManage: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    gap: 6,
  },
  actionBtnTextView: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate800,
  },
  actionBtnTextManage: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate800,
    marginTop: 14,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.slate500,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 30,
  },
  floatingActionBtn: {
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
  deleteBtn: {
    backgroundColor: colors.dangerSurface,
  },
  deleteBtnText: {
    color: colors.dangerText,
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
  detailsView: {
    width: '100%',
  },
  detailCard: {
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    marginBottom: spacing.md,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate500,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
});
