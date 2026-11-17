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
  Platform,
  KeyboardAvoidingView,
  Image,
  StatusBar,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { salesApi } from '../src/api/sales';
import { Sale } from '../src/types';
import { extractErrorMessage, getBaseUrl } from '../src/api/client';
import { useAuth } from '../src/hooks/useAuth';
import { permissions } from '../src/utils/permissions';
import { colors, radius, spacing, shadows } from '../src/theme/tokens';
import { useTranslation } from '../src/i18n/I18nContext';
import { useResponsive } from '../src/utils/responsive';
import { formatCurrency, formatQuantity } from '../src/utils/formatters';
import { useToast } from '../src/context/ToastContext';
import { ModalSheet, ModernInput, ConfirmModal } from '../src/components/ui';

export const getAbsoluteImageUrl = (urlPath?: string | null) => {
  if (!urlPath) return undefined;
  if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) {
    return urlPath;
  }
  const apiBase = getBaseUrl().replace('/api', '');
  return `${apiBase}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
};

export default function SaleViewScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const params = useLocalSearchParams();
  const saleIdentifier = (params.sale_ulid as string) || (params.sale_id as string);
  const { containerMaxWidth, isTablet } = useResponsive();

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Confirm delete modal state
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editBuyerName, setEditBuyerName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Grades Modal State
  const [gradesModalVisible, setGradesModalVisible] = useState(false);
  const [modalHasGrades, setModalHasGrades] = useState(false);
  const [gradeRows, setGradeRows] = useState<{
    id?: number | string;
    grade_name: string;
    quantity: string;
    rate: string;
  }[]>([]);
  const [savingGrades, setSavingGrades] = useState(false);

  // Charges Modal State
  const [chargesModalVisible, setChargesModalVisible] = useState(false);
  const [chargeRows, setChargeRows] = useState<{
    id?: number | string;
    charge_name: string;
    type: 'flat' | 'percentage';
    value: string;
    applies_on: 'gross' | 'final';
  }[]>([]);
  const [savingCharges, setSavingCharges] = useState(false);

  const fetchSale = useCallback(async () => {
    if (!saleIdentifier) return;
    try {
      const data = await salesApi.getById(saleIdentifier);
      setSale(data);
      setEditBuyerName(data.buyer_name || '');
      setEditQuantity(data.total_quantity ? data.total_quantity.toString() : '');
      setEditRate(data.rate ? data.rate.toString() : '');
      setEditNotes(data.notes || '');
    } catch (error) {
      console.error('Error fetching sale:', error);
      Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to load sale details.')));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [saleIdentifier, t]);

  useEffect(() => {
    fetchSale();
  }, [fetchSale]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSale();
  };

  const handleSaveEdit = async () => {
    if (!sale) return;
    if (!editQuantity || isNaN(parseFloat(editQuantity))) {
      Alert.alert(t('Validation Error'), t('Please enter a valid quantity.'));
      return;
    }
    if (!editRate || isNaN(parseFloat(editRate))) {
      Alert.alert(t('Validation Error'), t('Please enter a valid rate.'));
      return;
    }

    const identifier = sale.ulid || sale.id!;
    try {
      setSaving(true);
      const updated = await salesApi.updateSale(identifier, {
        buyer_name: editBuyerName,
        total_quantity: parseFloat(editQuantity),
        rate: parseFloat(editRate),
        notes: editNotes,
      });
      setSale(updated);
      setEditModalVisible(false);
      showToast(t('Sale updated successfully!'), { type: 'success' });
    } catch (error) {
      console.error('Error updating sale:', error);
      Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to update sale.')));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSale = () => {
    if (!sale) return;
    setDeleteConfirmVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!sale) return;
    const identifier = sale.ulid || sale.id!;
    try {
      setDeleting(true);
      await salesApi.deleteSale(identifier);
      showToast(t('Sale record has been deleted.'), { type: 'success' });
      setDeleteConfirmVisible(false);
      router.back();
    } catch (error) {
      console.error('Error deleting sale:', error);
      Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to delete sale.')));
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenGradesModal = () => {
    if (!sale) return;
    setModalHasGrades(Boolean(sale.has_grades));
    if (sale.grades && sale.grades.length > 0) {
      setGradeRows(
        sale.grades.map((g) => ({
          id: g.id,
          grade_name: g.grade_name || 'A',
          quantity: g.quantity ? g.quantity.toString() : '',
          rate: g.rate ? g.rate.toString() : '',
        }))
      );
    } else {
      setGradeRows([
        { grade_name: 'A', quantity: '', rate: '' },
        { grade_name: 'B', quantity: '', rate: '' },
      ]);
    }
    setGradesModalVisible(true);
  };

  const handleOpenChargesModal = () => {
    if (!sale) return;
    if (sale.charges && sale.charges.length > 0) {
      setChargeRows(
        sale.charges.map((c) => ({
          id: c.id,
          charge_name: c.charge_name,
          type: (c.type === 'percent' || c.type === 'percentage') ? 'percentage' : 'flat',
          value: c.value ? c.value.toString() : '',
          applies_on: c.applies_on === 'final' ? 'final' : 'gross',
        }))
      );
    } else {
      setChargeRows([
        { charge_name: 'Mandi Cess / Market Fee', type: 'percentage', value: '1.5', applies_on: 'gross' },
        { charge_name: 'Hamali / Labour', type: 'flat', value: '', applies_on: 'gross' },
      ]);
    }
    setChargesModalVisible(true);
  };

  const handleSaveGrades = async () => {
    if (!sale) return;
    const identifier = sale.ulid || sale.id!;
    try {
      setSavingGrades(true);
      if (!modalHasGrades) {
        const updated = await salesApi.updateSale(identifier, {
          has_grades: false,
          grades: [],
        });
        setSale(updated);
        setGradesModalVisible(false);
        showToast(t('Quality grades disabled.'), { type: 'info' });
        return;
      }

      const validRows = gradeRows.filter(
        (r) => r.grade_name.trim() && parseFloat(r.quantity) > 0 && parseFloat(r.rate) > 0
      );

      if (validRows.length === 0) {
        Alert.alert(t('Validation Error'), t('Please add at least one valid grade row with quantity and rate.'));
        return;
      }

      const updated = await salesApi.updateSale(identifier, {
        has_grades: true,
        grades: validRows.map((r) => ({
          grade_name: r.grade_name,
          quantity: parseFloat(r.quantity),
          rate: parseFloat(r.rate),
        })),
      });
      setSale(updated);
      setGradesModalVisible(false);
      showToast(t('Quality grades updated successfully!'), { type: 'success' });
    } catch (error) {
      console.error('Error saving grades:', error);
      Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to update quality grades.')));
    } finally {
      setSavingGrades(false);
    }
  };

  const handleSaveCharges = async () => {
    if (!sale) return;
    const identifier = sale.ulid || sale.id!;
    try {
      setSavingCharges(true);
      const validRows = chargeRows.filter(
        (r) => r.charge_name.trim() && parseFloat(r.value) >= 0
      );

      const updated = await salesApi.updateSale(identifier, {
        charges: validRows.map((r) => ({
          charge_name: r.charge_name.trim(),
          type: r.type,
          value: parseFloat(r.value),
          applies_on: r.applies_on,
        })),
      });
      setSale(updated);
      setChargesModalVisible(false);
      showToast(t('Mandi deductions updated successfully!'), { type: 'success' });
    } catch (error) {
      console.error('Error saving charges:', error);
      Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to update deductions.')));
    } finally {
      setSavingCharges(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>{t('Loading sale details...')}</Text>
      </View>
    );
  }

  if (!sale) {
    return (
      <View style={styles.centerBox}>
        <Ionicons name="alert-circle-outline" size={48} color="#94a3b8" />
        <Text style={styles.notFoundText}>{t('Sale record not found.')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{t('Go Back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const finalAmount = parseFloat((sale.final_amount ?? sale.gross_total ?? 0).toString());
  const grossAmount = parseFloat((sale.gross_total ?? 0).toString());
  const deductionsTotal = parseFloat((sale.charges_total ?? 0).toString());
  const totalQuantity = parseFloat((sale.total_quantity ?? 0).toString());
  const rate = parseFloat((sale.rate ?? 0).toString());
  const unit = sale.quantity_unit || 'kg';
  const charges = sale.charges || [];

  const farmName = (sale as any).farm?.name || t('Farm');
  const cropName = (sale as any).crop?.name || t('Produce');
  const cycleName = (sale as any).crop_cycle?.season_name || (sale as any).crop_cycle?.crop_name || '';

  const billUrl = getAbsoluteImageUrl((sale as any).bill_photo_url || sale.bill_photo_path);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <View style={[styles.mainWrapper, { maxWidth: containerMaxWidth }]}>
        {/* Top Sticky Header */}
        <View style={styles.topStickyBar}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityLabel={t('Back')}
          >
            <Ionicons name="arrow-back" size={20} color="#166534" />
          </TouchableOpacity>

          <Text style={styles.topBarTitle}>{t('Sale Details')}</Text>

          {permissions.canManageCommercials(user) ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.7}
              accessibilityLabel={t('Edit Sale')}
            >
              <Ionicons name="create-outline" size={20} color="#166534" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
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
          {/* 1. Hero Card */}
          <View style={[styles.card, styles.heroCard]}>
            <Text style={styles.heroLabel}>
              {permissions.canViewFinancials(user) ? t('FINAL SALE VALUE') : t('SALE RECORD')}
            </Text>
            <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {permissions.canViewFinancials(user) ? formatCurrency(finalAmount) : formatQuantity(totalQuantity, unit)}
            </Text>

            <View style={styles.heroChipsRow}>
              <View style={styles.heroChip}>
                <Ionicons name="calendar-outline" size={13} color="#166534" />
                <Text style={styles.heroChipText}>{sale.date ? sale.date.split('T')[0] : 'N/A'}</Text>
              </View>

              <View style={styles.heroChip}>
                <Ionicons name="person-outline" size={13} color="#166534" />
                <Text style={styles.heroChipText}>{sale.buyer_name || t('Buyer')}</Text>
              </View>
            </View>
          </View>

          {/* 2. Farm & Crop Info Card */}
          <View style={styles.card}>
            <View style={styles.infoLinkRow}>
              <View style={styles.infoLinkIconBox}>
                <Ionicons name="location-outline" size={18} color="#166534" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLinkLabel}>{t('FARM')}</Text>
                <Text style={styles.infoLinkValue}>{farmName}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoLinkRow}>
              <View style={styles.infoLinkIconBox}>
                <Ionicons name="sparkles-outline" size={18} color="#166534" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLinkLabel}>{t('CROP (SEASON)')}</Text>
                <Text style={styles.infoLinkValue}>
                  {cropName} {cycleName ? `(${cycleName})` : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* 3. Sale Details Card */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="archive-outline" size={18} color="#166534" />
              <Text style={styles.sectionTitle}>{t('Sale Details')}</Text>
            </View>

            <View style={styles.produceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.produceTitle}>{t('Total Produce')}</Text>
                <Text style={styles.produceSub}>
                  {formatQuantity(totalQuantity, unit)}
                  {permissions.canViewFinancials(user) ? ` @ ${formatCurrency(rate)}/${unit}` : ''}
                </Text>
              </View>
              {permissions.canViewFinancials(user) && (
                <Text style={styles.produceAmount}>{formatCurrency(grossAmount)}</Text>
              )}
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricCell}>
                <Text style={styles.metricLabel}>{t('QUANTITY')}</Text>
                <Text style={styles.metricVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {formatQuantity(totalQuantity, unit)}
                </Text>
              </View>
              {permissions.canViewFinancials(user) && (
                <>
                  <View style={styles.metricCell}>
                    <Text style={styles.metricLabel}>{t('AVG RATE')}</Text>
                    <Text style={styles.metricVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                      {formatCurrency(rate)}
                    </Text>
                  </View>
                  <View style={styles.metricCell}>
                    <Text style={styles.metricLabel}>{t('GROSS AMOUNT')}</Text>
                    <Text style={[styles.metricVal, { color: '#166534' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                      {formatCurrency(grossAmount)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

        {/* Quality Grades Breakdown */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderBetween}>
            <View style={styles.row}>
              <Ionicons name="ribbon-outline" size={18} color="#059669" />
              <Text style={[styles.sectionTitle, { color: '#059669' }]}>
                {t('Quality Grades Breakdown')}
              </Text>
              {sale.has_grades && sale.grades && sale.grades.length > 0 ? (
                <View style={[styles.countBadge, { backgroundColor: '#ecfdf5' }]}>
                  <Text style={[styles.countBadgeText, { color: '#059669' }]}>{sale.grades.length}</Text>
                </View>
              ) : null}
            </View>
            {permissions.canManageCommercials(user) && (
              <TouchableOpacity
                style={styles.miniActionBtn}
                onPress={handleOpenGradesModal}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={13} color="#059669" />
                <Text style={[styles.miniActionText, { color: '#059669' }]}>
                  {sale.has_grades && sale.grades && sale.grades.length > 0 ? t('Edit') : t('+ Add')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {sale.has_grades && sale.grades && sale.grades.length > 0 ? (
            <View style={styles.deductionList}>
              {sale.grades.map((g, idx) => {
                const gradeLabel = g.grade_name ? g.grade_name.toUpperCase().replace('_', '+') : `#${idx + 1}`;
                return (
                  <View key={g.id || idx} style={styles.deductionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.deductionName}>{t('Grade')} {gradeLabel}</Text>
                      <Text style={styles.produceSub}>
                        {g.quantity} {unit}
                        {permissions.canViewFinancials(user) ? ` @ ₹${g.rate}/${unit}` : ''}
                      </Text>
                    </View>
                    {permissions.canViewFinancials(user) && (
                      <Text style={[styles.deductionVal, { color: '#0f172a' }]}>
                        ₹{(g.amount ? parseFloat(g.amount.toString()) : (g.quantity * g.rate)).toFixed(2)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              {t('Standard single-rate sale. Tap + Add to record itemized grade breakdown.')}
            </Text>
          )}
        </View>

        {/* 4. Mandi Deductions Card */}
        {permissions.canViewFinancials(user) && (
          <View style={styles.card}>
            <View style={styles.sectionHeaderBetween}>
              <View style={styles.row}>
                <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
                <Text style={[styles.sectionTitle, { color: '#dc2626' }]}>{t('Mandi Deductions')}</Text>
                {charges.length > 0 ? (
                  <View style={[styles.countBadge, { backgroundColor: '#fef2f2' }]}>
                    <Text style={[styles.countBadgeText, { color: '#dc2626' }]}>{charges.length}</Text>
                  </View>
                ) : null}
              </View>
              {permissions.canManageCommercials(user) && (
                <TouchableOpacity
                  style={[styles.miniActionBtn, { borderColor: '#fecaca', backgroundColor: '#fef2f2' }]}
                  onPress={handleOpenChargesModal}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={13} color="#dc2626" />
                  <Text style={[styles.miniActionText, { color: '#dc2626' }]}>
                    {charges.length > 0 ? t('Edit') : t('+ Add')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {charges.length > 0 ? (
              <View style={styles.deductionList}>
                {charges.map((c, i) => (
                  <View key={i} style={styles.deductionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.deductionName}>{c.charge_name}</Text>
                      {c.type === 'percentage' || c.type === 'percent' ? (
                        <Text style={[styles.produceSub, { fontSize: 11 }]}>
                          {c.value}% on {c.applies_on || 'gross'}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.deductionVal}>
                      - ₹{parseFloat(c.value.toString()).toFixed(2)}
                    </Text>
                  </View>
                ))}

                <View style={styles.deductionSummaryRow}>
                  <Text style={styles.deductionSummaryLabel}>{t('Total Deductions')}</Text>
                  <Text style={styles.deductionSummaryVal}>- ₹{deductionsTotal.toFixed(2)}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>
                {t('No deductions or mandi charges recorded. Tap + Add to apply charges.')}
              </Text>
            )}
          </View>
        )}

        {/* 5. Final Summary Card */}
        {permissions.canViewFinancials(user) && (
          <View style={[styles.card, styles.finalSummaryCard]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calculator-outline" size={18} color="#14532d" />
              <Text style={[styles.sectionTitle, { color: '#14532d' }]}>{t('Final Summary')}</Text>
            </View>

            <View style={styles.finalRow}>
              <Text style={styles.finalKey}>{t('Total Sale Amount')}</Text>
              <Text style={styles.finalVal}>₹{grossAmount.toFixed(2)}</Text>
            </View>

            {deductionsTotal > 0 ? (
              <View style={styles.finalRow}>
                <Text style={[styles.finalKey, { color: '#ef4444' }]}>{t('Total Deductions')}</Text>
                <Text style={[styles.finalVal, { color: '#ef4444' }]}>- ₹{deductionsTotal.toFixed(2)}</Text>
              </View>
            ) : null}

            <View style={styles.finalTotalRow}>
              <Text style={styles.finalTotalKey}>{t('Final Amount')}</Text>
              <Text style={styles.finalTotalVal}>₹{finalAmount.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* 6. Notes Card */}
        {sale.notes ? (
          <View style={styles.card}>
            <View style={styles.notesWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#166534" style={{ marginTop: 2 }} />
              <Text style={styles.notesText}>{sale.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* 7. Bill Image Preview */}
        {billUrl ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="attach-outline" size={18} color="#166534" />
              <Text style={styles.sectionTitle}>{t('Original Bill / Receipt')}</Text>
            </View>
            <View style={styles.billImageContainer}>
              <Image source={{ uri: billUrl }} style={styles.billImage} resizeMode="cover" />
            </View>
          </View>
        ) : null}

        {/* Bottom Actions */}
        {(permissions.canManageCommercials(user) || permissions.canAccessDangerZone(user)) && (
          <View style={styles.bottomActions}>
            {permissions.canManageCommercials(user) && (
              <TouchableOpacity
                style={styles.outlineActionBtn}
                onPress={() => setEditModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={18} color="#166534" />
                <Text style={styles.outlineActionText}>{t('Edit Sale')}</Text>
              </TouchableOpacity>
            )}

            {permissions.canAccessDangerZone(user) && (
              <TouchableOpacity
                style={styles.dangerActionBtn}
                onPress={handleDeleteSale}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color="#dc2626" />
                <Text style={styles.dangerActionText}>{t('Delete Record')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
      </View>

      {/* Edit Sale Modal */}
      <ModalSheet
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        title={t('Edit Sale')}
        maxHeight="85%"
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <ModernInput
            label={t('Buyer Name')}
            value={editBuyerName}
            onChangeText={setEditBuyerName}
            placeholder={t('Buyer Name or APMC Mandi')}
            placeholderTextColor="#94a3b8"
            containerStyle={{ marginBottom: spacing.md }}
          />

          <ModernInput
            label={`${t('Total Quantity')} (${unit})`}
            value={editQuantity}
            onChangeText={setEditQuantity}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            suffix={<Text style={{ color: '#64748b', fontSize: 13, fontWeight: '600', marginLeft: 4 }}>{unit}</Text>}
            containerStyle={{ marginBottom: spacing.md }}
          />

          <ModernInput
            label={`${t('Rate')} (₹ / ${unit})`}
            value={editRate}
            onChangeText={setEditRate}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            prefix={<Text style={{ color: '#059669', fontWeight: '700', marginRight: 4 }}>₹</Text>}
            containerStyle={{ marginBottom: spacing.md }}
          />

          <ModernInput
            label={t('Notes')}
            value={editNotes}
            onChangeText={setEditNotes}
            placeholder={t('Remarks, invoice details...')}
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
            containerStyle={{ marginBottom: spacing.md }}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setEditModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>{t('Cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={handleSaveEdit}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalSaveText}>{t('Save Changes')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ModalSheet>

      {/* Manage Quality Grades Modal */}
      <ModalSheet
        visible={gradesModalVisible}
        onClose={() => setGradesModalVisible(false)}
        title={t('Quality Grades Breakdown')}
        maxHeight="88%"
      >
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>{t('Enable Quality Grading')}</Text>
              <Text style={styles.toggleSub}>{t('Record multiple quality tiers at different rates')}</Text>
            </View>
            <Switch
              value={modalHasGrades}
              onValueChange={setModalHasGrades}
              trackColor={{ false: '#cbd5e1', true: '#86efac' }}
              thumbColor={modalHasGrades ? '#16a34a' : '#f8fafc'}
            />
          </View>

          {modalHasGrades && (
            <View style={{ marginTop: spacing.md }}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionSubTitle}>{t('Grade Tiers')}</Text>
                <TouchableOpacity
                  style={styles.addLineBtn}
                  onPress={() => setGradeRows([...gradeRows, { grade_name: 'Grade', quantity: '', rate: '' }])}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={14} color="#166534" />
                  <Text style={styles.addLineText}>{t('Add Tier')}</Text>
                </TouchableOpacity>
              </View>

              {gradeRows.map((row, idx) => {
                const rowTotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.rate) || 0);
                return (
                  <View key={idx} style={styles.editorItemCard}>
                    <View style={styles.editorItemHead}>
                      <Text style={styles.editorItemIndex}>Tier #{idx + 1}</Text>
                      {rowTotal > 0 && (
                        <Text style={styles.editorItemAmount}>₹{rowTotal.toFixed(2)}</Text>
                      )}
                      {gradeRows.length > 1 && (
                        <TouchableOpacity
                          onPress={() => setGradeRows(gradeRows.filter((_, i) => i !== idx))}
                          style={{ padding: 4 }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={16} color="#dc2626" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={styles.inputMiniLabel}>{t('Grade Name')}</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={row.grade_name}
                      onChangeText={(text) => {
                        const newRows = [...gradeRows];
                        newRows[idx].grade_name = text;
                        setGradeRows(newRows);
                      }}
                      placeholder="e.g. A+, A, B, Rejection"
                      placeholderTextColor="#94a3b8"
                    />
                    <View style={styles.chipQuickRow}>
                      {['A+', 'A', 'B+', 'B', 'C', 'Reject'].map((preset) => (
                        <TouchableOpacity
                          key={preset}
                          style={[
                            styles.quickChip,
                            row.grade_name === preset && styles.quickChipActive,
                          ]}
                          onPress={() => {
                            const newRows = [...gradeRows];
                            newRows[idx].grade_name = preset;
                            setGradeRows(newRows);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.quickChipText,
                              row.grade_name === preset && styles.quickChipTextActive,
                            ]}
                          >
                            {preset}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.rowTwoCols}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputMiniLabel}>{t('Quantity')} ({unit})</Text>
                        <TextInput
                          style={styles.inputSmall}
                          value={row.quantity}
                          onChangeText={(text) => {
                            const newRows = [...gradeRows];
                            newRows[idx].quantity = text;
                            setGradeRows(newRows);
                          }}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor="#94a3b8"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputMiniLabel}>{t('Rate')} (₹/{unit})</Text>
                        <TextInput
                          style={styles.inputSmall}
                          value={row.rate}
                          onChangeText={(text) => {
                            const newRows = [...gradeRows];
                            newRows[idx].rate = text;
                            setGradeRows(newRows);
                          }}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor="#94a3b8"
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setGradesModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>{t('Cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={handleSaveGrades}
              disabled={savingGrades}
              activeOpacity={0.7}
            >
              {savingGrades ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalSaveText}>{t('Save Grades')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ModalSheet>

      {/* Manage Mandi Deductions Modal */}
      <ModalSheet
        visible={chargesModalVisible}
        onClose={() => setChargesModalVisible(false)}
        title={t('Mandi Deductions & Charges')}
        maxHeight="88%"
      >
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionSubTitle}>{t('Deduction Entries')}</Text>
            <TouchableOpacity
              style={styles.addLineBtn}
              onPress={() =>
                setChargeRows([
                  ...chargeRows,
                  { charge_name: '', type: 'flat', value: '', applies_on: 'gross' },
                ])
              }
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={14} color="#166534" />
              <Text style={styles.addLineText}>{t('Add Charge')}</Text>
            </TouchableOpacity>
          </View>

          {chargeRows.map((charge, idx) => (
            <View key={idx} style={styles.editorItemCard}>
              <View style={styles.editorItemHead}>
                <Text style={styles.editorItemIndex}>Charge #{idx + 1}</Text>
                <TouchableOpacity
                  onPress={() => setChargeRows(chargeRows.filter((_, i) => i !== idx))}
                  style={{ padding: 4 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color="#dc2626" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputMiniLabel}>{t('Charge Name')}</Text>
              <TextInput
                style={styles.inputSmall}
                value={charge.charge_name}
                onChangeText={(text) => {
                  const newRows = [...chargeRows];
                  newRows[idx].charge_name = text;
                  setChargeRows(newRows);
                }}
                placeholder="e.g. Mandi Cess, Hamali, Weighing"
                placeholderTextColor="#94a3b8"
              />
              <View style={styles.chipQuickRow}>
                {['Mandi Cess', 'Commission', 'Hamali / Labour', 'Weighing', 'Transport'].map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.quickChip,
                      charge.charge_name === preset && styles.quickChipActive,
                    ]}
                    onPress={() => {
                      const newRows = [...chargeRows];
                      newRows[idx].charge_name = preset;
                      setChargeRows(newRows);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.quickChipText,
                        charge.charge_name === preset && styles.quickChipTextActive,
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.rowTwoCols}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputMiniLabel}>{t('Type')}</Text>
                  <View style={styles.typeSegmentRow}>
                    <TouchableOpacity
                      style={[
                        styles.typeSegmentBtn,
                        charge.type === 'flat' && styles.typeSegmentBtnActive,
                      ]}
                      onPress={() => {
                        const newRows = [...chargeRows];
                        newRows[idx].type = 'flat';
                        setChargeRows(newRows);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.typeSegmentText,
                          charge.type === 'flat' && styles.typeSegmentTextActive,
                        ]}
                      >
                        Fixed (₹)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeSegmentBtn,
                        charge.type === 'percentage' && styles.typeSegmentBtnActive,
                      ]}
                      onPress={() => {
                        const newRows = [...chargeRows];
                        newRows[idx].type = 'percentage';
                        setChargeRows(newRows);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.typeSegmentText,
                          charge.type === 'percentage' && styles.typeSegmentTextActive,
                        ]}
                      >
                        Percent (%)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputMiniLabel}>
                    {charge.type === 'percentage' ? t('Rate (%)') : t('Amount (₹)')}
                  </Text>
                  <TextInput
                    style={styles.inputSmall}
                    value={charge.value}
                    onChangeText={(text) => {
                      const newRows = [...chargeRows];
                      newRows[idx].value = text;
                      setChargeRows(newRows);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
            </View>
          ))}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setChargesModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>{t('Cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={handleSaveCharges}
              disabled={savingCharges}
              activeOpacity={0.7}
            >
              {savingCharges ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalSaveText}>{t('Save Deductions')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ModalSheet>

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
  heroCard: {
    alignItems: 'center',
    paddingVertical: 22,
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.8,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#14532d',
    marginTop: 6,
  },
  heroChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 5,
  },
  heroChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  infoLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLinkIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLinkLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  infoLinkValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
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
  produceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 12,
  },
  produceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  produceSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  produceAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#166534',
  },
  metricsGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    gap: 8,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  deductionList: {
    gap: 8,
  },
  deductionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  deductionName: {
    fontSize: 13,
    color: '#b91c1c',
  },
  deductionVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b91c1c',
  },
  deductionSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#fee2e2',
    paddingTop: 8,
    marginTop: 4,
  },
  deductionSummaryLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  deductionSummaryVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#b91c1c',
  },
  finalSummaryCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  finalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  finalKey: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  finalVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  finalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    borderStyle: 'dashed',
    paddingTop: 10,
    marginTop: 6,
  },
  finalTotalKey: {
    fontSize: 15,
    fontWeight: '800',
    color: '#166534',
  },
  finalTotalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#166534',
  },
  notesWrap: {
    flexDirection: 'row',
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#16a34a',
    paddingLeft: 10,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    fontStyle: 'italic',
    color: '#475569',
    lineHeight: 18,
  },
  billImageContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 160,
  },
  billImage: {
    width: '100%',
    height: '100%',
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
  sectionHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionSubTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  miniActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  miniActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  toggleSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  addLineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#f0fdf4',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  addLineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  editorItemCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 10,
  },
  editorItemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  editorItemIndex: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  editorItemAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  inputMiniLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 6,
    marginBottom: 4,
  },
  inputSmall: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  chipQuickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  quickChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickChipActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#86efac',
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  quickChipTextActive: {
    color: '#15803d',
    fontWeight: '800',
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  typeSegmentRow: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    padding: 2,
  },
  typeSegmentBtn: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    borderRadius: 6,
  },
  typeSegmentBtnActive: {
    backgroundColor: '#ffffff',
    ...shadows.subtle,
  },
  typeSegmentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  typeSegmentTextActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
    paddingVertical: 4,
  },
});
