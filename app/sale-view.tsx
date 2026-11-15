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
  Image,
  StatusBar,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { salesApi } from '../src/api/sales';
import { Sale } from '../src/types';
import { extractErrorMessage, getBaseUrl } from '../src/api/client';
import { useAuth } from '../src/hooks/useAuth';
import { permissions } from '../src/utils/permissions';
import { colors, radius, spacing, shadows } from '../src/theme/tokens';
import { useTranslation } from '../src/i18n/I18nContext';

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
  const params = useLocalSearchParams();
  const saleIdentifier = (params.sale_ulid as string) || (params.sale_id as string);

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editBuyerName, setEditBuyerName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

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
      Alert.alert(t('Success'), t('Sale updated successfully!'));
    } catch (error) {
      console.error('Error updating sale:', error);
      Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to update sale.')));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSale = () => {
    if (!sale) return;
    const identifier = sale.ulid || sale.id!;
    Alert.alert(
      t('Delete Sale Record'),
      t('Are you sure you want to delete this sale record? This action cannot be undone.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await salesApi.deleteSale(identifier);
              Alert.alert(t('Deleted'), t('Sale record has been deleted.'));
              router.back();
            } catch (error) {
              console.error('Error deleting sale:', error);
              Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to delete sale.')));
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

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
          <Text style={styles.heroAmount}>
            {permissions.canViewFinancials(user) ? `₹${finalAmount.toFixed(2)}` : `${totalQuantity.toFixed(2)} ${unit}`}
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
                {totalQuantity.toFixed(2)} {unit}
                {permissions.canViewFinancials(user) ? ` @ ₹${rate.toFixed(2)}/${unit}` : ''}
              </Text>
            </View>
            {permissions.canViewFinancials(user) && (
              <Text style={styles.produceAmount}>₹{grossAmount.toFixed(2)}</Text>
            )}
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>{t('QUANTITY')}</Text>
              <Text style={styles.metricVal}>{totalQuantity.toFixed(2)} {unit}</Text>
            </View>
            {permissions.canViewFinancials(user) && (
              <>
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>{t('AVG RATE')}</Text>
                  <Text style={styles.metricVal}>₹{rate.toFixed(2)}</Text>
                </View>
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>{t('GROSS AMOUNT')}</Text>
                  <Text style={[styles.metricVal, { color: '#166534' }]}>₹{grossAmount.toFixed(2)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Quality Grades Breakdown (if graded) */}
        {sale.has_grades && sale.grades && sale.grades.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="ribbon-outline" size={18} color="#059669" />
              <Text style={[styles.sectionTitle, { color: '#059669' }]}>{t('Quality Grades Breakdown')}</Text>
            </View>

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
          </View>
        ) : null}

        {/* 4. Deductions Card (if any) */}
        {charges.length > 0 && permissions.canViewFinancials(user) ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
              <Text style={[styles.sectionTitle, { color: '#dc2626' }]}>{t('Deductions')}</Text>
            </View>

            <View style={styles.deductionList}>
              {charges.map((c, i) => (
                <View key={i} style={styles.deductionRow}>
                  <Text style={styles.deductionName}>{c.charge_name}</Text>
                  <Text style={styles.deductionVal}>- ₹{parseFloat(c.value.toString()).toFixed(2)}</Text>
                </View>
              ))}

              <View style={styles.deductionSummaryRow}>
                <Text style={styles.deductionSummaryLabel}>{t('Total Deductions')}</Text>
                <Text style={styles.deductionSummaryVal}>- ₹{deductionsTotal.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        ) : null}

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

      {/* Edit Sale Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('Edit Sale')}</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>{t('Buyer Name')}</Text>
              <TextInput
                style={styles.input}
                value={editBuyerName}
                onChangeText={setEditBuyerName}
                placeholder={t('Buyer Name or APMC Mandi')}
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>{t('Total Quantity')} ({unit})</Text>
              <TextInput
                style={styles.input}
                value={editQuantity}
                onChangeText={setEditQuantity}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>{t('Rate')} (₹ / {unit})</Text>
              <TextInput
                style={styles.input}
                value={editRate}
                onChangeText={setEditRate}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>{t('Notes')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder={t('Remarks, invoice details...')}
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>{t('Cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveEdit}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalSaveText}>{t('Save Changes')}</Text>
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
});
