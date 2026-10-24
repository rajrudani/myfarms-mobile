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
import { farmActivitiesApi } from '../src/api/farmActivities';
import { FarmActivity } from '../src/types';
import { extractErrorMessage } from '../src/api/client';
import { colors, radius, spacing, shadows } from '../src/theme/tokens';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  completed: { label: 'Completed', bg: '#ecfdf3', text: '#15803d', border: '#bbf7d0' },
  scheduled: { label: 'Scheduled', bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  in_progress: { label: 'In Progress', bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  cancelled: { label: 'Cancelled', bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
};

export default function ActivityViewScreen() {
  const params = useLocalSearchParams();
  const activityIdentifier = (params.activity_ulid as string) || (params.activity_id as string);

  const [activity, setActivity] = useState<FarmActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editStatus, setEditStatus] = useState<string>('scheduled');
  const [editDate, setEditDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!activityIdentifier) return;
    try {
      const data = await farmActivitiesApi.getById(activityIdentifier);
      setActivity(data);
      setEditStatus(data.status || 'scheduled');
      setEditDate(data.date ? data.date.split('T')[0] : '');
      setEditNotes(data.notes || '');
    } catch (error) {
      console.error('Error fetching activity:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to load activity details.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activityIdentifier]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchActivity();
  };

  const handleMarkAsCompleted = async () => {
    if (!activity) return;
    const identifier = activity.ulid || activity.id!;
    try {
      setLoading(true);
      const updated = await farmActivitiesApi.update(identifier, {
        status: 'completed',
      });
      setActivity(updated);
      Alert.alert('Success', 'Activity marked as completed!');
    } catch (error) {
      console.error('Error completing activity:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to update activity.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!activity) return;
    const identifier = activity.ulid || activity.id!;
    try {
      setSaving(true);
      const updated = await farmActivitiesApi.update(identifier, {
        status: editStatus,
        date: editDate,
        notes: editNotes,
      });
      setActivity(updated);
      setEditModalVisible(false);
      Alert.alert('Success', 'Activity updated successfully!');
    } catch (error) {
      console.error('Error updating activity:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to update activity.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteActivity = () => {
    if (!activity) return;
    const identifier = activity.ulid || activity.id!;
    Alert.alert(
      'Delete Activity',
      'Are you sure you want to delete this activity? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await farmActivitiesApi.delete(identifier);
              Alert.alert('Deleted', 'Activity has been deleted.');
              router.back();
            } catch (error) {
              console.error('Error deleting activity:', error);
              Alert.alert('Error', extractErrorMessage(error, 'Failed to delete activity.'));
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
        <Text style={styles.loadingText}>Loading activity details...</Text>
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={styles.centerBox}>
        <Ionicons name="alert-circle-outline" size={48} color="#94a3b8" />
        <Text style={styles.notFoundText}>Activity not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rawStatus = (activity.status || 'scheduled').toLowerCase();
  const statusInfo = STATUS_CONFIG[rawStatus] || STATUS_CONFIG.scheduled;

  const activityTitle = activity.farm_activity_master?.name || activity.activity_type || 'Farm Activity';
  const farmName = activity.farm_name || activity.farm?.name || 'Farm';
  const cycleName = activity.crop_cycle_name || activity.crop_cycle?.season_name || activity.crop_cycle?.crop_type || '';

  // Extract custom input details
  const details = activity.details_json && typeof activity.details_json === 'object'
    ? Object.entries(activity.details_json).filter(([_, val]) => val !== null && val !== '')
    : [];

  const linkedExpenses = (activity as any).expenses || [];
  const linkedExpensesTotal = linkedExpenses.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);

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

        <Text style={styles.topBarTitle}>Activity Details</Text>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setEditModalVisible(true)}
          activeOpacity={0.7}
          accessibilityLabel="Edit Activity"
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
        {/* 1. Hero Card */}
        <View style={styles.card}>
          <View style={styles.heroHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{activityTitle}</Text>
              {cycleName !== '' ? (
                <Text style={styles.heroSubtitle}>{cycleName}</Text>
              ) : null}
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusInfo.bg, borderColor: statusInfo.border }]}>
              <View style={[styles.statusDot, { backgroundColor: statusInfo.text }]} />
              <Text style={[styles.statusText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Ionicons name="calendar-outline" size={18} color="#166534" style={styles.statIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>DATE</Text>
                <Text style={styles.statValue}>
                  {activity.date ? activity.date.split('T')[0] : 'Not Set'}
                </Text>
              </View>
            </View>

            <View style={styles.statBox}>
              <Ionicons name="location-outline" size={18} color="#166534" style={styles.statIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>FARM</Text>
                <Text style={styles.statValue} numberOfLines={1}>{farmName}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 2. Inputs & Setup Card */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="options-outline" size={18} color="#166534" />
            <Text style={styles.sectionTitle}>Inputs & Setup</Text>
          </View>

          {details.length > 0 ? (
            <View style={styles.detailsList}>
              {details.map(([key, value], idx) => {
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return (
                  <View key={idx} style={[styles.detailRow, idx < details.length - 1 && styles.detailRowBorder]}>
                    <Text style={styles.detailKey}>{label}</Text>
                    <Text style={styles.detailVal}>{String(value)}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>No custom inputs were captured for this activity.</Text>
          )}
        </View>

        {/* 3. Operational Notes */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderBetween}>
            <View style={styles.row}>
              <Ionicons name="document-text-outline" size={18} color="#166534" />
              <Text style={styles.sectionTitle}>Operational Notes</Text>
            </View>
            <TouchableOpacity onPress={() => setEditModalVisible(true)} style={styles.miniActionBtn}>
              <Ionicons name="pencil" size={13} color="#166534" />
              <Text style={styles.miniActionText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {activity.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{activity.notes}</Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>No notes were added to this activity.</Text>
          )}
        </View>

        {/* 4. Linked Expenses */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="wallet-outline" size={18} color="#166534" />
            <Text style={styles.sectionTitle}>Linked Expenses</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{linkedExpenses.length}</Text>
            </View>
          </View>

          {linkedExpenses.length > 0 ? (
            <View>
              <View style={styles.expenseSummaryBanner}>
                <View>
                  <Text style={styles.bannerLabel}>TOTAL LINKED COST</Text>
                  <Text style={styles.bannerValue}>₹{linkedExpensesTotal.toFixed(2)}</Text>
                </View>
                <View style={styles.chipRow}>
                  <Text style={styles.bannerChip}>{linkedExpenses.length} Records</Text>
                </View>
              </View>

              <View style={styles.linkedList}>
                {linkedExpenses.map((exp: any, index: number) => (
                  <TouchableOpacity
                    key={exp.ulid || exp.id || index}
                    style={styles.linkedItem}
                    activeOpacity={0.7}
                    onPress={() => router.push({
                      pathname: '/expense-view',
                      params: { expense_id: exp.id?.toString(), expense_ulid: exp.ulid },
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.linkedItemTitle}>{exp.expense_category || 'Expense'}</Text>
                      <Text style={styles.linkedItemSub}>{exp.date ? exp.date.split('T')[0] : ''}</Text>
                    </View>
                    <View style={styles.linkedItemRight}>
                      <Text style={styles.linkedItemAmount}>₹{parseFloat(exp.amount || 0).toFixed(2)}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>No expenses have been linked to this activity yet.</Text>
          )}
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          {rawStatus !== 'completed' && rawStatus !== 'cancelled' ? (
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={handleMarkAsCompleted}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
              <Text style={styles.primaryActionText}>Mark as Completed</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.outlineActionBtn}
            onPress={() => setEditModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={18} color="#166534" />
            <Text style={styles.outlineActionText}>Edit Activity</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dangerActionBtn}
            onPress={handleDeleteActivity}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={18} color="#dc2626" />
            <Text style={styles.dangerActionText}>Delete Activity</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Activity Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Activity</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={editDate}
                onChangeText={setEditDate}
                placeholder="2026-10-24"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.statusSelectRow}>
                {['scheduled', 'in_progress', 'completed', 'cancelled'].map((st) => {
                  const cfg = STATUS_CONFIG[st];
                  const isSelected = editStatus.toLowerCase() === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[
                        styles.statusOption,
                        isSelected && { backgroundColor: cfg.bg, borderColor: cfg.border },
                      ]}
                      onPress={() => setEditStatus(st)}
                    >
                      <Text style={[styles.statusOptionText, isSelected && { color: cfg.text, fontWeight: '800' }]}>
                        {cfg.label}
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
                placeholder="Field observations, spray conditions, remarks..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
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
  heroHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#14532d',
    lineHeight: 28,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
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
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    gap: 10,
  },
  statIcon: {
    width: 24,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
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
  miniActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  miniActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  detailsList: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  detailKey: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    flex: 1,
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'right',
    flex: 1,
  },
  notesBox: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 3,
    borderLeftColor: '#16a34a',
    padding: 12,
    borderRadius: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  expenseSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  bannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#d97706',
    letterSpacing: 0.5,
  },
  bannerValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#92400e',
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  bannerChip: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    backgroundColor: 'rgba(251, 191, 36, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  linkedList: {
    gap: 8,
  },
  linkedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
  },
  linkedItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  linkedItemSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  linkedItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkedItemAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803d',
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
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803d',
    borderRadius: 12,
    height: 48,
    gap: 8,
    ...shadows.subtle,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
  statusSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
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
