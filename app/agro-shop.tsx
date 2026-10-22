import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { agroShopsApi } from '../src/api/agroShops';
import { AgroShop, AgroShopPurchase, AgroShopPayment, AgroInputProduct } from '../src/types';
import { extractErrorMessage } from '../src/api/client';
import { AttachmentPicker } from '../src/components/AttachmentPicker';
import { BentoCard, MetricTile, StatusBadge, QuickChipGroup, SearchFilterBar } from '../src/components/ui';
import { colors, spacing, radius, typography, shadows } from '../src/theme/tokens';

type ActiveTab = 'purchases' | 'payments' | 'info';

const COMMON_UNITS = [
  { label: 'BAG', value: 'BAG' },
  { label: 'KG', value: 'KG' },
  { label: 'LTR', value: 'LTR' },
  { label: 'PKT', value: 'PKT' },
  { label: 'BTL', value: 'BTL' },
];

const PAYMENT_METHODS = [
  { label: 'Cash', value: 'cash' },
  { label: 'Google Pay', value: 'google_pay' },
  { label: 'PhonePe', value: 'phonepe' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
];

export default function AgroShopScreen() {
  const [shops, setShops] = useState<AgroShop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | string | null>(null);
  const [summary, setSummary] = useState<{ total_purchase: number; total_paid: number; balance: number }>({
    total_purchase: 0,
    total_paid: 0,
    balance: 0,
  });

  const [purchases, setPurchases] = useState<AgroShopPurchase[]>([]);
  const [payments, setPayments] = useState<AgroShopPayment[]>([]);
  const [inputProducts, setInputProducts] = useState<AgroInputProduct[]>([]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('purchases');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Triggers
  const [actionChoiceVisible, setActionChoiceVisible] = useState(false);
  const [shopModalVisible, setShopModalVisible] = useState(false);
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  // Shop Form Fields
  const [shopName, setShopName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [shopNotes, setShopNotes] = useState('');

  // Purchase Form Fields
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<{
    agro_input_product_id: string;
    quantity: string;
    unit: string;
    unit_price: string;
  }[]>([{ agro_input_product_id: '', quantity: '', unit: 'BAG', unit_price: '' }]);
  const [purchaseBillPhotoPath, setPurchaseBillPhotoPath] = useState<string | null>(null);
  const [purchaseBillPhotoUrl, setPurchaseBillPhotoUrl] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // Payment Form Fields
  const [paymentPurchaseId, setPaymentPurchaseId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Initial load
  const loadShops = async () => {
    try {
      const data = await agroShopsApi.getShops();
      setShops(data);
      if (data.length > 0 && !selectedShopId) {
        setSelectedShopId(data[0].id);
      }

      const products = await agroShopsApi.getInputProducts();
      setInputProducts(products);
    } catch (error) {
      console.error('Error fetching shops:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to fetch shops.'));
    }
  };

  useEffect(() => {
    loadShops();
  }, []);

  // Fetch ledger summary, purchases, payments when selected shop changes
  const fetchLedgerData = useCallback(
    async (showIndicator = true) => {
      if (!selectedShopId) return;
      if (showIndicator) setLoading(true);
      try {
        const [summaryData, purchasesData, paymentsData] = await Promise.all([
          agroShopsApi.getShopSummary(selectedShopId),
          agroShopsApi.getPurchases(selectedShopId),
          agroShopsApi.getPayments(selectedShopId),
        ]);
        setSummary(summaryData);
        setPurchases(purchasesData);
        setPayments(paymentsData);
      } catch (error) {
        console.error('Error fetching shop ledger:', error);
        Alert.alert('Error', extractErrorMessage(error, 'Failed to load shop details.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedShopId]
  );

  useEffect(() => {
    fetchLedgerData(true);
  }, [selectedShopId, fetchLedgerData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLedgerData(false);
  };

  // Toggle active status for shop
  const handleToggleShopStatus = async (shop: AgroShop) => {
    try {
      await agroShopsApi.toggleShopStatus(shop.id);
      loadShops();
    } catch (error) {
      console.error('Error toggling shop status:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to toggle status.'));
    }
  };

  // Save Shop
  const handleSaveShop = async () => {
    if (!shopName.trim()) {
      Alert.alert('Validation Error', 'Shop name is required.');
      return;
    }
    try {
      const newShop = await agroShopsApi.createShop({
        name: shopName,
        contact_name: contactName,
        phone,
        address,
        notes: shopNotes,
        is_active: true,
      });
      Alert.alert('Success', 'Agro Shop added successfully.');
      setShopModalVisible(false);
      setShopName('');
      setContactName('');
      setPhone('');
      setAddress('');
      setShopNotes('');

      setSelectedShopId(newShop.id);
      loadShops();
    } catch (error) {
      console.error('Error saving shop:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to create shop.'));
    }
  };

  // Add purchase item line
  const handleAddPurchaseItemLine = () => {
    setPurchaseItems([
      ...purchaseItems,
      { agro_input_product_id: '', quantity: '', unit: 'BAG', unit_price: '' },
    ]);
  };

  // Remove purchase item line
  const handleRemovePurchaseItemLine = (index: number) => {
    if (purchaseItems.length === 1) return;
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  // Save Purchase
  const handleSavePurchase = async () => {
    if (!selectedShopId) return;
    if (!purchaseDate.trim()) {
      Alert.alert('Validation Error', 'Purchase date is required.');
      return;
    }

    const invalidItem = purchaseItems.some(
      (item) => !item.agro_input_product_id || !item.quantity || !item.unit_price
    );
    if (invalidItem) {
      Alert.alert('Validation Error', 'Please complete all fields for each item.');
      return;
    }

    const payload = {
      date: purchaseDate,
      notes: purchaseNotes,
      bill_photo_path: purchaseBillPhotoPath,
      items: purchaseItems.map((item) => ({
        agro_input_product_id: parseInt(item.agro_input_product_id),
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        unit_price: parseFloat(item.unit_price),
      })),
    };

    try {
      await agroShopsApi.createPurchase(selectedShopId, payload);
      Alert.alert('Success', 'Purchase recorded successfully.');
      setPurchaseModalVisible(false);
      setPurchaseDate('');
      setPurchaseNotes('');
      setPurchaseBillPhotoPath(null);
      setPurchaseBillPhotoUrl(null);
      setPurchaseItems([{ agro_input_product_id: '', quantity: '', unit: 'BAG', unit_price: '' }]);
      fetchLedgerData(false);
      loadShops();
    } catch (error) {
      console.error('Error recording purchase:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to record purchase.'));
    }
  };

  // Save Payment
  const handleSavePayment = async () => {
    if (!selectedShopId) return;
    if (!paymentDate.trim() || !paymentAmount) {
      Alert.alert('Validation Error', 'Date and Amount are required.');
      return;
    }

    const payload = {
      agro_shop_purchase_id: paymentPurchaseId ? parseInt(paymentPurchaseId) : null,
      date: paymentDate,
      amount: parseFloat(paymentAmount),
      payment_method: paymentMethod,
      notes: paymentNotes,
    };

    try {
      await agroShopsApi.createPayment(selectedShopId, payload);
      Alert.alert('Success', 'Payment recorded successfully.');
      setPaymentModalVisible(false);
      setPaymentPurchaseId('');
      setPaymentDate('');
      setPaymentAmount('');
      setPaymentMethod('cash');
      setPaymentNotes('');
      fetchLedgerData(false);
      loadShops();
    } catch (error) {
      console.error('Error saving payment:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to save payment.'));
    }
  };

  // Delete Purchase
  const handleDeletePurchase = (purchase: AgroShopPurchase) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this purchase? Any linked payments will remain in ledger history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await agroShopsApi.deletePurchase(purchase.id);
              fetchLedgerData(false);
              loadShops();
            } catch (error) {
              console.error('Error deleting purchase:', error);
              Alert.alert('Error', extractErrorMessage(error, 'Failed to delete purchase.'));
            }
          },
        },
      ]
    );
  };

  // Delete Payment
  const handleDeletePayment = (payment: AgroShopPayment) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this payment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await agroShopsApi.deletePayment(payment.id);
            fetchLedgerData(false);
            loadShops();
          } catch (error) {
            console.error('Error deleting payment:', error);
            Alert.alert('Error', extractErrorMessage(error, 'Failed to delete payment.'));
          }
        },
      },
    ]);
  };

  const getSelectedShop = () => {
    return shops.find((s) => s.id === selectedShopId);
  };

  // Filtered Purchases
  const filteredPurchases = useMemo(() => {
    if (!searchQuery.trim()) return purchases;
    const query = searchQuery.toLowerCase();
    return purchases.filter((p) => {
      const matchNotes = p.notes && p.notes.toLowerCase().includes(query);
      const matchItems = p.items?.some((i) => i.product_name.toLowerCase().includes(query));
      const matchDate = p.date.toLowerCase().includes(query);
      return matchNotes || matchItems || matchDate;
    });
  }, [purchases, searchQuery]);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    if (!searchQuery.trim()) return payments;
    const query = searchQuery.toLowerCase();
    return payments.filter((pay) => {
      const matchNotes = pay.notes && pay.notes.toLowerCase().includes(query);
      const matchMethod = pay.payment_method.toLowerCase().includes(query);
      const matchDate = pay.date.toLowerCase().includes(query);
      return matchNotes || matchMethod || matchDate;
    });
  }, [payments, searchQuery]);

  // Render tabs
  const renderTabContent = () => {
    const selectedShop = getSelectedShop();
    if (!selectedShop) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="storefront-outline" size={36} color={colors.slate400} />
          </View>
          <Text style={styles.emptyTitle}>No Agro Shop Selected</Text>
          <Text style={styles.emptySubtitle}>Create or choose a shop to manage ledger & purchases</Text>
        </View>
      );
    }

    if (activeTab === 'purchases') {
      return (
        <FlatList
          data={filteredPurchases}
          keyExtractor={(item) => item.ulid}
          contentContainerStyle={styles.tabListContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeaderWrapper}>
              <SearchFilterBar
                query={searchQuery}
                onChangeQuery={setSearchQuery}
                placeholder="Search items, notes or date..."
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="cart-outline" size={32} color={colors.slate400} />
              </View>
              <Text style={styles.emptyTitle}>No Purchases Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try matching another search keyword' : 'Record your first purchase for this shop'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const dateStr = new Date(item.date).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const statusVariant =
              item.status === 'completed'
                ? 'success'
                : item.status === 'partial'
                ? 'warning'
                : 'neutral';

            return (
              <BentoCard variant="elevated" style={styles.purchaseCard}>
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.dateRow}>
                    <Ionicons name="calendar-outline" size={14} color={colors.slate500} />
                    <Text style={styles.cardDate}>{dateStr}</Text>
                  </View>
                  <StatusBadge
                    label={item.status.toUpperCase()}
                    variant={statusVariant}
                    dot={item.status === 'partial'}
                  />
                </View>

                {/* 3-Cell Metric Grid */}
                <View style={styles.cardGrid}>
                  <View style={styles.gridCell}>
                    <Text style={styles.gridCellLabel}>Total Bill</Text>
                    <Text style={styles.gridCellValue}>₹{item.total_amount}</Text>
                  </View>
                  <View style={styles.gridDivider} />
                  <View style={styles.gridCell}>
                    <Text style={styles.gridCellLabel}>Paid</Text>
                    <Text style={[styles.gridCellValue, { color: colors.primary }]}>
                      ₹{item.paid_amount || 0}
                    </Text>
                  </View>
                  <View style={styles.gridDivider} />
                  <View style={styles.gridCell}>
                    <Text style={styles.gridCellLabel}>Due</Text>
                    <Text
                      style={[
                        styles.gridCellValue,
                        { color: item.balance > 0 ? colors.danger : colors.slate600 },
                      ]}
                    >
                      ₹{item.balance}
                    </Text>
                  </View>
                </View>

                {/* Items Purchased List */}
                <View style={styles.itemsListContainer}>
                  <View style={styles.itemsSectionHeader}>
                    <Ionicons name="cube-outline" size={14} color={colors.slate600} />
                    <Text style={styles.itemsListHeader}>Items Purchased</Text>
                  </View>
                  {item.items?.map((pItem) => (
                    <View key={pItem.id} style={styles.itemRow}>
                      <View style={{ flex: 1, paddingRight: spacing.sm }}>
                        <Text style={styles.itemNameText}>{pItem.product_name}</Text>
                        <Text style={styles.itemQtyText}>
                          {pItem.quantity} {pItem.unit} × ₹{pItem.unit_price}
                        </Text>
                      </View>
                      <View style={styles.itemAmountBadge}>
                        <Text style={styles.itemAmountText}>₹{pItem.amount}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Notes */}
                {item.notes ? (
                  <View style={styles.notesBox}>
                    <Ionicons name="chatbubble-ellipses-outline" size={13} color={colors.slate500} />
                    <Text style={styles.purchaseNotes}>{item.notes}</Text>
                  </View>
                ) : null}

                {/* Actions & Bill link */}
                <View style={styles.cardActionsRow}>
                  {item.bill_photo_url ? (
                    <TouchableOpacity
                      style={styles.attachmentBadge}
                      onPress={() => setPreviewModalUrl(item.bill_photo_url || null)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="receipt-outline" size={14} color={colors.primary} />
                      <Text style={styles.attachmentBadgeText}>View Bill</Text>
                      <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                    </TouchableOpacity>
                  ) : (
                    <View />
                  )}

                  <TouchableOpacity
                    style={styles.deleteCardBtn}
                    onPress={() => handleDeletePurchase(item)}
                  >
                    <Ionicons name="trash-outline" size={14} color={colors.danger} />
                    <Text style={styles.deleteCardBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </BentoCard>
            );
          }}
        />
      );
    }

    if (activeTab === 'payments') {
      return (
        <FlatList
          data={filteredPayments}
          keyExtractor={(item) => item.ulid}
          contentContainerStyle={styles.tabListContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeaderWrapper}>
              <SearchFilterBar
                query={searchQuery}
                onChangeQuery={setSearchQuery}
                placeholder="Search payment method, notes..."
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="card-outline" size={32} color={colors.slate400} />
              </View>
              <Text style={styles.emptyTitle}>No Payments Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try matching another search keyword' : 'Record payments to settle shop dues'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const dateStr = new Date(item.date).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const methodLabel = item.payment_method.replace('_', ' ').toUpperCase();

            return (
              <BentoCard variant="elevated" style={styles.paymentCard}>
                <View style={styles.paymentHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.dateRow}>
                      <Ionicons name="calendar-outline" size={13} color={colors.slate500} />
                      <Text style={styles.paymentDate}>{dateStr}</Text>
                    </View>
                    <View style={styles.methodTag}>
                      <Ionicons name="card-outline" size={12} color={colors.slate600} />
                      <Text style={styles.paymentMethod}>{methodLabel}</Text>
                    </View>
                  </View>
                  <View style={styles.amountPill}>
                    <Text style={styles.amountPillPrefix}>₹</Text>
                    <Text style={styles.paymentAmount}>{item.amount}</Text>
                  </View>
                </View>

                {item.notes ? (
                  <View style={styles.notesBox}>
                    <Ionicons name="chatbubble-ellipses-outline" size={13} color={colors.slate500} />
                    <Text style={styles.paymentNotes}>{item.notes}</Text>
                  </View>
                ) : null}

                <View style={styles.paymentFooter}>
                  <View />
                  <TouchableOpacity
                    style={styles.deleteCardBtn}
                    onPress={() => handleDeletePayment(item)}
                  >
                    <Ionicons name="trash-outline" size={14} color={colors.danger} />
                    <Text style={styles.deleteCardBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </BentoCard>
            );
          }}
        />
      );
    }

    // Info Tab
    return (
      <ScrollView
        contentContainerStyle={styles.infoTabContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <BentoCard variant="elevated" style={styles.shopProfileCard}>
          <View style={styles.profileHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.profileKickerRow}>
                <Ionicons name="storefront-outline" size={14} color={colors.primary} />
                <Text style={styles.profileKicker}>AGRO SHOP PROFILE</Text>
              </View>
              <Text style={styles.profileName}>{selectedShop.name}</Text>
            </View>
            <StatusBadge
              label={selectedShop.is_active ? 'ACTIVE' : 'INACTIVE'}
              variant={selectedShop.is_active ? 'success' : 'neutral'}
            />
          </View>

          <View style={styles.profileDetailsList}>
            <View style={styles.profileRow}>
              <View style={styles.profileKeyCol}>
                <Ionicons name="person-outline" size={14} color={colors.slate500} />
                <Text style={styles.profileKey}>Contact</Text>
              </View>
              <Text style={styles.profileValue}>{selectedShop.contact_name || '-'}</Text>
            </View>

            <View style={styles.profileRow}>
              <View style={styles.profileKeyCol}>
                <Ionicons name="call-outline" size={14} color={colors.slate500} />
                <Text style={styles.profileKey}>Phone</Text>
              </View>
              <Text style={styles.profileValue}>{selectedShop.phone || '-'}</Text>
            </View>

            <View style={styles.profileRow}>
              <View style={styles.profileKeyCol}>
                <Ionicons name="location-outline" size={14} color={colors.slate500} />
                <Text style={styles.profileKey}>Address</Text>
              </View>
              <Text style={styles.profileValue}>{selectedShop.address || '-'}</Text>
            </View>

            <View style={styles.profileRow}>
              <View style={styles.profileKeyCol}>
                <Ionicons name="document-text-outline" size={14} color={colors.slate500} />
                <Text style={styles.profileKey}>Notes</Text>
              </View>
              <Text style={styles.profileValue}>{selectedShop.notes || '-'}</Text>
            </View>
          </View>

          <View style={styles.profileStatusToggleRow}>
            <View>
              <Text style={styles.statusToggleLabel}>Active Status</Text>
              <Text style={styles.statusToggleSubLabel}>Enable or disable this shop for entries</Text>
            </View>
            <Switch
              value={selectedShop.is_active}
              onValueChange={() => handleToggleShopStatus(selectedShop)}
              trackColor={{ false: colors.slate300, true: colors.primaryLight }}
              thumbColor={selectedShop.is_active ? colors.primary : colors.slate100}
            />
          </View>
        </BentoCard>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={22} color={colors.slate800} />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
          <Text style={styles.headerKicker}>INVENTORY & SUPPLIES</Text>
          <Text style={styles.headerTitle}>Agro Shop & Ledger</Text>
        </View>
      </View>

      {/* Shop Selector Row */}
      <View style={styles.shopSelectorWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shopSelectorContent}
        >
          {shops.map((shop) => {
            const isSelected = selectedShopId === shop.id;
            const hasDue = shop.summary && shop.summary.balance > 0;
            return (
              <TouchableOpacity
                key={shop.id}
                style={[styles.shopPill, isSelected && styles.shopPillActive]}
                onPress={() => setSelectedShopId(shop.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="storefront"
                  size={14}
                  color={isSelected ? colors.white : colors.slate600}
                />
                <Text style={[styles.shopPillText, isSelected && styles.shopPillTextActive]}>
                  {shop.name}
                </Text>
                {hasDue ? (
                  <View
                    style={[
                      styles.duePill,
                      isSelected ? styles.duePillSelected : styles.duePillUnselected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.duePillText,
                        isSelected ? styles.duePillTextSelected : styles.duePillTextUnselected,
                      ]}
                    >
                      ₹{shop.summary?.balance}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
          {shops.length === 0 && (
            <Text style={styles.noShopsInfoText}>Please add a shop to begin ledger tracking.</Text>
          )}
        </ScrollView>
      </View>

      {/* Summary Bento Stats */}
      {selectedShopId && (
        <View style={styles.summaryGrid}>
          <View style={styles.summaryTile}>
            <MetricTile
              label="PURCHASES"
              value={`₹${summary.total_purchase}`}
              iconName="cart-outline"
              iconColor={colors.slate700}
              iconBg={colors.slate100}
            />
          </View>
          <View style={styles.summaryTile}>
            <MetricTile
              label="PAID"
              value={`₹${summary.total_paid}`}
              iconName="check-circle-outline"
              iconColor={colors.successText}
              iconBg={colors.successSurface}
            />
          </View>
          <View style={styles.summaryTile}>
            <MetricTile
              label="BALANCE DUE"
              value={`₹${summary.balance}`}
              iconName="alert-circle-outline"
              iconColor={summary.balance > 0 ? colors.dangerText : colors.slate600}
              iconBg={summary.balance > 0 ? colors.dangerSurface : colors.slate100}
            />
          </View>
        </View>
      )}

      {/* Segmented Control tab row */}
      {selectedShopId && (
        <View style={styles.tabContainer}>
          <View style={styles.tabRow}>
            {(
              [
                { key: 'purchases', label: 'Purchases', icon: 'cart-outline', count: purchases.length as number | undefined },
                { key: 'payments', label: 'Payments', icon: 'card-outline', count: payments.length as number | undefined },
                { key: 'info', label: 'Shop Info', icon: 'information-circle-outline', count: undefined as number | undefined },
              ]
            ).map((tab) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                  onPress={() => setActiveTab(tab.key as ActiveTab)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={14}
                    color={active ? colors.white : colors.slate600}
                  />
                  <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
                    {tab.label}
                  </Text>
                  {tab.count !== undefined && (
                    <View
                      style={[
                        styles.tabCountBadge,
                        active ? styles.tabCountBadgeActive : styles.tabCountBadgeInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabCountText,
                          active ? styles.tabCountTextActive : styles.tabCountTextInactive,
                        ]}
                      >
                        {tab.count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Main List Area */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading shop data...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>{renderTabContent()}</View>
      )}

      {/* Futuristic FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setActionChoiceVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Action choices dialog */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={actionChoiceVisible}
        onRequestClose={() => setActionChoiceVisible(false)}
      >
        <TouchableOpacity
          style={styles.choiceOverlay}
          activeOpacity={1}
          onPress={() => setActionChoiceVisible(false)}
        >
          <View style={styles.choiceBox}>
            <View style={styles.choiceHeader}>
              <Text style={styles.choiceTitle}>Select Shop Action</Text>
              <TouchableOpacity onPress={() => setActionChoiceVisible(false)}>
                <Ionicons name="close" size={20} color={colors.slate400} />
              </TouchableOpacity>
            </View>

            {selectedShopId && (
              <>
                <TouchableOpacity
                  style={styles.choiceItem}
                  onPress={() => {
                    setActionChoiceVisible(false);
                    setPurchaseDate(new Date().toISOString().split('T')[0]);
                    setPurchaseModalVisible(true);
                  }}
                >
                  <View style={[styles.choiceIconCircle, { backgroundColor: colors.primarySurface }]}>
                    <Ionicons name="cart-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choiceText}>Record Purchase</Text>
                    <Text style={styles.choiceSubtext}>Add itemized purchase with bill photo</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.slate400} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.choiceItem}
                  onPress={() => {
                    setActionChoiceVisible(false);
                    setPaymentDate(new Date().toISOString().split('T')[0]);
                    setPaymentModalVisible(true);
                  }}
                >
                  <View style={[styles.choiceIconCircle, { backgroundColor: colors.successSurface }]}>
                    <Ionicons name="card-outline" size={20} color={colors.successText} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choiceText}>Record Payment</Text>
                    <Text style={styles.choiceSubtext}>Log cash, UPI or bank payment against dues</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.slate400} />
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.choiceItem, { borderBottomWidth: 0 }]}
              onPress={() => {
                setActionChoiceVisible(false);
                setShopModalVisible(true);
              }}
            >
              <View style={[styles.choiceIconCircle, { backgroundColor: colors.infoSurface }]}>
                <Ionicons name="storefront-outline" size={20} color={colors.infoText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceText}>Add New Shop</Text>
                <Text style={styles.choiceSubtext}>Register a new input supplier / merchant</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.slate400} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Shop Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={shopModalVisible}
        onRequestClose={() => setShopModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalKicker}>SUPPLIER REGISTRATION</Text>
                <Text style={styles.modalTitle}>Add New Agro Shop</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShopModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.inputLabel}>Shop Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Kisan Agro Agency"
                placeholderTextColor={colors.slate400}
                value={shopName}
                onChangeText={setShopName}
              />

              <Text style={styles.inputLabel}>Contact Person</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ramesh Patel"
                placeholderTextColor={colors.slate400}
                value={contactName}
                onChangeText={setContactName}
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. +91 98765 43210"
                placeholderTextColor={colors.slate400}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Market Yard, Station Road..."
                placeholderTextColor={colors.slate400}
                multiline
                numberOfLines={3}
                value={address}
                onChangeText={setAddress}
              />

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="GSTIN, bank details, credit terms..."
                placeholderTextColor={colors.slate400}
                multiline
                numberOfLines={3}
                value={shopNotes}
                onChangeText={setShopNotes}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setShopModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleSaveShop}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                  <Text style={styles.saveBtnText}>Save Shop</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Record Purchase Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={purchaseModalVisible}
        onRequestClose={() => setPurchaseModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalKicker}>INVENTORY ENTRY</Text>
                <Text style={styles.modalTitle}>Record Purchase</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setPurchaseModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.inputLabel}>Purchase Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2026-06-27"
                placeholderTextColor={colors.slate400}
                value={purchaseDate}
                onChangeText={setPurchaseDate}
              />

              {/* Items row list */}
              <View style={styles.itemsInputWrapper}>
                <View style={styles.itemsInputHeader}>
                  <Text style={styles.itemsSectionTitle}>Line Items</Text>
                  <TouchableOpacity
                    style={styles.headerAddLineBtn}
                    onPress={handleAddPurchaseItemLine}
                  >
                    <Ionicons name="add" size={14} color={colors.primary} />
                    <Text style={styles.headerAddLineText}>Add Line</Text>
                  </TouchableOpacity>
                </View>

                {purchaseItems.map((pItem, idx) => {
                  const lineTotal =
                    (parseFloat(pItem.quantity) || 0) * (parseFloat(pItem.unit_price) || 0);

                  return (
                    <View key={idx} style={styles.itemLineBlock}>
                      <View style={styles.itemLineHeader}>
                        <View style={styles.itemIndexBadge}>
                          <Text style={styles.itemIndexText}>#{idx + 1}</Text>
                        </View>
                        {lineTotal > 0 && (
                          <View style={styles.lineTotalBadge}>
                            <Text style={styles.lineTotalText}>₹{lineTotal.toFixed(2)}</Text>
                          </View>
                        )}
                        {purchaseItems.length > 1 && (
                          <TouchableOpacity
                            onPress={() => handleRemovePurchaseItemLine(idx)}
                            style={styles.removeLineBtn}
                          >
                            <Ionicons name="trash-outline" size={15} color={colors.danger} />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Product Selector */}
                      <Text style={styles.lineSubLabel}>Select Input Product *</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.lineProductSelect}
                      >
                        {inputProducts.map((prod) => {
                          const isSel = pItem.agro_input_product_id === prod.id.toString();
                          return (
                            <TouchableOpacity
                              key={prod.id}
                              style={[
                                styles.lineProductPill,
                                isSel && styles.lineProductPillActive,
                              ]}
                              onPress={() => {
                                const newItems = [...purchaseItems];
                                newItems[idx].agro_input_product_id = prod.id.toString();
                                setPurchaseItems(newItems);
                              }}
                            >
                              <Text
                                style={[
                                  styles.lineProductText,
                                  isSel && styles.lineProductTextActive,
                                ]}
                              >
                                {prod.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      {/* Qty, Unit, Unit Price */}
                      <View style={styles.lineInputRow}>
                        <View style={{ flex: 1, marginRight: spacing.xs }}>
                          <Text style={styles.lineSubLabel}>Quantity *</Text>
                          <TextInput
                            style={styles.lineInput}
                            placeholder="10"
                            placeholderTextColor={colors.slate400}
                            keyboardType="numeric"
                            value={pItem.quantity}
                            onChangeText={(text) => {
                              const newItems = [...purchaseItems];
                              newItems[idx].quantity = text;
                              setPurchaseItems(newItems);
                            }}
                          />
                        </View>

                        <View style={{ flex: 1.1, marginRight: spacing.xs }}>
                          <Text style={styles.lineSubLabel}>Unit *</Text>
                          <TextInput
                            style={styles.lineInput}
                            placeholder="BAG"
                            placeholderTextColor={colors.slate400}
                            value={pItem.unit}
                            onChangeText={(text) => {
                              const newItems = [...purchaseItems];
                              newItems[idx].unit = text;
                              setPurchaseItems(newItems);
                            }}
                          />
                        </View>

                        <View style={{ flex: 1.2 }}>
                          <Text style={styles.lineSubLabel}>Unit Rate (₹) *</Text>
                          <TextInput
                            style={styles.lineInput}
                            placeholder="500"
                            placeholderTextColor={colors.slate400}
                            keyboardType="numeric"
                            value={pItem.unit_price}
                            onChangeText={(text) => {
                              const newItems = [...purchaseItems];
                              newItems[idx].unit_price = text;
                              setPurchaseItems(newItems);
                            }}
                          />
                        </View>
                      </View>

                      {/* Unit Quick Chips */}
                      <View style={styles.unitChipContainer}>
                        {COMMON_UNITS.map((u) => (
                          <TouchableOpacity
                            key={u.value}
                            style={[
                              styles.miniUnitChip,
                              pItem.unit === u.value && styles.miniUnitChipActive,
                            ]}
                            onPress={() => {
                              const newItems = [...purchaseItems];
                              newItems[idx].unit = u.value;
                              setPurchaseItems(newItems);
                            }}
                          >
                            <Text
                              style={[
                                styles.miniUnitChipText,
                                pItem.unit === u.value && styles.miniUnitChipTextActive,
                              ]}
                            >
                              {u.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })}

                <TouchableOpacity
                  style={styles.addMoreLineBtn}
                  onPress={handleAddPurchaseItemLine}
                >
                  <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.addMoreLineBtnText}>Add Another Item</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Purchase Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Batch numbers, delivery terms, expiry dates..."
                placeholderTextColor={colors.slate400}
                multiline
                numberOfLines={3}
                value={purchaseNotes}
                onChangeText={setPurchaseNotes}
              />

              <View style={{ marginTop: spacing.md }}>
                <AttachmentPicker
                  label="Agro Shop Bill Photo / Invoice"
                  category="agro-shop-bills"
                  currentPath={purchaseBillPhotoPath}
                  currentUrl={purchaseBillPhotoUrl}
                  onAttachmentChange={(p, u) => {
                    setPurchaseBillPhotoPath(p);
                    setPurchaseBillPhotoUrl(u);
                  }}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setPurchaseModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleSavePurchase}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                  <Text style={styles.saveBtnText}>Save Purchase</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={paymentModalVisible}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalKicker}>LEDGER TRANSACTION</Text>
                <Text style={styles.modalTitle}>Record Payment</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setPaymentModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Linked Purchase Selector */}
              <Text style={styles.inputLabel}>Link to Specific Purchase (Optional)</Text>
              <View style={styles.pickerContainer}>
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    paymentPurchaseId === '' && styles.pickerItemActive,
                  ]}
                  onPress={() => setPaymentPurchaseId('')}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      paymentPurchaseId === '' && styles.pickerItemTextActive,
                    ]}
                  >
                    General (No Link)
                  </Text>
                </TouchableOpacity>
                {purchases
                  .filter((p) => p.balance > 0)
                  .map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.pickerItem,
                        paymentPurchaseId === p.id.toString() && styles.pickerItemActive,
                      ]}
                      onPress={() => setPaymentPurchaseId(p.id.toString())}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          paymentPurchaseId === p.id.toString() && styles.pickerItemTextActive,
                        ]}
                      >
                        Bill #{p.id} (Due: ₹{p.balance})
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>

              <Text style={styles.inputLabel}>Payment Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2026-06-27"
                placeholderTextColor={colors.slate400}
                value={paymentDate}
                onChangeText={setPaymentDate}
              />

              <Text style={styles.inputLabel}>Payment Amount (₹) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 5000"
                placeholderTextColor={colors.slate400}
                keyboardType="numeric"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
              />

              {/* Payment Method */}
              <Text style={styles.inputLabel}>Payment Method</Text>
              <View style={{ marginBottom: spacing.md }}>
                <QuickChipGroup
                  options={PAYMENT_METHODS}
                  selectedValue={paymentMethod}
                  onSelect={setPaymentMethod}
                />
              </View>

              <Text style={styles.inputLabel}>Payment Notes / UTR Ref</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Transaction ID, receiver details, or notes..."
                placeholderTextColor={colors.slate400}
                multiline
                numberOfLines={3}
                value={paymentNotes}
                onChangeText={setPaymentNotes}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setPaymentModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleSavePayment}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                  <Text style={styles.saveBtnText}>Save Payment</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 12,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    gap: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flex: 1,
  },
  headerKicker: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
  },
  headerTitle: {
    ...typography.title2,
    color: colors.slate900,
  },
  shopSelectorWrapper: {
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  shopSelectorContent: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  shopPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
    gap: 6,
  },
  shopPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.subtle,
  },
  shopPillText: {
    ...typography.caption,
    color: colors.slate700,
    fontWeight: '700',
  },
  shopPillTextActive: {
    color: colors.white,
  },
  duePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.xs,
  },
  duePillSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  duePillUnselected: {
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  duePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  duePillTextSelected: {
    color: colors.white,
  },
  duePillTextUnselected: {
    color: colors.dangerText,
  },
  noShopsInfoText: {
    ...typography.bodySmall,
    color: colors.slate500,
    fontStyle: 'italic',
  },
  summaryGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  summaryTile: {
    flex: 1,
  },
  tabContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.slate200,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
    ...shadows.subtle,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate700,
  },
  tabBtnTextActive: {
    color: colors.white,
  },
  tabCountBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  tabCountBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabCountBadgeInactive: {
    backgroundColor: colors.white,
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tabCountTextActive: {
    color: colors.white,
  },
  tabCountTextInactive: {
    color: colors.slate600,
  },
  tabListContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 90,
  },
  listHeaderWrapper: {
    paddingVertical: spacing.sm,
  },
  searchBar: {
    marginBottom: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
  purchaseCard: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardDate: {
    ...typography.caption,
    color: colors.slate600,
  },
  cardGrid: {
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
  gridCellLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.slate400,
  },
  gridCellValue: {
    ...typography.title3,
    color: colors.slate900,
    marginTop: 2,
  },
  itemsListContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  itemsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  itemsListHeader: {
    ...typography.caption,
    fontSize: 11,
    color: colors.slate600,
    fontWeight: '800',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  itemNameText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.slate800,
  },
  itemQtyText: {
    ...typography.bodySmall,
    color: colors.slate500,
    marginTop: 1,
  },
  itemAmountBadge: {
    backgroundColor: colors.slate100,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  itemAmountText: {
    ...typography.caption,
    color: colors.slate900,
    fontWeight: '800',
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
  purchaseNotes: {
    ...typography.bodySmall,
    color: colors.slate600,
    flex: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    paddingTop: spacing.sm,
    marginTop: 2,
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
  },
  attachmentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  deleteCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    gap: 4,
  },
  deleteCardBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.dangerText,
  },
  paymentCard: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentDate: {
    ...typography.caption,
    color: colors.slate600,
  },
  methodTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  paymentMethod: {
    ...typography.caption,
    color: colors.slate600,
    fontSize: 11,
  },
  amountPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.successBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  amountPillPrefix: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.successText,
    marginRight: 2,
  },
  paymentAmount: {
    ...typography.title2,
    fontWeight: '900',
    color: colors.successText,
  },
  paymentNotes: {
    ...typography.bodySmall,
    color: colors.slate600,
    flex: 1,
  },
  paymentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoTabContainer: {
    padding: spacing.lg,
    paddingBottom: 90,
  },
  shopProfileCard: {
    gap: spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  profileKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  profileKicker: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
  },
  profileName: {
    ...typography.title1,
    color: colors.slate900,
  },
  profileDetailsList: {
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  profileKeyCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 100,
  },
  profileKey: {
    ...typography.caption,
    color: colors.slate500,
    fontSize: 11,
  },
  profileValue: {
    ...typography.body,
    flex: 1,
    textAlign: 'right',
    color: colors.slate800,
    fontWeight: '600',
  },
  profileStatusToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  statusToggleLabel: {
    ...typography.title3,
    color: colors.slate900,
  },
  statusToggleSubLabel: {
    ...typography.bodySmall,
    color: colors.slate500,
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
  choiceOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  choiceBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadows.medium,
  },
  choiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  choiceTitle: {
    ...typography.title2,
    color: colors.slate900,
  },
  choiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
    gap: spacing.md,
  },
  choiceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    ...typography.title3,
    color: colors.slate800,
  },
  choiceSubtext: {
    ...typography.bodySmall,
    color: colors.slate500,
    marginTop: 1,
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
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  pickerItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  pickerItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pickerItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
  },
  pickerItemTextActive: {
    color: colors.white,
  },
  itemsInputWrapper: {
    marginTop: spacing.lg,
    backgroundColor: colors.slate50,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    gap: spacing.md,
  },
  itemsInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemsSectionTitle: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.slate800,
  },
  headerAddLineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.xs,
    backgroundColor: colors.primarySurface,
  },
  headerAddLineText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  itemLineBlock: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    gap: spacing.xs,
  },
  itemLineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  itemIndexBadge: {
    backgroundColor: colors.slate100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  itemIndexText: {
    ...typography.caption,
    color: colors.slate600,
    fontWeight: '800',
  },
  lineTotalBadge: {
    backgroundColor: colors.primarySurface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  lineTotalText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  removeLineBtn: {
    padding: 4,
  },
  lineSubLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.slate500,
    marginTop: 4,
  },
  lineProductSelect: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: 4,
  },
  lineProductPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  lineProductPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  lineProductText: {
    fontSize: 11,
    color: colors.slate700,
    fontWeight: '600',
  },
  lineProductTextActive: {
    color: colors.white,
  },
  lineInputRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  lineInput: {
    height: 42,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    fontSize: 14,
    color: colors.slate900,
    backgroundColor: colors.slate50,
  },
  unitChipContainer: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  miniUnitChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  miniUnitChipActive: {
    backgroundColor: colors.slate800,
    borderColor: colors.slate800,
  },
  miniUnitChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.slate600,
  },
  miniUnitChipTextActive: {
    color: colors.white,
  },
  addMoreLineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radius.md,
    gap: 6,
  },
  addMoreLineBtnText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
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
});
