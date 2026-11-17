import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { notesApi, NoteFilters } from '../../src/api/notes';
import { NoteReminder, NoteReminderStatus } from '../../src/types';
import { extractErrorMessage } from '../../src/api/client';
import { AttachmentPicker } from '../../src/components/AttachmentPicker';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';
import { useTranslation } from '../../src/i18n/I18nContext';
import { scheduleLocalReminder } from '../../src/utils/notifications';
import { offlineSync } from '../../src/utils/offlineSync';
import { useResponsive } from '../../src/utils/responsive';
import { ModalSheet, ModernInput, ModernDatePicker, EmptyState } from '../../src/components/ui';
import { useToast } from '../../src/context/ToastContext';

export default function NotesScreen() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const { containerMaxWidth, isTablet } = useResponsive();

  const [notes, setNotes] = useState<NoteReminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Status & Type dropdown sheets
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);
  const [typeSheetVisible, setTypeSheetVisible] = useState(false);

  // Create Note Modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyAt, setNotifyAt] = useState('');
  const [status, setStatus] = useState<NoteReminderStatus>('active');
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const searchTimeoutRef = useRef<any>(null);

  // Fetch paginated notes
  const fetchNotes = useCallback(
    async (targetPage = 1, append = false, isRefresh = false) => {
      if (targetPage === 1 && !isRefresh) setLoading(true);
      if (append) setLoadingMore(true);

      try {
        const params: NoteFilters = {
          search: search.trim() || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          type: typeFilter === 'all' ? undefined : typeFilter,
          page: targetPage,
          per_page: 10,
        };

        const response = await notesApi.getNotesPaginated(params);
        const newItems = response.data || [];

        if (append) {
          setNotes((prev) => [...prev, ...newItems]);
        } else {
          setNotes(newItems);
        }

        const currentPage = response.meta?.current_page || targetPage;
        const lastPage = response.meta?.last_page || 1;
        setPage(currentPage);
        setHasMore(currentPage < lastPage && newItems.length > 0);
      } catch (error) {
        console.error('Error fetching notes:', error);
        if (targetPage === 1) {
          Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to load notes and reminders.')));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [search, statusFilter, typeFilter, t]
  );

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchNotes(1, false);
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search, statusFilter, typeFilter, fetchNotes]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotes(1, false, true);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchNotes(page + 1, true);
    }
  };

  const handleOpenCreateModal = () => {
    setTitle('');
    setDetails('');
    setNotifyEnabled(false);
    setAttachmentPath(null);
    setAttachmentUrl(null);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setNotifyAt(tomorrow.toISOString().split('T')[0]);
    setStatus('active');
    setCreateModalVisible(true);
  };

  const handleSaveNote = async () => {
    if (!title.trim()) {
      Alert.alert(t('Validation Error'), t('Title is required.'));
      return;
    }
    if (notifyEnabled && !notifyAt.trim()) {
      Alert.alert(t('Validation Error'), t('Notification date is required when reminder is enabled.'));
      return;
    }

    setSaving(true);
    try {
      await notesApi.create({
        title: title.trim(),
        details: details.trim(),
        notify_enabled: notifyEnabled,
        notify_at: notifyEnabled ? notifyAt : null,
        status,
        attachment_path: attachmentPath,
      });

      // Schedule local notification if notifyEnabled
      if (notifyEnabled && notifyAt) {
        const trigger = new Date(notifyAt);
        if (!isNaN(trigger.getTime()) && trigger.getTime() > Date.now()) {
          scheduleLocalReminder({
            title: `Farm Reminder: ${title.trim()}`,
            body: details.trim() || 'Scheduled farm note alert',
            triggerDate: trigger,
            data: { url: 'myfarmsapp://notes' },
          });
        }
      }

      setCreateModalVisible(false);
      fetchNotes(1, false);
      showToast(t('Note / Reminder created successfully!'), 'success');
    } catch (error: any) {
      if (error.message === 'Network Error' || !error.response) {
        // Enqueue offline mutation for automatic syncing
        await offlineSync.enqueue({
          endpoint: '/note-reminders',
          method: 'POST',
          data: {
            title: title.trim(),
            details: details.trim(),
            notify_enabled: notifyEnabled,
            notify_at: notifyEnabled ? notifyAt : null,
            status,
            attachment_path: attachmentPath,
          },
          description: `Create Note: ${title.trim()}`,
        });

        if (notifyEnabled && notifyAt) {
          const trigger = new Date(notifyAt);
          if (!isNaN(trigger.getTime()) && trigger.getTime() > Date.now()) {
            scheduleLocalReminder({
              title: `Farm Reminder: ${title.trim()}`,
              body: details.trim() || 'Scheduled farm note alert',
              triggerDate: trigger,
              data: { url: 'myfarmsapp://notes' },
            });
          }
        }

        setCreateModalVisible(false);
        showToast(t('You are offline. Note saved to sync queue.'), 'info');
      } else {
        console.error('Error saving note:', error);
        showToast(extractErrorMessage(error, t('Failed to save note.')), 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResetFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setSearch('');
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadgeStyle = (statusVal: string) => {
    switch (statusVal) {
      case 'completed':
        return { bg: '#ecfdf5', text: '#047857' };
      case 'overdue':
        return { bg: '#fee2e2', text: '#b91c1c' };
      case 'inactive':
        return { bg: '#e2e8f0', text: '#475569' };
      case 'active':
      default:
        return { bg: '#eff6ff', text: '#1d4ed8' };
    }
  };

  const isFilterActive = statusFilter !== 'all' || typeFilter !== 'all' || search !== '';

  const renderNoteCard = ({ item }: { item: NoteReminder }) => {
    const isOverdue = item.is_overdue || (item.status === 'active' && item.notify_at && new Date(item.notify_at) < new Date());
    const effectiveStatus = isOverdue ? 'overdue' : item.status || 'active';
    const statusStyle = getStatusBadgeStyle(effectiveStatus);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: '/note-view',
            params: { id: item.ulid || String(item.id) },
          })
        }
        activeOpacity={0.8}
      >
        <View style={styles.cardContent}>
          {/* Top row: created date + status pill */}
          <View style={styles.cardMetaRow}>
            <Text style={styles.cardDateText}>{formatDate(item.created_at)}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusPillText, { color: statusStyle.text }]}>
                {t(effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)).toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.cardTitleText} numberOfLines={2}>
            {item.title || t('Untitled')}
          </Text>

          {/* Tags row: Reminder date, creator, attachment */}
          <View style={styles.cardTagsRow}>
            {item.notify_enabled && item.notify_at && (
              <View style={styles.reminderTag}>
                <Ionicons name="time-outline" size={12} color="#d97706" />
                <Text style={styles.reminderTagText}>{formatDate(item.notify_at)}</Text>
              </View>
            )}

            <View style={styles.creatorTag}>
              <Ionicons name="person-outline" size={12} color="#64748b" />
              <Text style={styles.creatorTagText}>{item.creator_name || t('Staff')}</Text>
            </View>

            {item.attachment_path && (
              <View style={styles.attachmentTag}>
                <Ionicons name="attach" size={12} color="#2563eb" />
              </View>
            )}
          </View>

          {/* Details 2-line snippet */}
          <Text style={styles.cardDetailsText} numberOfLines={2}>
            {item.details ? item.details.replace(/<[^>]*>?/gm, '') : t('No details added yet.')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <View style={[styles.mainWrapper, { maxWidth: containerMaxWidth }]}>
        {/* Sticky Header Toolbar (note-reminder-sticky) */}
        <View style={styles.stickyHeader}>
          <View style={styles.toolbar}>
            <Text style={styles.toolbarTitle}>{t('Notes & Reminders')}</Text>
            <Text style={styles.toolbarSubtitle}>{t('Manage notes and reminders with ease.')}</Text>
          </View>

        {/* Search row with filter toggle button */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder={t('Search notes and reminders...')}
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearchBtn}>
                <Ionicons name="close" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.filterIconBtn,
              (showFilters || isFilterActive) && styles.filterIconBtnActive,
            ]}
            onPress={() => setShowFilters(!showFilters)}
            activeOpacity={0.7}
            accessibilityLabel={t('Filter notes and reminders')}
          >
            <Ionicons
              name="funnel-outline"
              size={18}
              color={showFilters || isFilterActive ? '#ffffff' : '#64748b'}
            />
          </TouchableOpacity>
        </View>

        {/* Collapsible Filters Container (note-reminder-filters-container) */}
        {showFilters && (
          <View style={styles.filtersContainer}>
            <View style={styles.filtersHeader}>
              <Text style={styles.filtersTitle}>{t('FILTERS')}</Text>
              {isFilterActive && (
                <TouchableOpacity onPress={handleResetFilters} activeOpacity={0.7}>
                  <Text style={styles.filtersReset}>{t('RESET')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.filtersRow}>
              {/* Status Filter Pill */}
              <TouchableOpacity
                style={[
                  styles.filterTag,
                  statusFilter !== 'all' && styles.filterTagActive,
                ]}
                onPress={() => setStatusSheetVisible(true)}
              >
                <Text
                  style={[
                    styles.filterTagText,
                    statusFilter !== 'all' && styles.filterTagActiveText,
                  ]}
                >
                  {t('Status')}: {t(statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1))}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={statusFilter !== 'all' ? '#ffffff' : '#475569'}
                />
              </TouchableOpacity>

              {/* Type Filter Pill */}
              <TouchableOpacity
                style={[
                  styles.filterTag,
                  typeFilter !== 'all' && styles.filterTagActive,
                ]}
                onPress={() => setTypeSheetVisible(true)}
              >
                <Text
                  style={[
                    styles.filterTagText,
                    typeFilter !== 'all' && styles.filterTagActiveText,
                  ]}
                >
                  {t('Type')}: {typeFilter === 'note' ? t('Notes') : typeFilter === 'reminder' ? t('Reminders') : t('All')}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={typeFilter !== 'all' ? '#ffffff' : '#475569'}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Notes List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('Loading notes and reminders...')}</Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.ulid || String(item.id)}
          renderItem={renderNoteCard}
          contentContainerStyle={[
            styles.listContent,
            { maxWidth: isTablet ? 720 : '100%', alignSelf: 'center', width: '100%' },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadMoreWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadMoreText}>{t('Loading more notes and reminders…')}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title={
                search.trim() || statusFilter !== 'all' || typeFilter !== 'all'
                  ? t('No Matching Notes')
                  : t('No Notes or Reminders')
              }
              message={
                search.trim() || statusFilter !== 'all' || typeFilter !== 'all'
                  ? t('No records match your search or filter options.')
                  : t('Create your first entry to start tracking tasks, observations, and farm reminders.')
              }
              actionLabel={
                !(search.trim() || statusFilter !== 'all' || typeFilter !== 'all')
                  ? t('+ Add Note / Reminder')
                  : undefined
              }
              onAction={handleOpenCreateModal}
              secondaryActionLabel={
                search.trim() || statusFilter !== 'all' || typeFilter !== 'all'
                  ? t('Clear Filters')
                  : undefined
              }
              onSecondaryAction={() => {
                setSearch('');
                setStatusFilter('all');
                setTypeFilter('all');
              }}
            />
          }
        />
      )}

      {/* Floating Action Button (+ FAB) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleOpenCreateModal}
        activeOpacity={0.85}
        accessibilityLabel={t('Add Note / Reminder')}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
      </View>

      {/* Status Filter Picker Sheet Modal */}
      <ModalSheet
        visible={statusSheetVisible}
        onClose={() => setStatusSheetVisible(false)}
        title={t('Select Status')}
        maxHeight="50%"
      >
        <View style={{ gap: spacing.xs, paddingBottom: spacing.lg }}>
          {[
            { label: t('All'), value: 'all' },
            { label: t('Active'), value: 'active' },
            { label: t('Inactive'), value: 'inactive' },
            { label: t('Overdue'), value: 'overdue' },
            { label: t('Completed'), value: 'completed' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.sheetOption,
                statusFilter === opt.value && styles.sheetOptionActive,
              ]}
              onPress={() => {
                setStatusFilter(opt.value);
                setStatusSheetVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sheetOptionText,
                  statusFilter === opt.value && styles.sheetOptionActiveText,
                ]}
              >
                {opt.label}
              </Text>
              {statusFilter === opt.value && (
                <Ionicons name="checkmark" size={18} color="#16a34a" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ModalSheet>

      {/* Type Filter Picker Sheet Modal */}
      <ModalSheet
        visible={typeSheetVisible}
        onClose={() => setTypeSheetVisible(false)}
        title={t('Select Type')}
        maxHeight="45%"
      >
        <View style={{ gap: spacing.xs, paddingBottom: spacing.lg }}>
          {[
            { label: t('All'), value: 'all' },
            { label: t('Notes'), value: 'note' },
            { label: t('Reminders'), value: 'reminder' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.sheetOption,
                typeFilter === opt.value && styles.sheetOptionActive,
              ]}
              onPress={() => {
                setTypeFilter(opt.value);
                setTypeSheetVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sheetOptionText,
                  typeFilter === opt.value && styles.sheetOptionActiveText,
                ]}
              >
                {opt.label}
              </Text>
              {typeFilter === opt.value && (
                <Ionicons name="checkmark" size={18} color="#16a34a" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ModalSheet>

      {/* Add Note/Reminder Modal (matching NoteReminderForm) */}
      <ModalSheet
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        title={notifyEnabled ? t('New Reminder') : t('New Note')}
        maxHeight="88%"
      >
        <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
          <ModernInput
            label={t('Title')}
            required
            value={title}
            onChangeText={setTitle}
            placeholder={t('e.g. Inspect drip line block B')}
            placeholderTextColor="#94a3b8"
            containerStyle={{ marginBottom: spacing.md }}
          />

          <ModernInput
            label={t('Details & Instructions')}
            value={details}
            onChangeText={setDetails}
            placeholder={t('Specific instructions, observation notes, product names...')}
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={4}
            containerStyle={{ marginBottom: spacing.md }}
          />

          {/* Enable Reminder Switch */}
          <View style={styles.modalSwitchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalSwitchLabel}>{t('Enable Reminder')}</Text>
              <Text style={styles.modalSwitchSub}>{t('Schedule date for task notification')}</Text>
            </View>
            <Switch
              value={notifyEnabled}
              onValueChange={setNotifyEnabled}
              trackColor={{ false: '#cbd5e1', true: '#86efac' }}
              thumbColor={notifyEnabled ? colors.primary : '#f8fafc'}
            />
          </View>

          {/* Notify At Date Picker with Presets */}
          {notifyEnabled && (
            <View style={styles.modalNotifyBox}>
              <ModernDatePicker
                label={t('Notification Date')}
                required
                value={notifyAt}
                onChange={setNotifyAt}
              />
            </View>
          )}

          {/* Status Selector */}
          <Text style={styles.modalLabel}>{t('Status')}</Text>
          <View style={styles.statusChipsRow}>
            {(['active', 'completed', 'overdue', 'inactive'] as NoteReminderStatus[]).map((st) => (
              <TouchableOpacity
                key={st}
                style={[styles.statusChip, status === st && styles.statusChipActive]}
                onPress={() => setStatus(st)}
                activeOpacity={0.7}
              >
                <Text style={[styles.statusChipText, status === st && styles.statusChipActiveText]}>
                  {t(st.charAt(0).toUpperCase() + st.slice(1)).toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Attachment Picker */}
          <View style={{ marginTop: 12 }}>
            <AttachmentPicker
              label={t('Attach Field Photo / Document')}
              category="note-reminders"
              currentPath={attachmentPath}
              currentUrl={attachmentUrl}
              onAttachmentChange={(p, u) => {
                setAttachmentPath(p);
                setAttachmentUrl(u);
              }}
            />
          </View>

          {/* Buttons */}
          <View style={styles.modalBtnRow}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setCreateModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>{t('Cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={handleSaveNote}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalSaveText}>{notifyEnabled ? t('Save Reminder') : t('Save Note')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ModalSheet>
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

  // Sticky Header (note-reminder-sticky)
  stickyHeader: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
    gap: 8,
  },
  toolbar: {
    gap: 2,
  },
  toolbarTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  toolbarSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  searchBox: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 2,
  },
  filterIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconBtnActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },

  // Filter Dropdown Container (note-reminder-filters-container)
  filtersContainer: {
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 8,
    marginTop: 2,
  },
  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filtersTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1.2,
  },
  filtersReset: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
    letterSpacing: 0.5,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterTagActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  filterTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterTagActiveText: {
    color: '#ffffff',
  },

  // Note Card (note-reminder-card)
  listContent: {
    padding: spacing.lg,
    paddingBottom: 90,
    gap: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  cardContent: {
    gap: 10,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 22,
  },
  cardTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  reminderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fffbeb',
  },
  reminderTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  creatorTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  creatorTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  attachmentTag: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDetailsText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },

  // Centered states
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 10,
  },
  loadingText: {
    ...typography.bodySmall,
    color: '#64748b',
  },
  emptyContainer: {
    paddingVertical: 60,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  loadMoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  loadMoreText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },

  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
    zIndex: 99,
  },

  // Sheet Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheetContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  sheetOptionActive: {
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
  },
  sheetOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  sheetOptionActiveText: {
    color: '#16a34a',
    fontWeight: '700',
  },

  // Add Note Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalHeadTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    padding: 20,
    gap: 12,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    height: 42,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  modalTextArea: {
    height: 96,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  modalSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  modalSwitchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSwitchSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  modalNotifyBox: {
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  statusChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusChipActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  statusChipActiveText: {
    color: '#ffffff',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  modalSaveBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
