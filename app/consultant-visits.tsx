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
import { consultantVisitsApi } from '../src/api/consultantVisits';
import { farmsApi } from '../src/api/farms';
import { staffApi } from '../src/api/staff';
import { cropCyclesApi } from '../src/api/cropCycles';
import { ConsultantVisit, Farm, StaffMember, CropCycle } from '../src/types';
import { extractErrorMessage } from '../src/api/client';
import { AttachmentPicker } from '../src/components/AttachmentPicker';
import { BentoCard, MetricTile, StatusBadge, QuickChipGroup, SearchFilterBar } from '../src/components/ui';
import { colors, spacing, radius, typography, shadows } from '../src/theme/tokens';

export default function ConsultantVisitsScreen() {
  const [visits, setVisits] = useState<ConsultantVisit[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [consultants, setConsultants] = useState<StaffMember[]>([]);
  const [cropCycles, setCropCycles] = useState<CropCycle[]>([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<'all' | string>('all');
  const [selectedConsultantFilter, setSelectedConsultantFilter] = useState<'all' | string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [showFilters, setShowFilters] = useState(false);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVisit, setEditingVisit] = useState<ConsultantVisit | null>(null);

  // Form Fields
  const [farmId, setFarmId] = useState('');
  const [consultantId, setConsultantId] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedCycleIds, setSelectedCycleIds] = useState<(number | string)[]>([]);
  const [attachmentFilePath, setAttachmentFilePath] = useState<string | null>(null);
  const [attachmentFileUrl, setAttachmentFileUrl] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // Fetch dropdown lists (farms, consultants, crop cycles)
  const fetchDropdownData = async () => {
    try {
      const [farmsData, staffData, cyclesData] = await Promise.all([
        farmsApi.getAll(),
        staffApi.getAll(),
        cropCyclesApi.getAll(),
      ]);
      setFarms(farmsData);

      const consultantStaff = staffData.filter((s) =>
        s.roles.some((r) => r.value === 'Consultant')
      );
      setConsultants(consultantStaff.length > 0 ? consultantStaff : staffData);
      setCropCycles(cyclesData);
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
    }
  };

  // Fetch visits
  const fetchVisits = useCallback(
    async (showIndicator = true) => {
      if (showIndicator) setLoading(true);
      try {
        const data = await consultantVisitsApi.getAll({
          search: searchQuery,
          farm_id: selectedFarmFilter === 'all' ? undefined : selectedFarmFilter,
          consultant_id: selectedConsultantFilter === 'all' ? undefined : selectedConsultantFilter,
          status: selectedStatusFilter === 'all' ? undefined : selectedStatusFilter,
        });
        setVisits(data);
      } catch (error) {
        console.error('Error fetching visits:', error);
        Alert.alert('Error', extractErrorMessage(error, 'Failed to load consultant visits.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [searchQuery, selectedFarmFilter, selectedConsultantFilter, selectedStatusFilter]
  );

  useEffect(() => {
    fetchDropdownData();
  }, []);

  useEffect(() => {
    fetchVisits(true);
  }, [fetchVisits]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchVisits(false);
  };

  // Open create modal
  const handleOpenCreateModal = () => {
    setEditingVisit(null);
    setFarmId(farms[0]?.id?.toString() || '');
    setConsultantId(consultants[0]?.id?.toString() || '');
    setVisitDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setIsActive(true);
    setSelectedCycleIds([]);
    setAttachmentFilePath(null);
    setAttachmentFileUrl(null);
    setModalVisible(true);
  };

  // Open edit modal
  const handleOpenEditModal = (visit: ConsultantVisit) => {
    setEditingVisit(visit);
    setFarmId(visit.farm_id.toString());
    setConsultantId(visit.consultant_id.toString());
    setVisitDate(visit.visit_date);
    setNotes(visit.notes || '');
    setIsActive(visit.is_active);
    setSelectedCycleIds(visit.crop_cycles?.map((c) => c.id) || []);
    setAttachmentFilePath(visit.attachment_file_path || null);
    setAttachmentFileUrl(visit.attachment_file_url || null);
    setModalVisible(true);
  };

  // Save (Create or Update)
  const handleSaveVisit = async () => {
    if (!farmId || !consultantId || !visitDate) {
      Alert.alert('Validation Error', 'Farm, Consultant, and Visit Date are required.');
      return;
    }

    const payload = {
      farm_id: isNaN(Number(farmId)) ? farmId : Number(farmId),
      consultant_id: isNaN(Number(consultantId)) ? consultantId : Number(consultantId),
      visit_date: visitDate,
      notes,
      is_active: isActive,
      attachment_file_path: attachmentFilePath,
      crop_cycle_ids: selectedCycleIds,
    };

    try {
      if (editingVisit) {
        await consultantVisitsApi.update(editingVisit.ulid || editingVisit.id, payload);
        Alert.alert('Success', 'Consultant visit updated successfully.');
      } else {
        await consultantVisitsApi.create(payload);
        Alert.alert('Success', 'Consultant visit recorded successfully.');
      }
      setModalVisible(false);
      fetchVisits(false);
    } catch (error) {
      console.error('Error saving visit:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to save consultant visit.'));
    }
  };

  // Toggle active/inactive status
  const handleToggleActive = async (visit: ConsultantVisit) => {
    setVisits((prev) =>
      prev.map((v) =>
        v.ulid === visit.ulid || v.id === visit.id ? { ...v, is_active: !v.is_active } : v
      )
    );
    try {
      const updated = await consultantVisitsApi.toggleStatus(visit.ulid || visit.id);
      setVisits((prev) =>
        prev.map((v) => (v.ulid === visit.ulid || v.id === visit.id ? updated : v))
      );
    } catch (error) {
      console.error('Error toggling status:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to toggle status.'));
      fetchVisits(false);
    }
  };

  // Delete visit
  const handleDeleteVisit = (visit: ConsultantVisit) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this consultant visit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await consultantVisitsApi.delete(visit.ulid || visit.id);
            fetchVisits(false);
          } catch (error) {
            console.error('Error deleting visit:', error);
            Alert.alert('Error', extractErrorMessage(error, 'Failed to delete visit.'));
          }
        },
      },
    ]);
  };

  // Toggle crop cycle selection in modal
  const handleToggleCycleSelection = (cycleId: number | string) => {
    if (selectedCycleIds.includes(cycleId)) {
      setSelectedCycleIds(selectedCycleIds.filter((id) => id !== cycleId));
    } else {
      setSelectedCycleIds([...selectedCycleIds, cycleId]);
    }
  };

  // Filter options for chips
  const farmFilterOptions = useMemo(() => {
    const opts = [{ label: 'All Farms', value: 'all' }];
    farms.forEach((f) => {
      opts.push({ label: f.name, value: f.id?.toString() || '' });
    });
    return opts;
  }, [farms]);

  const consultantFilterOptions = useMemo(() => {
    const opts = [{ label: 'All Agronomists', value: 'all' }];
    consultants.forEach((c) => {
      opts.push({ label: c.name, value: c.id.toString() });
    });
    return opts;
  }, [consultants]);

  const statusFilterOptions = [
    { label: 'Active', value: 'active' },
    { label: 'All Status', value: 'all' },
    { label: 'Archived', value: 'inactive' },
  ];

  // Summary counts
  const visitStats = useMemo(() => {
    const active = visits.filter((v) => v.is_active).length;
    const withPrescription = visits.filter((v) => v.notes && v.notes.trim().length > 0).length;
    return { total: visits.length, active, withPrescription };
  }, [visits]);

  // Render Single Visit Card
  const renderVisitItem = ({ item }: { item: ConsultantVisit }) => {
    let formattedDate = '';
    if (item.visit_date) {
      const d = new Date(item.visit_date);
      formattedDate = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    return (
      <BentoCard variant="elevated" style={styles.card}>
        {/* Top: Date & Status */}
        <View style={styles.cardTopRow}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.slate500} />
            <Text style={styles.visitDateText}>{formattedDate}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleToggleActive(item)}
            activeOpacity={0.7}
          >
            <StatusBadge
              label={item.is_active ? 'ACTIVE VISIT' : 'RESOLVED'}
              variant={item.is_active ? 'success' : 'neutral'}
              dot={item.is_active}
            />
          </TouchableOpacity>
        </View>

        {/* Title: Consultant Name */}
        <View style={styles.consultantRow}>
          <View style={styles.consultantAvatar}>
            <Ionicons name="person" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.consultantNameText}>
              {item.consultant?.name || 'Agronomist / Consultant'}
            </Text>
            <Text style={styles.consultantSubtext}>Field Advisory & Health Inspection</Text>
          </View>
        </View>

        {/* Tags Row */}
        <View style={styles.tagsContainer}>
          <View style={styles.tagPill}>
            <Ionicons name="map-outline" size={12} color={colors.slate500} />
            <Text style={styles.tagPillText} numberOfLines={1}>
              {item.farm?.name || 'Farm'}
            </Text>
          </View>

          {item.crop_cycles?.map((cycle) => (
            <View key={cycle.id} style={[styles.tagPill, styles.cycleTagPill]}>
              <Ionicons name="leaf-outline" size={12} color={colors.purpleText} />
              <Text style={[styles.tagPillText, { color: colors.purpleText }]} numberOfLines={1}>
                {cycle.season_name ? `${cycle.season_name} • ` : ''}
                {cycle.crop_name}
              </Text>
            </View>
          ))}
        </View>

        {/* Prescription / Notes Details */}
        {item.notes ? (
          <View style={styles.prescriptionBox}>
            <View style={styles.prescriptionHeader}>
              <Ionicons name="medkit-outline" size={13} color={colors.primaryDark} />
              <Text style={styles.prescriptionLabel}>ADVISORY & PRESCRIPTION</Text>
            </View>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        ) : (
          <View style={styles.noNotesBox}>
            <Text style={styles.noNotesText}>No inspection notes recorded for this visit.</Text>
          </View>
        )}

        {/* Report Attachment pill if present */}
        {item.attachment_file_url ? (
          <TouchableOpacity
            style={styles.attachmentBadge}
            onPress={() => setPreviewModalUrl(item.attachment_file_url || null)}
            activeOpacity={0.7}
          >
            <Ionicons name="document-attach-outline" size={14} color={colors.primary} />
            <Text style={styles.attachmentBadgeText}>View Attached Report / Photo</Text>
            <Ionicons name="arrow-forward" size={12} color={colors.primary} />
          </TouchableOpacity>
        ) : null}

        {/* Card Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleOpenEditModal(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={14} color={colors.slate700} />
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDeleteVisit(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </BentoCard>
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
          <Text style={styles.headerKicker}>AGRONOMY & FIELD ADVICE</Text>
          <Text style={styles.headerTitle}>Consultant Visits</Text>
        </View>
      </View>

      {/* Search and Filters Toggle */}
      <View style={styles.searchSection}>
        <SearchFilterBar
          query={searchQuery}
          onChangeQuery={setSearchQuery}
          placeholder="Search agronomist, farm, notes..."
          hasFilter
          isFilterActive={showFilters}
          onToggleFilter={() => setShowFilters(!showFilters)}
        />

        {showFilters && (
          <View style={styles.filterTray}>
            <View style={styles.filterTrayRow}>
              <Text style={styles.filterTrayLabel}>Farm:</Text>
              <QuickChipGroup
                options={farmFilterOptions}
                selectedValue={selectedFarmFilter}
                onSelect={(val) => setSelectedFarmFilter(val as any)}
                scrollable
                size="sm"
              />
            </View>

            <View style={styles.filterTrayRow}>
              <Text style={styles.filterTrayLabel}>Agronomist:</Text>
              <QuickChipGroup
                options={consultantFilterOptions}
                selectedValue={selectedConsultantFilter}
                onSelect={(val) => setSelectedConsultantFilter(val as any)}
                scrollable
                size="sm"
              />
            </View>

            <View style={styles.filterTrayRow}>
              <Text style={styles.filterTrayLabel}>Status:</Text>
              <QuickChipGroup
                options={statusFilterOptions}
                selectedValue={selectedStatusFilter}
                onSelect={(val) => setSelectedStatusFilter(val as any)}
                size="sm"
              />
            </View>
          </View>
        )}
      </View>

      {/* Metric Tiles Header */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryTile}>
          <MetricTile
            label="TOTAL VISITS"
            value={visitStats.total}
            iconName="clipboard-text-outline"
            iconColor={colors.slate700}
            iconBg={colors.slate100}
          />
        </View>
        <View style={styles.summaryTile}>
          <MetricTile
            label="ACTIVE ADVISORY"
            value={visitStats.active}
            iconName="pulse"
            iconColor={colors.successText}
            iconBg={colors.successSurface}
          />
        </View>
        <View style={styles.summaryTile}>
          <MetricTile
            label="PRESCRIPTIONS"
            value={visitStats.withPrescription}
            iconName="file-document-outline"
            iconColor={colors.purpleText}
            iconBg={colors.purpleSurface}
          />
        </View>
      </View>

      {/* Visits List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading agronomist logs...</Text>
        </View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => item.ulid}
          renderItem={renderVisitItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="clipboard-outline" size={36} color={colors.slate400} />
              </View>
              <Text style={styles.emptyTitle}>No Visits Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'Try searching with another keyword'
                  : 'Tap + button below to log an agronomist advisory visit'}
              </Text>
            </View>
          }
        />
      )}

      {/* Futuristic FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleOpenCreateModal}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Create / Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalKicker}>FIELD INSPECTION</Text>
                <Text style={styles.modalTitle}>
                  {editingVisit ? 'Edit Advisory Visit' : 'Record Consultant Visit'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Farm Selector */}
              <Text style={styles.inputLabel}>Select Farm *</Text>
              <QuickChipGroup
                options={farms.map((f) => ({ label: f.name, value: f.id?.toString() || '' }))}
                selectedValue={farmId}
                onSelect={(val) => setFarmId(val)}
                scrollable
              />

              {/* Consultant Selector */}
              <Text style={styles.inputLabel}>Select Consultant / Agronomist *</Text>
              <QuickChipGroup
                options={consultants.map((c) => ({ label: c.name, value: c.id.toString() }))}
                selectedValue={consultantId}
                onSelect={(val) => setConsultantId(val)}
                scrollable
              />

              {/* Visit Date */}
              <Text style={styles.inputLabel}>Visit Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2026-06-27"
                placeholderTextColor={colors.slate400}
                value={visitDate}
                onChangeText={setVisitDate}
              />

              {/* Notes */}
              <Text style={styles.inputLabel}>Prescriptions & Recommendations</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Write observations, pest diagnosis, dosage recommendations, schedule..."
                placeholderTextColor={colors.slate400}
                multiline
                numberOfLines={4}
                value={notes}
                onChangeText={setNotes}
              />

              {/* Active Switch */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Active Recommendation Status</Text>
                  <Text style={styles.switchSubLabel}>
                    Keep active until agronomist actions are completed
                  </Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: colors.slate300, true: colors.primaryLight }}
                  thumbColor={isActive ? colors.primary : colors.slate100}
                />
              </View>

              {/* Crop Cycles Selection (Link Cycles) */}
              <Text style={styles.inputLabel}>Link Related Crop Cycles (Optional)</Text>
              <View style={styles.cyclesContainer}>
                {cropCycles.map((cycle) => {
                  const isSelected = selectedCycleIds.includes(cycle.id || '');
                  return (
                    <TouchableOpacity
                      key={cycle.id}
                      style={[styles.cycleSelectCard, isSelected && styles.cycleSelectCardActive]}
                      onPress={() => handleToggleCycleSelection(cycle.id || '')}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={18}
                        color={isSelected ? colors.primary : colors.slate400}
                      />
                      <Text
                        style={[
                          styles.cycleSelectText,
                          isSelected && styles.cycleSelectTextActive,
                        ]}
                      >
                        {cycle.season_name ? `${cycle.season_name} • ` : ''}
                        {cycle.crop_name || 'Crop'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ marginTop: spacing.md }}>
                <AttachmentPicker
                  label="Visit Report Photo / Recommendation Slip"
                  category="consultant-visit-recommendations"
                  currentPath={attachmentFilePath}
                  currentUrl={attachmentFileUrl}
                  onAttachmentChange={(p, u) => {
                    setAttachmentFilePath(p);
                    setAttachmentFileUrl(u);
                  }}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleSaveVisit}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                  <Text style={styles.saveBtnText}>
                    {editingVisit ? 'Update Visit' : 'Save Visit'}
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
  searchSection: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterTray: {
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  filterTrayRow: {
    gap: 4,
  },
  filterTrayLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.slate500,
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
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 90,
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
  card: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  visitDateText: {
    ...typography.caption,
    color: colors.slate600,
  },
  consultantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  consultantAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consultantNameText: {
    ...typography.title2,
    color: colors.slate900,
  },
  consultantSubtext: {
    ...typography.bodySmall,
    color: colors.slate500,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    gap: 4,
  },
  cycleTagPill: {
    backgroundColor: colors.purpleSurface,
    borderWidth: 1,
    borderColor: colors.purpleBorder,
  },
  tagPillText: {
    fontSize: 11,
    color: colors.slate700,
    fontWeight: '600',
  },
  prescriptionBox: {
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  prescriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  prescriptionLabel: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  notesText: {
    ...typography.body,
    fontSize: 13,
    color: colors.slate800,
    lineHeight: 18,
  },
  noNotesBox: {
    backgroundColor: colors.slate50,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  noNotesText: {
    ...typography.bodySmall,
    color: colors.slate400,
    fontStyle: 'italic',
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
    alignSelf: 'flex-start',
  },
  attachmentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate700,
  },
  deleteBtn: {
    backgroundColor: colors.dangerSurface,
  },
  deleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.dangerText,
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
    height: 90,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    marginTop: spacing.md,
  },
  switchLabel: {
    ...typography.title3,
    color: colors.slate900,
  },
  switchSubLabel: {
    ...typography.bodySmall,
    color: colors.slate500,
    marginTop: 2,
  },
  cyclesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  cycleSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  cycleSelectCardActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryBorder,
  },
  cycleSelectText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
  },
  cycleSelectTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
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
