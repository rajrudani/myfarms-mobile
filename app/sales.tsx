import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { salesApi } from '../src/api/sales';
import { farmsApi } from '../src/api/farms';
import { cropCyclesApi } from '../src/api/cropCycles';
import { mastersApi } from '../src/api/masters';
import { Sale, Farm, CropCycle, CreateSalePayload, Buyer, SaleGradeItem } from '../src/types';
import { extractErrorMessage } from '../src/api/client';
import { useAuth } from '../src/hooks/useAuth';
import { permissions } from '../src/utils/permissions';
import { AttachmentPicker } from '../src/components/AttachmentPicker';
import { BentoCard, MetricTile, StatusBadge, QuickChipGroup, SearchFilterBar, SearchableSelect, ModernDatePicker, ModernInput, EmptyState, ConfirmModal, ModalSheet } from '../src/components/ui';
import { colors, spacing, radius, typography, shadows } from '../src/theme/tokens';
import { useTranslation } from '../src/i18n/I18nContext';
import { useToast } from '../src/context/ToastContext';

const COMMON_UNITS = ['BAG', 'KG', 'QUINTAL', 'TON', 'CRATE'];

export default function SalesScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  // Confirm delete modal state
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);

  const GRADE_OPTIONS = [
    { label: t('Grade A+'), value: 'a_plus' },
    { label: t('Grade A'), value: 'a' },
    { label: t('Grade B+'), value: 'b_plus' },
    { label: t('Grade B'), value: 'b' },
    { label: t('Grade C+'), value: 'c_plus' },
    { label: t('Grade C'), value: 'c' },
    { label: t('Grade D'), value: 'd' },
  ];
  const [sales, setSales] = useState<Sale[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [cropCycles, setCropCycles] = useState<CropCycle[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string | number>('all');
  const [farmFilterModalVisible, setFarmFilterModalVisible] = useState(false);

  // Modal Triggers
  const [saleModalVisible, setSaleModalVisible] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  // Form Fields
  const [farmId, setFarmId] = useState<string | number>('');
  const [cropCycleId, setCropCycleId] = useState<string | number>('');
  const [buyerId, setBuyerId] = useState<string | number>('');
  const [buyerName, setBuyerName] = useState('');
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [saleDate, setSaleDate] = useState('');
  const [hasGrades, setHasGrades] = useState(false);
  const [grades, setGrades] = useState<{ grade_name: string; quantity: string; rate: string }[]>([]);
  const [totalQuantity, setTotalQuantity] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('BAG');
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  const [charges, setCharges] = useState<{
    charge_name: string;
    type: 'flat' | 'percentage';
    value: string;
    applies_on: 'gross' | 'final';
  }[]>([]);
  const [billPhotoPath, setBillPhotoPath] = useState<string | null>(null);
  const [billPhotoUrl, setBillPhotoUrl] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // Quick Add Buyer Modal State
  const [addBuyerModalVisible, setAddBuyerModalVisible] = useState(false);
  const [newBuyerName, setNewBuyerName] = useState('');
  const [newBuyerPhone, setNewBuyerPhone] = useState('');
  const [newBuyerCompany, setNewBuyerCompany] = useState('');
  const [newBuyerAddress, setNewBuyerAddress] = useState('');
  const [newBuyerNotes, setNewBuyerNotes] = useState('');
  const [savingBuyer, setSavingBuyer] = useState(false);

  // Initial load
  const loadMasterData = async () => {
    try {
      const [farmsData, cyclesData, buyersData] = await Promise.all([
        farmsApi.getAll(),
        cropCyclesApi.getAll(),
        mastersApi.getBuyers({ status: 'active' }),
      ]);
      setFarms(farmsData);
      setCropCycles(cyclesData);
      setBuyers(buyersData);
    } catch (error) {
      console.error('Error fetching master data:', error);
    }
  };

  const fetchSales = useCallback(
    async (showIndicator = true) => {
      if (showIndicator) setLoading(true);
      try {
        const data = await salesApi.getSales({
          search: search || undefined,
          farm_id: selectedFarmFilter === 'all' ? undefined : selectedFarmFilter,
        });
        setSales(data);
      } catch (error) {
        console.error('Error fetching sales:', error);
        Alert.alert('Error', extractErrorMessage(error, 'Failed to load sales.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, selectedFarmFilter]
  );

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    fetchSales(true);
  }, [fetchSales]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSales(false);
  };

  // Open Record Sale Modal
  const openRecordModal = () => {
    setEditingSale(null);
    setFarmId(farms.length > 0 ? farms[0].id || '' : '');
    setCropCycleId('');
    const firstBuyer = buyers.length > 0 ? buyers[0] : null;
    setBuyerId(firstBuyer ? (firstBuyer.ulid || firstBuyer.id).toString() : '');
    setBuyerName(firstBuyer ? firstBuyer.name : '');
    setSaleDate(new Date().toISOString().split('T')[0]);
    setHasGrades(false);
    setGrades([]);
    setTotalQuantity('');
    setQuantityUnit('BAG');
    setRate('');
    setNotes('');
    setCharges([]);
    setBillPhotoPath(null);
    setBillPhotoUrl(null);
    setSaleModalVisible(true);
  };

  // Open Edit Sale Modal
  const openEditModal = (sale: Sale) => {
    setEditingSale(sale);
    setFarmId(sale.farm_id);
    setCropCycleId(sale.crop_cycle_id);
    setBuyerId(sale.buyer_id ? sale.buyer_id.toString() : '');
    setBuyerName(sale.buyer_name || '');
    setSaleDate(sale.date);
    setHasGrades(Boolean(sale.has_grades));
    if (sale.grades && sale.grades.length > 0) {
      setGrades(
        sale.grades.map((g) => ({
          grade_name: g.grade_name,
          quantity: g.quantity.toString(),
          rate: g.rate.toString(),
        }))
      );
    } else {
      setGrades([]);
    }
    setTotalQuantity(sale.total_quantity?.toString() || '');
    setQuantityUnit(sale.quantity_unit || 'BAG');
    setRate(sale.rate?.toString() || '');
    setNotes(sale.notes || '');
    setBillPhotoPath(sale.bill_photo_path || null);
    setBillPhotoUrl(sale.bill_photo_url || null);
    if (sale.charges && sale.charges.length > 0) {
      setCharges(
        sale.charges.map((c) => ({
          charge_name: c.charge_name,
          type: (c.type === 'percentage' ? 'percentage' : 'flat') as 'flat' | 'percentage',
          value: c.value.toString(),
          applies_on: (c.applies_on === 'final' ? 'final' : 'gross') as 'gross' | 'final',
        }))
      );
    } else {
      setCharges([]);
    }
    setSaleModalVisible(true);
  };

  // Create Quick Buyer
  const handleCreateQuickBuyer = async () => {
    if (!newBuyerName.trim()) {
      Alert.alert('Validation Error', 'Buyer name is required.');
      return;
    }
    setSavingBuyer(true);
    try {
      const created = await mastersApi.createBuyer({
        name: newBuyerName.trim(),
        phone: newBuyerPhone.trim() || null,
        company_name: newBuyerCompany.trim() || null,
        address: newBuyerAddress.trim() || null,
        notes: newBuyerNotes.trim() || null,
        is_active: true,
      });
      setBuyers((prev) => [created, ...prev]);
      setBuyerId((created.ulid || created.id).toString());
      setBuyerName(created.name);
      setAddBuyerModalVisible(false);
      setNewBuyerName('');
      setNewBuyerPhone('');
      setNewBuyerCompany('');
      setNewBuyerAddress('');
      setNewBuyerNotes('');
      showToast(t('Buyer created and selected.'), { type: 'success' });
    } catch (error) {
      console.error('Error creating buyer:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to create buyer.'));
    } finally {
      setSavingBuyer(false);
    }
  };

  // Grades handlers
  const handleAddGradeLine = () => {
    setGrades([...grades, { grade_name: 'a', quantity: '', rate: '' }]);
  };

  const handleRemoveGradeLine = (index: number) => {
    setGrades(grades.filter((_, idx) => idx !== index));
  };

  const handleUpdateGradeField = (index: number, field: string, val: string) => {
    const updated = [...grades];
    updated[index] = { ...updated[index], [field]: val };
    setGrades(updated);
  };

  const gradesTotalQty = useMemo(() => {
    return grades.reduce((sum, g) => sum + (parseFloat(g.quantity) || 0), 0);
  }, [grades]);

  const gradesGross = useMemo(() => {
    return grades.reduce(
      (sum, g) => sum + (parseFloat(g.quantity) || 0) * (parseFloat(g.rate) || 0),
      0
    );
  }, [grades]);

  // Save Sale
  const handleSaveSale = async () => {
    if (!farmId || !cropCycleId || (!buyerId && !buyerName.trim()) || !saleDate.trim()) {
      Alert.alert('Validation Error', 'Farm, Crop Cycle, Buyer, and Sale Date are required.');
      return;
    }

    if (hasGrades) {
      if (grades.length === 0) {
        Alert.alert('Validation Error', 'Please add at least one grade row.');
        return;
      }
      for (let i = 0; i < grades.length; i++) {
        const g = grades[i];
        if (!g.quantity || isNaN(parseFloat(g.quantity)) || parseFloat(g.quantity) <= 0) {
          Alert.alert('Validation Error', `Grade row #${i + 1} has an invalid quantity.`);
          return;
        }
        if (!g.rate || isNaN(parseFloat(g.rate)) || parseFloat(g.rate) <= 0) {
          Alert.alert('Validation Error', `Grade row #${i + 1} has an invalid rate.`);
          return;
        }
      }
    } else {
      if (!totalQuantity || isNaN(parseFloat(totalQuantity)) || parseFloat(totalQuantity) <= 0) {
        Alert.alert('Validation Error', 'Please enter a valid positive quantity.');
        return;
      }
      if (!rate || isNaN(parseFloat(rate)) || parseFloat(rate) <= 0) {
        Alert.alert('Validation Error', 'Please enter a valid positive rate.');
        return;
      }
    }

    const selectedCycle = cropCycles.find(
      (c) => (c.ulid || c.id)?.toString() === cropCycleId.toString()
    );
    const cropIdToUse = selectedCycle?.crop_id;

    const chosenBuyerName =
      buyerName ||
      buyers.find((b) => (b.ulid || b.id)?.toString() === buyerId?.toString())?.name ||
      'Direct Buyer';

    const payload: CreateSalePayload = {
      farm_id: farmId,
      crop_cycle_id: cropCycleId,
      crop_id: cropIdToUse,
      buyer_id: buyerId || undefined,
      buyer_name: chosenBuyerName,
      date: saleDate,
      has_grades: hasGrades,
      total_quantity: hasGrades ? gradesTotalQty : parseFloat(totalQuantity),
      quantity_unit: quantityUnit,
      rate: hasGrades ? (gradesTotalQty > 0 ? gradesGross / gradesTotalQty : 0) : parseFloat(rate),
      notes: notes || undefined,
      bill_photo_path: billPhotoPath,
      grades: hasGrades
        ? grades.map((g) => ({
            grade_name: g.grade_name,
            quantity: parseFloat(g.quantity),
            rate: parseFloat(g.rate),
            amount: (parseFloat(g.quantity) || 0) * (parseFloat(g.rate) || 0),
          }))
        : undefined,
      charges: charges
        .filter((c) => c.charge_name.trim() && !isNaN(parseFloat(c.value)))
        .map((c) => ({
          charge_name: c.charge_name.trim(),
          type: c.type,
          value: parseFloat(c.value),
          applies_on: c.applies_on,
        })),
    };

    try {
      if (editingSale) {
        await salesApi.updateSale(editingSale.id, payload);
        showToast(t('Sale updated successfully.'), { type: 'success' });
      } else {
        await salesApi.createSale(payload);
        showToast(t('Sale recorded successfully.'), { type: 'success' });
      }
      setSaleModalVisible(false);
      fetchSales(false);
    } catch (error) {
      console.error('Error saving sale:', error);
      Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to save sale.')));
    }
  };

  // Delete Sale
  const handleDeleteSale = (sale: Sale) => {
    setSaleToDelete(sale);
    setDeleteConfirmVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!saleToDelete) return;
    try {
      setDeleting(true);
      await salesApi.deleteSale(saleToDelete.id);
      showToast(t('Sale deleted successfully.'), { type: 'success' });
      setDeleteConfirmVisible(false);
      setSaleToDelete(null);
      fetchSales(false);
    } catch (error) {
      console.error('Error deleting sale:', error);
      Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to delete sale.')));
    } finally {
      setDeleting(false);
    }
  };

  // Filtered crop cycles for the modal
  const filteredModalCropCycles = useMemo(() => {
    if (!farmId) return [];
    return cropCycles.filter((c) => c.farm_id.toString() === farmId.toString());
  }, [farmId, cropCycles]);

  const handleAddChargeLine = () => {
    setCharges([
      ...charges,
      { charge_name: '', type: 'flat', value: '', applies_on: 'gross' },
    ]);
  };

  const handleRemoveChargeLine = (index: number) => {
    setCharges(charges.filter((_, i) => i !== index));
  };

  const handleUpdateChargeField = (index: number, field: string, val: any) => {
    const updated = [...charges];
    updated[index] = { ...updated[index], [field]: val };
    setCharges(updated);
  };

  const calcGross = hasGrades
    ? gradesGross
    : (parseFloat(totalQuantity) || 0) * (parseFloat(rate) || 0);
  const calcCharges = charges.reduce((acc, c) => {
    const val = parseFloat(c.value) || 0;
    if (c.type === 'percentage') {
      return acc + (calcGross * val) / 100;
    }
    return acc + val;
  }, 0);
  const calcFinal = Math.max(0, calcGross - calcCharges);

  // Accessible farms for user
  const accessibleFarms = useMemo(() => {
    return farms.filter((f) => permissions.canAccessFarm(user, f.id));
  }, [farms, user]);

  // Accessible sales for user
  const accessibleSales = useMemo(() => {
    return sales.filter((s) => permissions.canAccessFarm(user, s.farm_id));
  }, [sales, user]);

  // Overall summary metrics across currently accessible sales
  const salesSummary = useMemo(() => {
    const gross = accessibleSales.reduce((acc, s) => acc + (parseFloat(s.gross_total as any) || 0), 0);
    const deductions = accessibleSales.reduce((acc, s) => acc + (parseFloat(s.charges_total as any) || 0), 0);
    const net = accessibleSales.reduce((acc, s) => acc + (parseFloat(s.final_amount as any) || 0), 0);
    return { gross, deductions, net };
  }, [accessibleSales]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={colors.slate700} />
          </TouchableOpacity>
          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>{t('Sales')}</Text>
            <Text style={styles.headerSubtitle}>{t('Manage sales and track revenue with ease.')}</Text>
          </View>
        </View>
      </View>

      {/* Search & Farm Filter Bar */}
      <View style={styles.filterSection}>
        <SearchFilterBar
          query={search}
          onChangeQuery={setSearch}
          placeholder={t('Search sales...')}
          hasFilter
          isFilterActive={selectedFarmFilter !== 'all'}
          activeFilterCount={selectedFarmFilter !== 'all' ? 1 : 0}
          onToggleFilter={() => setFarmFilterModalVisible(true)}
        />
      </View>

      {/* Sales List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('Loading sales invoices...')}</Text>
        </View>
      ) : (
        <FlatList
          data={accessibleSales}
          keyExtractor={(item) => item.ulid}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.listHeaderComponent}>
              {permissions.canViewFinancials(user) && (
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryTile}>
                    <MetricTile
                      label={t('GROSS SALES')}
                      value={`₹${salesSummary.gross.toFixed(0)}`}
                      iconName="trending-up"
                      iconColor={colors.slate700}
                      iconBg={colors.slate100}
                    />
                  </View>
                  <View style={styles.summaryTile}>
                    <MetricTile
                      label={t('DEDUCTIONS')}
                      value={`-₹${salesSummary.deductions.toFixed(0)}`}
                      iconName="tag-outline"
                      iconColor={colors.dangerText}
                      iconBg={colors.dangerSurface}
                    />
                  </View>
                  <View style={styles.summaryTile}>
                    <MetricTile
                      label={t('NET REALIZED')}
                      value={`₹${salesSummary.net.toFixed(0)}`}
                      iconName="cash-multiple"
                      iconColor={colors.successText}
                      iconBg={colors.successSurface}
                    />
                  </View>
                </View>
              )}
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="trending-up-outline"
              title={t('No Sales Recorded')}
              message={
                search || selectedFarmFilter !== 'all'
                  ? t('No sales match your current search or farm filter.')
                  : t('Log produce sales with buyers, weight receipts, and mandi prices.')
              }
              actionLabel={
                permissions.canManageCommercials(user) && !search && selectedFarmFilter === 'all'
                  ? t('+ Record First Sale')
                  : undefined
              }
              onAction={() => setSaleModalVisible(true)}
              secondaryActionLabel={
                search || selectedFarmFilter !== 'all'
                  ? 'Clear Filters'
                  : undefined
              }
              onSecondaryAction={() => {
                setSearch('');
                setSelectedFarmFilter('all');
              }}
            />
          }
          renderItem={({ item }) => {
            const dateStr = new Date(item.date).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <BentoCard
                variant="elevated"
                style={styles.saleCard}
                onPress={() =>
                  router.push({
                    pathname: '/sale-view',
                    params: { sale_ulid: item.ulid, sale_id: item.id },
                  })
                }
              >
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.buyerNameText}>{item.buyer_name}</Text>
                    <View style={styles.dateRow}>
                      <Ionicons name="calendar-outline" size={13} color={colors.slate500} />
                      <Text style={styles.cardDateText}>{dateStr}</Text>
                    </View>
                  </View>
                  <View style={styles.saleIdBadge}>
                    <Text style={styles.saleIdText}>#SALE-{item.id}</Text>
                  </View>
                </View>

                {/* Badges Row */}
                <View style={styles.badgesWrapper}>
                  <StatusBadge
                    label={item.crop?.name || t('Crop')}
                    variant="purple"
                  />
                  <StatusBadge
                    label={item.farm?.name || t('Farm')}
                    variant="neutral"
                  />
                  {item.has_grades ? (
                    <StatusBadge
                      label={`${t('Graded')} (${item.grades?.length || 0})`}
                      variant="warning"
                    />
                  ) : null}
                </View>

                {/* Quantity & Rate Grid */}
                <View style={styles.detailsGrid}>
                  <View style={styles.gridCell}>
                    <Text style={styles.gridLabel}>{t('QUANTITY')}</Text>
                    <Text style={styles.gridVal}>
                      {item.total_quantity} {item.quantity_unit}
                    </Text>
                  </View>
                  <View style={styles.gridDivider} />
                  <View style={styles.gridCell}>
                    <Text style={styles.gridLabel}>{t('UNIT RATE')}</Text>
                    <Text style={styles.gridVal}>
                      {permissions.canViewFinancials(user) ? `₹${item.rate} / ${item.quantity_unit}` : '—'}
                    </Text>
                  </View>
                </View>

                {/* Deductions if any */}
                {item.charges && item.charges.length > 0 && permissions.canViewFinancials(user) ? (
                  <View style={styles.chargesWrapper}>
                    {item.charges.map((c, idx) => (
                      <View key={c.id || idx} style={styles.chargeBadge}>
                        <Ionicons name="remove-circle-outline" size={12} color={colors.danger} />
                        <Text style={styles.chargeBadgeText}>
                          {c.charge_name}: -₹{c.value}
                          {c.type === 'percentage' ? '%' : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Attached Bill / Slip */}
                {item.bill_photo_url ? (
                  <TouchableOpacity
                    style={styles.attachmentBadge}
                    onPress={() => setPreviewModalUrl(item.bill_photo_url || null)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="receipt-outline" size={14} color={colors.primary} />
                    <Text style={styles.attachmentBadgeText}>{t('View Weighment Slip')}</Text>
                    <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                  </TouchableOpacity>
                ) : null}

                {/* Notes */}
                {item.notes ? (
                  <View style={styles.notesBox}>
                    <Ionicons name="chatbubble-ellipses-outline" size={13} color={colors.slate500} />
                    <Text style={styles.notesText}>{item.notes}</Text>
                  </View>
                ) : null}

                {/* Footer amounts & View action */}
                <View style={styles.cardFooter}>
                  {permissions.canViewFinancials(user) ? (
                    <View style={styles.amountsRow}>
                      <View style={styles.amountBlock}>
                        <Text style={styles.amountLabel}>{t('Gross')}</Text>
                        <Text style={styles.amountVal}>₹{item.gross_total}</Text>
                      </View>
                      <View style={styles.finalAmountBlock}>
                        <Text style={styles.amountLabel}>{t('Final')}</Text>
                        <Text style={styles.finalVal}>₹{item.final_amount}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.amountsRow} />
                  )}

                  <View style={styles.actionsGroup}>
                    <TouchableOpacity
                      style={styles.salesCardViewBtn}
                      onPress={() =>
                        router.push({
                          pathname: '/sale-view',
                          params: { sale_ulid: item.ulid, sale_id: item.id },
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={styles.salesCardViewText}>{t('VIEW')}</Text>
                      <Ionicons name="chevron-forward" size={14} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                </View>
              </BentoCard>
            );
          }}
        />
      )}

      {/* Futuristic FAB */}
      {permissions.canManageCommercials(user) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={openRecordModal}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      )}

      {/* Record/Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={saleModalVisible}
        onRequestClose={() => setSaleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalKicker}>{t('PRODUCE DISPATCH')}</Text>
                <Text style={styles.modalTitle}>
                  {editingSale ? t('Edit Sale Entry') : t('Record Produce Sale')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSaleModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <ModernDatePicker
                label="Sale Date"
                required
                value={saleDate}
                onChange={setSaleDate}
                containerStyle={{ marginBottom: spacing.md }}
              />

              <SearchableSelect
                label="Select Farm"
                required
                placeholder="Select Farm"
                searchPlaceholder="Search farms..."
                items={farms.map((f) => ({
                  value: (f.ulid || f.id || '').toString(),
                  label: f.name,
                  sublabel: `${f.area} ${f.area_unit}`,
                  icon: 'business-outline',
                }))}
                value={farmId || null}
                onSelect={(val) => {
                  setFarmId(val);
                  setCropCycleId('');
                }}
                emptyMessage="No farms found"
              />

              <SearchableSelect
                label="Select Crop Cycle"
                required
                placeholder={farmId ? "Select Crop Cycle" : "Select a farm first"}
                searchPlaceholder="Search active crop cycles..."
                items={filteredModalCropCycles.map((cc) => {
                  const cropName = cc.crop_name || cc.crop_type || 'Crop';
                  return {
                    value: (cc.ulid || cc.id || '').toString(),
                    label: `${cropName} (${cc.season_name || 'Active'})`,
                    icon: 'leaf-outline',
                  };
                })}
                value={cropCycleId || null}
                onSelect={(val) => setCropCycleId(val)}
                disabled={!farmId}
                emptyMessage={farmId ? "Selected farm has no active crop cycles" : "Please select a farm first"}
              />

              {/* Buyer / Trader Selector with Quick-Create */}
              <SearchableSelect
                label="Buyer / Trader"
                required
                allowClear
                placeholder="Select a registered buyer"
                searchPlaceholder="Search registered buyers..."
                items={buyers.map((b) => ({
                  value: (b.ulid || b.id).toString(),
                  label: b.name,
                  sublabel: [b.company_name, b.phone].filter(Boolean).join(' • ') || undefined,
                  icon: 'person-outline',
                }))}
                value={buyerId?.toString() || null}
                onSelect={(val) => {
                  setBuyerId(val || '');
                  const chosen = buyers.find((b) => (b.ulid || b.id).toString() === String(val));
                  if (chosen) setBuyerName(chosen.name);
                }}
                headerRight={
                  <TouchableOpacity
                    style={styles.addBuyerTriggerBtn}
                    onPress={() => setAddBuyerModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="person-add-outline" size={13} color={colors.primary} />
                    <Text style={styles.addBuyerTriggerText}>+ New Buyer</Text>
                  </TouchableOpacity>
                }
                emptyMessage="No registered buyers found"
              />

              <TextInput
                style={[styles.input, { marginTop: spacing.xs }]}
                placeholder="Or custom trader name..."
                placeholderTextColor={colors.slate400}
                value={buyerName}
                onChangeText={(val) => {
                  setBuyerName(val);
                  const match = buyers.find((b) => b.name.toLowerCase() === val.toLowerCase());
                  if (match) {
                    setBuyerId((match.ulid || match.id).toString());
                  } else {
                    setBuyerId('');
                  }
                }}
              />

              {/* Quality Grades Switch */}
              <View style={styles.switchRowContainer}>
                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                  <Text style={styles.switchTitle}>{t('Enable Quality Grades')}</Text>
                  <Text style={styles.switchSubtitle}>
                    {t('Split harvest into grades (A+, A, B, etc.) with specific rates')}
                  </Text>
                </View>
                <Switch
                  value={hasGrades}
                  onValueChange={(val) => {
                    setHasGrades(val);
                    if (val && grades.length === 0) {
                      setGrades([{ grade_name: 'a', quantity: '', rate: '' }]);
                    }
                  }}
                  trackColor={{ false: colors.slate200, true: '#86efac' }}
                  thumbColor={hasGrades ? colors.primary : colors.slate400}
                />
              </View>

              {/* Quantity Unit */}
              <View style={{ marginTop: spacing.sm }}>
                <Text style={styles.inputLabel}>Quantity Unit *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="BAG"
                  placeholderTextColor={colors.slate400}
                  value={quantityUnit}
                  onChangeText={setQuantityUnit}
                />
                <View style={styles.unitChipsRow}>
                  {COMMON_UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[
                        styles.unitChip,
                        quantityUnit === u && styles.unitChipActive,
                      ]}
                      onPress={() => setQuantityUnit(u)}
                    >
                      <Text
                        style={[
                          styles.unitChipText,
                          quantityUnit === u && styles.unitChipTextActive,
                        ]}
                      >
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {!hasGrades ? (
                <>
                  <ModernInput
                    label={`Total Quantity (${quantityUnit || 'units'})`}
                    required
                    suffix={quantityUnit || 'units'}
                    placeholder="e.g. 50"
                    keyboardType="decimal-pad"
                    value={totalQuantity}
                    onChangeText={setTotalQuantity}
                    containerStyle={{ marginTop: spacing.sm }}
                  />

                  <ModernInput
                    label={`Rate (per ${quantityUnit || 'unit'})`}
                    required
                    prefix="₹"
                    suffix={`/${quantityUnit || 'unit'}`}
                    placeholder="e.g. 450"
                    keyboardType="decimal-pad"
                    value={rate}
                    onChangeText={setRate}
                    containerStyle={{ marginTop: spacing.sm }}
                  />
                </>
              ) : (
                <View style={styles.gradesCard}>
                  <View style={styles.gradesCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gradesCardTitle}>{t('Grades Breakdown')}</Text>
                      <Text style={styles.gradesCardSubtitle}>
                        {t('Total')}: {gradesTotalQty.toFixed(1)} {quantityUnit} • ₹{gradesGross.toFixed(2)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleAddGradeLine}
                      style={styles.addGradeBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={14} color={colors.white} />
                      <Text style={styles.addGradeBtnText}>{t('Add Grade')}</Text>
                    </TouchableOpacity>
                  </View>

                  {grades.length === 0 ? (
                    <Text style={styles.noGradesText}>
                      {t('No grades added. Tap "+ Add Grade" to split your harvest by quality.')}
                    </Text>
                  ) : (
                    grades.map((grade, idx) => (
                      <View key={idx} style={styles.gradeItemBox}>
                        <View style={styles.gradeItemTopRow}>
                          <Text style={styles.gradeRowNumber}>#{idx + 1}</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginHorizontal: 6 }}>
                            <View style={styles.gradePillsContainer}>
                              {GRADE_OPTIONS.map((opt) => (
                                <TouchableOpacity
                                  key={opt.value}
                                  style={[
                                    styles.gradePill,
                                    grade.grade_name === opt.value && styles.gradePillActive,
                                  ]}
                                  onPress={() => handleUpdateGradeField(idx, 'grade_name', opt.value)}
                                >
                                  <Text
                                    style={[
                                      styles.gradePillText,
                                      grade.grade_name === opt.value && styles.gradePillTextActive,
                                    ]}
                                  >
                                    {opt.label.replace('Grade ', '')}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </ScrollView>
                          <TouchableOpacity
                            onPress={() => handleRemoveGradeLine(idx)}
                            style={styles.removeGradeBtn}
                          >
                            <Ionicons name="trash-outline" size={16} color={colors.danger} />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.gradeInputsRow}>
                          <View style={{ flex: 1, marginRight: spacing.xs }}>
                            <Text style={styles.gradeFieldLabel}>Qty ({quantityUnit})</Text>
                            <TextInput
                              style={[styles.input, styles.compactInput]}
                              placeholder="0"
                              placeholderTextColor={colors.slate400}
                              keyboardType="decimal-pad"
                              value={grade.quantity}
                              onChangeText={(val) => handleUpdateGradeField(idx, 'quantity', val)}
                            />
                          </View>
                          <View style={{ flex: 1, marginRight: spacing.xs }}>
                            <Text style={styles.gradeFieldLabel}>Rate (₹)</Text>
                            <TextInput
                              style={[styles.input, styles.compactInput]}
                              placeholder="0"
                              placeholderTextColor={colors.slate400}
                              keyboardType="decimal-pad"
                              value={grade.rate}
                              onChangeText={(val) => handleUpdateGradeField(idx, 'rate', val)}
                            />
                          </View>
                          <View style={{ flex: 1.1, justifyContent: 'center', alignItems: 'flex-end', paddingTop: 14 }}>
                            <Text style={styles.gradeFieldLabel}>Amount</Text>
                            <Text style={styles.gradeAmountText}>
                              ₹{((parseFloat(grade.quantity) || 0) * (parseFloat(grade.rate) || 0)).toFixed(0)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* Deductions & Charges Section */}
              <View style={styles.deductionsCard}>
                <View style={styles.deductionsHeader}>
                  <View>
                    <Text style={styles.deductionsTitle}>{t('Deductions & Mandi Charges')}</Text>
                    <Text style={styles.deductionsSubtitle}>
                      {t('Commission, loading, transport or packaging')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleAddChargeLine}
                    style={styles.addChargeBtn}
                  >
                    <Ionicons name="add" size={14} color={colors.white} />
                    <Text style={styles.addChargeBtnText}>{t('Add')}</Text>
                  </TouchableOpacity>
                </View>

                {charges.length === 0 ? (
                  <Text style={styles.noChargesText}>
                    {t('No deductions added. Tap "Add" to include Mandi Fee, Freight, Labor, etc.')}
                  </Text>
                ) : (
                  charges.map((charge, idx) => (
                    <View key={idx} style={styles.chargeInputRow}>
                      <TextInput
                        style={[styles.input, styles.chargeNameInput]}
                        placeholder={t('Fee name (e.g. Mandi)')}
                        placeholderTextColor={colors.slate400}
                        value={charge.charge_name}
                        onChangeText={(val) => handleUpdateChargeField(idx, 'charge_name', val)}
                      />
                      <TextInput
                        style={[styles.input, styles.chargeValInput]}
                        placeholder={t('Amount')}
                        placeholderTextColor={colors.slate400}
                        keyboardType="decimal-pad"
                        value={charge.value}
                        onChangeText={(val) => handleUpdateChargeField(idx, 'value', val)}
                      />
                      <TouchableOpacity
                        style={[
                          styles.chargeTypeToggle,
                          charge.type === 'percentage'
                            ? styles.chargeTypeTogglePercent
                            : styles.chargeTypeToggleFlat,
                        ]}
                        onPress={() =>
                          handleUpdateChargeField(
                            idx,
                            'type',
                            charge.type === 'flat' ? 'percentage' : 'flat'
                          )
                        }
                      >
                        <Text style={styles.chargeTypeToggleText}>
                          {charge.type === 'percentage' ? '%' : '₹'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveChargeLine(idx)}
                        style={styles.removeChargeBtn}
                      >
                        <Ionicons name="trash-outline" size={17} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                {/* Live Realization Calculation Banner */}
                <View style={styles.calcBanner}>
                  <View style={styles.calcCol}>
                    <Text style={styles.calcLabel}>{t('Gross Value')}</Text>
                    <Text style={styles.calcVal}>₹{calcGross.toFixed(2)}</Text>
                  </View>
                  <View style={styles.calcCol}>
                    <Text style={styles.calcLabel}>{t('Deductions')}</Text>
                    <Text style={[styles.calcVal, { color: colors.danger }]}>
                      -₹{calcCharges.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.calcCol}>
                    <Text style={styles.calcLabel}>{t('Net Payout')}</Text>
                    <Text style={[styles.calcVal, { color: colors.primary, fontWeight: '800' }]}>
                      ₹{calcFinal.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>

              <ModernInput
                label={t('Sale Notes')}
                placeholder={t('Weighment bridge details, vehicle number, trader receipt notes...')}
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
                containerStyle={{ marginTop: spacing.md }}
              />

              <View style={{ marginTop: spacing.md }}>
                <AttachmentPicker
                  label="Weighment Slip / Trader Bill"
                  category="sale-bills"
                  currentPath={billPhotoPath}
                  currentUrl={billPhotoUrl}
                  onAttachmentChange={(p, u) => {
                    setBillPhotoPath(p);
                    setBillPhotoUrl(u);
                  }}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setSaleModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleSaveSale}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                  <Text style={styles.saveBtnText}>
                    {editingSale ? 'Update Sale' : 'Save Sale'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Attachment Full-Screen Preview Modal */}
      <Modal visible={Boolean(previewModalUrl)} transparent animationType="fade">
        <View style={styles.fullPreviewBackdrop}>
          <TouchableOpacity
            style={styles.closePreviewBtn}
            onPress={() => setPreviewModalUrl(null)}
          >
            <Ionicons name="close" size={24} color={colors.white} />
          </TouchableOpacity>
          {previewModalUrl ? (
            <Image
              source={{ uri: previewModalUrl }}
              style={styles.fullPreviewImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>

      {/* Quick Add Buyer Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addBuyerModalVisible}
        onRequestClose={() => setAddBuyerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalKicker}>{t('BUYERS MASTER')}</Text>
                <Text style={styles.modalTitle}>{t('Add New Buyer')}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setAddBuyerModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <ModernInput
                label={t('Buyer / Trader Name')}
                required
                placeholder={t('e.g. Ramesh Trading Co.')}
                value={newBuyerName}
                onChangeText={setNewBuyerName}
                containerStyle={{ marginTop: spacing.sm }}
              />

              <ModernInput
                label={t('Phone Number')}
                placeholder={t('e.g. 9876543210')}
                keyboardType="phone-pad"
                value={newBuyerPhone}
                onChangeText={setNewBuyerPhone}
                containerStyle={{ marginTop: spacing.sm }}
              />

              <ModernInput
                label={t('Company / Stall Name')}
                placeholder={t('e.g. APMC Shop #42')}
                value={newBuyerCompany}
                onChangeText={setNewBuyerCompany}
                containerStyle={{ marginTop: spacing.sm }}
              />

              <ModernInput
                label={t('Address')}
                placeholder={t('Mandi address or city')}
                value={newBuyerAddress}
                onChangeText={setNewBuyerAddress}
                containerStyle={{ marginTop: spacing.sm }}
              />

              <ModernInput
                label={t('Notes')}
                placeholder={t('Payment terms, market agent, etc.')}
                multiline
                numberOfLines={2}
                value={newBuyerNotes}
                onChangeText={setNewBuyerNotes}
                containerStyle={{ marginTop: spacing.sm }}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setAddBuyerModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn, savingBuyer && { opacity: 0.7 }]}
                  onPress={handleCreateQuickBuyer}
                  disabled={savingBuyer}
                >
                  {savingBuyer ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                      <Text style={styles.saveBtnText}>{t('Save Buyer')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirm Delete Bottom Sheet Modal */}
      <ConfirmModal
        visible={deleteConfirmVisible}
        onClose={() => {
          if (!deleting) setDeleteConfirmVisible(false);
        }}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title={t('Delete Sale Record')}
        message={t('Are you sure you want to delete this sale record? This action cannot be undone.')}
        confirmLabel={t('Delete Sale')}
        cancelLabel={t('Cancel')}
        variant="danger"
        icon="trash-outline"
      />

      {/* Farm Filter Bottom Sheet Modal */}
      <ModalSheet
        visible={farmFilterModalVisible}
        onClose={() => setFarmFilterModalVisible(false)}
        title={t('Filter by Farm')}
        kicker={t('Farm Selection')}
      >
        <View style={styles.filterModalContent}>
          <TouchableOpacity
            style={[
              styles.filterOptionItem,
              selectedFarmFilter === 'all' && styles.filterOptionItemActive,
            ]}
            onPress={() => {
              setSelectedFarmFilter('all');
              setFarmFilterModalVisible(false);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.filterOptionTextCol}>
              <Text
                style={[
                  styles.filterOptionTitle,
                  selectedFarmFilter === 'all' && styles.filterOptionTitleActive,
                ]}
              >
                {t('All Farms')}
              </Text>
              <Text style={styles.filterOptionSub}>
                {t('Show sales across all farms')}
              </Text>
            </View>
            {selectedFarmFilter === 'all' && (
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>

          {accessibleFarms.map((farm) => {
            const isSelected = selectedFarmFilter === farm.id;
            return (
              <TouchableOpacity
                key={farm.id}
                style={[
                  styles.filterOptionItem,
                  isSelected && styles.filterOptionItemActive,
                ]}
                onPress={() => {
                  if (farm.id !== undefined) {
                    setSelectedFarmFilter(farm.id);
                  }
                  setFarmFilterModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.filterOptionTextCol}>
                  <Text
                    style={[
                      styles.filterOptionTitle,
                      isSelected && styles.filterOptionTitleActive,
                    ]}
                  >
                    {farm.name}
                  </Text>
                  {farm.location ? (
                    <Text style={styles.filterOptionSub}>{farm.location}</Text>
                  ) : null}
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.slate500,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: spacing.sm,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.02,
    lineHeight: 26,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  filterSection: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  listHeaderComponent: {
    paddingBottom: spacing.xs,
  },
  filterModalContent: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  filterOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  filterOptionItemActive: {
    backgroundColor: '#ecfdf5',
    borderColor: colors.primary,
  },
  filterOptionTextCol: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  filterOptionTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.slate800,
  },
  filterOptionTitleActive: {
    color: colors.primaryDark,
  },
  filterOptionSub: {
    ...typography.caption,
    color: colors.slate500,
    marginTop: 2,
  },
  summaryGrid: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  summaryTile: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 115,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: spacing.xs,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.title2,
    color: colors.slate800,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.slate500,
    textAlign: 'center',
    maxWidth: 240,
  },
  saleCard: {
    marginBottom: 10,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  buyerNameText: {
    ...typography.title2,
    color: colors.slate900,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  cardDateText: {
    ...typography.caption,
    color: colors.slate500,
  },
  saleIdBadge: {
    backgroundColor: colors.slate100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  saleIdText: {
    ...typography.caption,
    color: colors.slate600,
    fontWeight: '800',
  },
  badgesWrapper: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 2,
  },
  detailsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  gridCell: {
    flex: 1,
    alignItems: 'center',
  },
  gridDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.slate200,
  },
  gridLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.slate400,
  },
  gridVal: {
    ...typography.title3,
    color: colors.slate800,
    marginTop: 2,
  },
  chargesWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 2,
  },
  chargeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  chargeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.dangerText,
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
    alignSelf: 'flex-start',
  },
  attachmentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.slate50,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  notesText: {
    ...typography.bodySmall,
    color: colors.slate600,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    paddingTop: spacing.sm,
    marginTop: 4,
  },
  amountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  amountBlock: {
    gap: 1,
  },
  finalAmountBlock: {
    gap: 1,
  },
  amountLabel: {
    ...typography.caption,
    fontSize: 9,
    color: colors.slate400,
  },
  amountVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.slate700,
  },
  finalVal: {
    ...typography.title2,
    fontWeight: '900',
    color: colors.primary,
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  salesCardViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  salesCardViewText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.xs,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.xs,
    backgroundColor: colors.dangerSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.glowPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  modalKicker: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
  },
  modalTitle: {
    ...typography.title1,
    color: colors.slate900,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingBottom: 24,
  },
  inputLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.slate700,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.slate900,
    backgroundColor: colors.slate50,
  },
  textArea: {
    height: 80,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  rowInputs: {
    flexDirection: 'row',
  },
  unitChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.xs,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  unitChipActive: {
    backgroundColor: colors.slate800,
    borderColor: colors.slate800,
  },
  unitChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate600,
  },
  unitChipTextActive: {
    color: colors.white,
  },
  emptyCyclesNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warningSurface,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  emptyCyclesText: {
    ...typography.bodySmall,
    color: colors.warningText,
  },
  deductionsCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.slate50,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    gap: spacing.sm,
  },
  deductionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  deductionsTitle: {
    ...typography.title3,
    color: colors.slate900,
  },
  deductionsSubtitle: {
    ...typography.bodySmall,
    color: colors.slate500,
  },
  addChargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.xs,
  },
  addChargeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  noChargesText: {
    ...typography.bodySmall,
    color: colors.slate500,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  chargeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  chargeNameInput: {
    flex: 2,
    height: 40,
    fontSize: 13,
  },
  chargeValInput: {
    flex: 1.2,
    height: 40,
    fontSize: 13,
  },
  chargeTypeToggle: {
    width: 36,
    height: 40,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chargeTypeToggleFlat: {
    backgroundColor: colors.info,
  },
  chargeTypeTogglePercent: {
    backgroundColor: colors.warning,
  },
  chargeTypeToggleText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
  },
  removeChargeBtn: {
    padding: 6,
  },
  calcBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  calcCol: {
    gap: 2,
  },
  calcLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.slate500,
  },
  calcVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate800,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  cancelBtn: {
    backgroundColor: colors.slate100,
  },
  cancelBtnText: {
    ...typography.title3,
    color: colors.slate700,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    ...shadows.subtle,
  },
  saveBtnText: {
    ...typography.title3,
    color: colors.white,
  },
  fullPreviewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closePreviewBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  fullPreviewImage: {
    width: '94%',
    height: '80%',
  },
  buyerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  addBuyerTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  addBuyerTriggerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  dropdownSelectedText: {
    ...typography.body,
    color: colors.slate900,
    fontWeight: '600',
  },
  dropdownPlaceholderText: {
    ...typography.body,
    color: colors.slate400,
  },
  dropdownMenu: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    marginTop: 4,
    overflow: 'hidden',
    ...shadows.medium,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  dropdownItemSelected: {
    backgroundColor: colors.primarySurface,
  },
  dropdownItemText: {
    ...typography.body,
    fontSize: 14,
    color: colors.slate800,
    fontWeight: '600',
  },
  dropdownItemTextSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  dropdownItemSubtext: {
    ...typography.caption,
    color: colors.slate500,
    marginTop: 1,
  },
  switchRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
  switchSubtitle: {
    ...typography.caption,
    color: colors.slate500,
    marginTop: 2,
  },
  gradesCard: {
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: spacing.md,
    marginTop: spacing.md,
  },
  gradesCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  gradesCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
  gradesCardSubtitle: {
    fontSize: 11,
    color: colors.slate600,
    fontWeight: '600',
    marginTop: 2,
  },
  addGradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.xs,
  },
  addGradeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  noGradesText: {
    ...typography.bodySmall,
    color: colors.slate500,
    fontStyle: 'italic',
    paddingVertical: 8,
    textAlign: 'center',
  },
  gradeItemBox: {
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.slate200,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  gradeItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  gradeRowNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.slate500,
    width: 24,
  },
  gradePillsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  gradePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  gradePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  gradePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate600,
  },
  gradePillTextActive: {
    color: colors.white,
  },
  removeGradeBtn: {
    padding: 4,
  },
  gradeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactInput: {
    height: 40,
    fontSize: 13,
    marginBottom: 0,
    paddingHorizontal: 8,
  },
  gradeFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.slate500,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  gradeAmountText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    height: 40,
    lineHeight: 40,
  },
});
