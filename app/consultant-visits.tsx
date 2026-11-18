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
import { consultantVisitsApi } from '../src/api/consultantVisits';
import { farmsApi } from '../src/api/farms';
import { staffApi } from '../src/api/staff';
import { cropCyclesApi } from '../src/api/cropCycles';
import { ConsultantVisit, Farm, StaffMember, CropCycle } from '../src/types';
import { extractErrorMessage } from '../src/api/client';
import { AttachmentPicker } from '../src/components/AttachmentPicker';
import { BentoCard, MetricTile, StatusBadge, QuickChipGroup, SearchFilterBar, SearchableSelect, ModernDatePicker, ModernInput, EmptyState, ConfirmModal, ModalSheet } from '../src/components/ui';
import { useToast } from '../src/context/ToastContext';
import { useTranslation } from '../src/i18n/I18nContext';
import { colors, spacing, radius, typography, shadows } from '../src/theme/tokens';

export default function ConsultantVisitsScreen() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const [visits, setVisits] = useState<ConsultantVisit[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [consultants, setConsultants] = useState<StaffMember[]>([]);
  const [cropCycles, setCropCycles] = useState<CropCycle[]>([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Confirm delete state
  const [visitToDelete, setVisitToDelete] = useState<ConsultantVisit | null>(null);
  const [deletingVisit, setDeletingVisit] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<'all' | string>('all');
  const [selectedConsultantFilter, setSelectedConsultantFilter] = useState<'all' | string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

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
        showToast('Consultant visit updated successfully.', 'success');
      } else {
        await consultantVisitsApi.create(payload);
        showToast('Consultant visit recorded successfully.', 'success');
      }
      setModalVisible(false);
      fetchVisits(false);
    } catch (error) {
      console.error('Error saving visit:', error);
      showToast(extractErrorMessage(error, 'Failed to save consultant visit.'), 'error');
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
      showToast(`Visit marked as ${!visit.is_active ? 'active' : 'inactive'}.`, 'info');
    } catch (error) {
      console.error('Error toggling status:', error);
      showToast(extractErrorMessage(error, 'Failed to toggle status.'), 'error');
      fetchVisits(false);
    }
  };

  // Delete visit
  const handleDeleteVisit = (visit: ConsultantVisit) => {
    setVisitToDelete(visit);
  };

  const handleConfirmDeleteVisit = async () => {
    if (!visitToDelete) return;
    setDeletingVisit(true);
    try {
      await consultantVisitsApi.delete(visitToDelete.ulid || visitToDelete.id);
      setVisitToDelete(null);
      showToast('Consultant visit deleted successfully.', 'success');
      fetchVisits(false);
    } catch (error) {
      console.error('Error deleting visit:', error);
      showToast(extractErrorMessage(error, 'Failed to delete visit.'), 'error');
    } finally {
      setDeletingVisit(false);
    }
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
    const opts = [{ label: t('All Farms'), value: 'all' }];
    farms.forEach((f) => {
      opts.push({ label: f.name, value: f.id?.toString() || '' });
    });
    return opts;
  }, [farms, t]);

  const consultantFilterOptions = useMemo(() => {
    const opts = [{ label: t('All Agronomists'), value: 'all' }];
    consultants.forEach((c) => {
      opts.push({ label: c.name, value: c.id.toString() });
    });
    return opts;
  }, [consultants, t]);

  const statusFilterOptions = useMemo(
    () => [
      { label: t('Active'), value: 'active' },
      { label: t('All Status'), value: 'all' },
      { label: t('Archived'), value: 'inactive' },
    ],
    [t]
  );

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
              label={item.is_active ? t('ACTIVE VISIT') : t('RESOLVED')}
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
              {item.consultant?.name || t('Consultant')}
            </Text>
            <Text style={styles.consultantSubtext}>{t('Field Advisory & Health Inspection')}</Text>
          </View>
        </View>

        {/* Tags Row */}
        <View style={styles.tagsContainer}>
          <View style={styles.tagPill}>
            <Ionicons name="map-outline" size={12} color={colors.slate500} />
            <Text style={styles.tagPillText} numberOfLines={1}>
              {item.farm?.name || t('Farm')}
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
              <Text style={styles.prescriptionLabel}>{t('ADVISORY & PRESCRIPTION')}</Text>
            </View>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        ) : (
          <View style={styles.noNotesBox}>
            <Text style={styles.noNotesText}>{t('No inspection notes recorded for this visit.')}</Text>
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
            <Text style={styles.attachmentBadgeText}>{t('View Attached Report / Photo')}</Text>
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
            <Text style={styles.actionBtnText}>{t('Edit')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDeleteVisit(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
            <Text style={styles.deleteBtnText}>{t('Delete')}</Text>
          </TouchableOpacity>
        </View>
      </BentoCard>
    );
  };

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
            <Text style={styles.headerTitle}>{t('Consultant Visits')}</Text>
            <Text style={styles.headerSubtitle}>{t('Track consultant activities and recommendations.')}</Text>
          </View>
        </View>
      </View>

      {/* Search and Filters Toggle */}
      <View style={styles.searchSection}>
        <SearchFilterBar
          query={searchQuery}
          onChangeQuery={setSearchQuery}
          placeholder={t('Search visits...')}
          hasFilter
          isFilterActive={
            selectedFarmFilter !== 'all' ||
            selectedConsultantFilter !== 'all' ||
            selectedStatusFilter !== 'all'
          }
          activeFilterCount={
            (selectedFarmFilter !== 'all' ? 1 : 0) +
            (selectedConsultantFilter !== 'all' ? 1 : 0) +
            (selectedStatusFilter !== 'all' ? 1 : 0)
          }
          onToggleFilter={() => setFilterModalVisible(true)}
        />
      </View>

      {/* Visits List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('Loading agronomist logs...')}</Text>
        </View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => item.ulid}
          renderItem={renderVisitItem}
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={
            <View style={styles.listHeaderComponent}>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryTile}>
                  <MetricTile
                    label={t('TOTAL VISITS')}
                    value={visitStats.total}
                    iconName="clipboard-text-outline"
                    iconColor={colors.slate700}
                    iconBg={colors.slate100}
                  />
                </View>
                <View style={styles.summaryTile}>
                  <MetricTile
                    label={t('ACTIVE ADVISORY')}
                    value={visitStats.active}
                    iconName="pulse"
                    iconColor={colors.successText}
                    iconBg={colors.successSurface}
                  />
                </View>
                <View style={styles.summaryTile}>
                  <MetricTile
                    label={t('PRESCRIPTIONS')}
                    value={visitStats.withPrescription}
                    iconName="file-document-outline"
                    iconColor={colors.purpleText}
                    iconBg={colors.purpleSurface}
                  />
                </View>
              </View>
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
              icon="clipboard-outline"
              title={t('No Visits Found')}
              message={
                searchQuery || selectedFarmFilter !== 'all' || selectedConsultantFilter !== 'all' || selectedStatusFilter !== 'active'
                  ? t('No advisory visits match your active search or filters.')
                  : t('Track expert agronomist visits, field diagnostics, and spray prescriptions.')
              }
              actionLabel={
                !searchQuery && selectedFarmFilter === 'all' && selectedConsultantFilter === 'all'
                  ? t('+ Log Advisory Visit')
                  : undefined
              }
              onAction={handleOpenCreateModal}
              secondaryActionLabel={
                searchQuery || selectedFarmFilter !== 'all' || selectedConsultantFilter !== 'all' || selectedStatusFilter !== 'active'
                  ? t('Clear Filters')
                  : undefined
              }
              onSecondaryAction={() => {
                setSearchQuery('');
                setSelectedFarmFilter('all');
                setSelectedConsultantFilter('all');
                setSelectedStatusFilter('active');
              }}
            />
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
                <Text style={styles.modalKicker}>{t('FIELD INSPECTION')}</Text>
                <Text style={styles.modalTitle}>
                  {editingVisit ? t('Edit Advisory Visit') : t('Record Consultant Visit')}
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
              <SearchableSelect
                label={t('Select Farm')}
                required
                placeholder={t('Select farm')}
                searchPlaceholder={t('Search farms...')}
                items={farms.map((f) => ({
                  value: f.id?.toString() || '',
                  label: f.name,
                  sublabel: f.area ? `${f.area} ${f.area_unit}` : undefined,
                  icon: 'business-outline',
                }))}
                value={farmId}
                onSelect={(val) => setFarmId(val as string)}
                containerStyle={{ marginBottom: spacing.md }}
              />

              {/* Consultant Selector */}
              <SearchableSelect
                label={t('Select Consultant / Agronomist')}
                required
                placeholder={t('Select consultant')}
                searchPlaceholder={t('Search consultants...')}
                items={consultants.map((c) => ({
                  value: c.id.toString(),
                  label: c.name,
                  sublabel: c.email || undefined,
                  icon: 'medkit-outline',
                }))}
                value={consultantId}
                onSelect={(val) => setConsultantId(val as string)}
                containerStyle={{ marginBottom: spacing.md }}
              />

              {/* Visit Date */}
              <ModernDatePicker
                label={t('Visit Date')}
                required
                value={visitDate}
                onChange={setVisitDate}
                containerStyle={{ marginBottom: spacing.md }}
              />

              <ModernInput
                label={t('Prescriptions & Recommendations')}
                placeholder={t('Write observations, pest diagnosis, dosage recommendations, schedule...')}
                multiline
                numberOfLines={4}
                value={notes}
                onChangeText={setNotes}
                containerStyle={{ marginBottom: spacing.md }}
              />

              {/* Active Switch */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>{t('Active Recommendation Status')}</Text>
                  <Text style={styles.switchSubLabel}>
                    {t('Keep active until agronomist actions are completed')}
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
              <SearchableSelect<string | number>
                multiple
                label={t('Link Related Crop Cycles (Optional)')}
                placeholder={t('Select crop cycles')}
                searchPlaceholder={t('Search cycles...')}
                items={cropCycles.map((cycle) => ({
                  value: cycle.id || '',
                  label: `${cycle.season_name ? `${cycle.season_name} • ` : ''}${cycle.crop_name || t('Crop')}`,
                  sublabel: cycle.farm?.name,
                  icon: 'leaf-outline',
                }))}
                selectedValues={selectedCycleIds}
                onMultiSelect={(vals) => setSelectedCycleIds(vals)}
                containerStyle={{ marginBottom: spacing.md }}
              />

              <View style={{ marginTop: spacing.md }}>
                <AttachmentPicker
                  label={t('Visit Report Photo / Recommendation Slip')}
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
                  <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
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

      <ConfirmModal
        visible={!!visitToDelete}
        title="Delete Consultant Visit"
        message="Are you sure you want to delete this consultant visit? This action cannot be undone."
        confirmText="Delete Visit"
        destructive
        loading={deletingVisit}
        onConfirm={handleConfirmDeleteVisit}
        onCancel={() => setVisitToDelete(null)}
      />

      {/* Filter Bottom Sheet */}
      <ModalSheet
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        title={t('Filter Visits')}
        kicker={t('Search Filters')}
        footer={
          <View style={styles.filterFooterRow}>
            <TouchableOpacity
              style={styles.filterResetBtn}
              onPress={() => {
                setSelectedFarmFilter('all');
                setSelectedConsultantFilter('all');
                setSelectedStatusFilter('all');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.filterResetText}>{t('Reset All')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterApplyBtn}
              onPress={() => setFilterModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.filterApplyText}>{t('Apply Filters')}</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <View style={styles.filterSheetContent}>
          {/* Section 1: Farm */}
          <Text style={styles.filterSectionTitle}>{t('Farm')}</Text>
          <View style={styles.filterChipsRow}>
            {farmFilterOptions.map((opt) => {
              const isSelected = selectedFarmFilter === opt.value;
              return (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[styles.filterChip, isSelected && styles.filterChipActive]}
                  onPress={() => setSelectedFarmFilter(opt.value as any)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Section 2: Agronomist / Consultant */}
          <Text style={styles.filterSectionTitle}>{t('Agronomist')}</Text>
          <View style={styles.filterChipsRow}>
            {consultantFilterOptions.map((opt) => {
              const isSelected = selectedConsultantFilter === opt.value;
              return (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[styles.filterChip, isSelected && styles.filterChipActive]}
                  onPress={() => setSelectedConsultantFilter(opt.value as any)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Section 3: Status */}
          <Text style={styles.filterSectionTitle}>{t('Status')}</Text>
          <View style={styles.filterChipsRow}>
            {statusFilterOptions.map((opt) => {
              const isSelected = selectedStatusFilter === opt.value;
              return (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[styles.filterChip, isSelected && styles.filterChipActive]}
                  onPress={() => setSelectedStatusFilter(opt.value as any)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
  searchSection: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  listHeaderComponent: {
    paddingBottom: spacing.xs,
  },
  filterSheetContent: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterSectionTitle: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '800',
    color: colors.slate700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  filterChipActive: {
    backgroundColor: '#ecfdf5',
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.slate700,
  },
  filterChipTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  filterFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  filterResetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterResetText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.slate700,
  },
  filterApplyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterApplyText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.white,
  },
  summaryGrid: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  summaryTile: {
    flex: 1,
  },
  listContainer: {
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
  card: {
    marginBottom: 10,
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
