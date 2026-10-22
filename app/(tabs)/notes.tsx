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
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { notesApi } from '../../src/api/notes';
import { NoteReminder, NoteReminderStatus } from '../../src/types';
import { extractErrorMessage } from '../../src/api/client';
import { AttachmentPicker } from '../../src/components/AttachmentPicker';
import { BentoCard, MetricTile, StatusBadge, QuickChipGroup, SearchFilterBar } from '../../src/components/ui';
import { colors, spacing, radius, typography, shadows } from '../../src/theme/tokens';

const TYPE_FILTER_OPTIONS = [
  { label: 'All Entries', value: 'all' },
  { label: 'Reminders', value: 'reminder' },
  { label: 'Notes', value: 'note' },
];

const STATUS_FILTER_OPTIONS = [
  { label: 'All Status', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Completed', value: 'completed' },
];

const EDIT_STATUS_OPTIONS: { label: string; value: NoteReminderStatus }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Inactive', value: 'inactive' },
];

export default function NotesScreen() {
  const [notes, setNotes] = useState<NoteReminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'reminder' | 'note'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | NoteReminderStatus>('all');

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteReminder | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyAt, setNotifyAt] = useState('');
  const [status, setStatus] = useState<NoteReminderStatus>('active');
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // Fetch notes from API
  const fetchNotes = useCallback(
    async (showIndicator = true) => {
      if (showIndicator) setLoading(true);
      try {
        const data = await notesApi.getAll({
          search: searchQuery,
          status: selectedStatus === 'all' ? undefined : selectedStatus,
          type: selectedType === 'all' ? undefined : selectedType,
        });
        setNotes(data);
      } catch (error: any) {
        console.error('Error fetching notes:', error);
        Alert.alert('Error', extractErrorMessage(error, 'Failed to load notes and reminders.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [searchQuery, selectedType, selectedStatus]
  );

  useEffect(() => {
    fetchNotes(true);
  }, [fetchNotes]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotes(false);
  };

  // Open modal for creating
  const handleOpenCreateModal = () => {
    setEditingNote(null);
    setTitle('');
    setDetails('');
    setNotifyEnabled(false);
    setAttachmentPath(null);
    setAttachmentUrl(null);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setNotifyAt(tomorrow.toISOString().split('T')[0]);
    setStatus('active');
    setModalVisible(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (note: NoteReminder) => {
    setEditingNote(note);
    setTitle(note.title);
    setDetails(note.details || '');
    setNotifyEnabled(note.notify_enabled);
    setAttachmentPath(note.attachment_path || null);
    setAttachmentUrl(note.attachment_url || null);
    if (note.notify_at) {
      setNotifyAt(note.notify_at.split('T')[0]);
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setNotifyAt(tomorrow.toISOString().split('T')[0]);
    }
    setStatus(note.status);
    setModalVisible(true);
  };

  // Save note
  const handleSaveNote = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Title is required.');
      return;
    }

    if (notifyEnabled && !notifyAt.trim()) {
      Alert.alert('Validation Error', 'Notification date is required when reminder is enabled.');
      return;
    }

    try {
      if (editingNote) {
        await notesApi.update(editingNote.ulid, {
          title,
          details,
          notify_enabled: notifyEnabled,
          notify_at: notifyEnabled ? notifyAt : null,
          status,
          attachment_path: attachmentPath,
        });
        Alert.alert('Success', 'Reminder updated successfully!');
      } else {
        await notesApi.create({
          title,
          details,
          notify_enabled: notifyEnabled,
          notify_at: notifyEnabled ? notifyAt : null,
          status,
          attachment_path: attachmentPath,
        });
        Alert.alert('Success', 'Reminder added successfully!');
      }
      setModalVisible(false);
      fetchNotes(false);
    } catch (error: any) {
      console.error('Error saving note:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to save the note.'));
    }
  };

  // Quick toggle status between completed and active
  const handleToggleStatus = async (note: NoteReminder) => {
    const isNowCompleted = note.status !== 'completed';
    const nextStatus: NoteReminderStatus = isNowCompleted ? 'completed' : 'active';
    setNotes((prev) =>
      prev.map((n) =>
        n.ulid === note.ulid || n.id === note.id
          ? { ...n, status: nextStatus, is_overdue: false }
          : n
      )
    );
    try {
      const updated = await notesApi.toggleStatus(note.ulid || note.id);
      setNotes((prev) =>
        prev.map((n) => (n.ulid === note.ulid || n.id === note.id ? updated : n))
      );
    } catch (error) {
      console.error('Error toggling note status:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to update note status.'));
      fetchNotes(false);
    }
  };

  // Delete note
  const handleDeleteNote = (note: NoteReminder) => {
    Alert.alert('Confirm Delete', `Are you sure you want to delete "${note.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await notesApi.delete(note.ulid || note.id);
            fetchNotes(false);
          } catch (error) {
            console.error('Error deleting note:', error);
            Alert.alert('Error', extractErrorMessage(error, 'Failed to delete note.'));
          }
        },
      },
    ]);
  };

  // Summary counts
  const noteStats = useMemo(() => {
    const active = notes.filter((n) => n.status === 'active' || n.status === 'overdue').length;
    const completed = notes.filter((n) => n.status === 'completed').length;
    return { total: notes.length, active, completed };
  }, [notes]);

  // Render Single Note Item
  const renderNoteItem = ({ item }: { item: NoteReminder }) => {
    const isCompleted = item.status === 'completed';
    const isReminder = item.notify_enabled;
    const isOverdue = item.is_overdue || item.status === 'overdue';

    const statusVariant = isCompleted
      ? 'success'
      : isOverdue
      ? 'danger'
      : item.status === 'active'
      ? 'info'
      : 'neutral';

    let formattedNotifyAt = '';
    if (item.notify_at) {
      const d = new Date(item.notify_at);
      formattedNotifyAt = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    let formattedCreatedAt = '';
    if (item.created_at) {
      const d = new Date(item.created_at);
      formattedCreatedAt = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    return (
      <BentoCard
        variant="elevated"
        style={[styles.card, isCompleted && styles.cardCompleted]}
      >
        {/* Header: Date & Badges */}
        <View style={styles.cardTopRow}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.slate400} />
            <Text style={styles.createdDate}>{formattedCreatedAt || '-'}</Text>
          </View>
          <View style={styles.badgesCluster}>
            <StatusBadge
              label={isReminder ? 'REMINDER' : 'NOTE'}
              variant={isReminder ? 'warning' : 'neutral'}
            />
            <StatusBadge
              label={
                isCompleted
                  ? 'COMPLETED'
                  : isOverdue
                  ? 'OVERDUE'
                  : item.status === 'active'
                  ? 'ACTIVE'
                  : 'INACTIVE'
              }
              variant={statusVariant}
              dot={isOverdue || item.status === 'active'}
            />
          </View>
        </View>

        {/* Title with Tactile Checkbox */}
        <View style={styles.titleRow}>
          <TouchableOpacity
            style={styles.checkboxTouch}
            onPress={() => handleToggleStatus(item)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={isCompleted ? colors.primary : colors.slate400}
            />
          </TouchableOpacity>
          <Text
            style={[styles.noteTitle, isCompleted && styles.noteTitleCompleted]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
        </View>

        {/* Details text */}
        {item.details ? (
          <View style={styles.detailsBox}>
            <Text
              style={[styles.detailsText, isCompleted && styles.detailsTextCompleted]}
              numberOfLines={3}
            >
              “{item.details}”
            </Text>
          </View>
        ) : null}

        {/* Footer info & CRUD buttons */}
        <View style={styles.cardFooter}>
          <View style={styles.footerTags}>
            {item.notify_enabled && item.notify_at && (
              <View
                style={[
                  styles.footerTag,
                  isOverdue ? styles.footerTagOverdue : styles.footerTagReminder,
                ]}
              >
                <Ionicons
                  name="alarm-outline"
                  size={12}
                  color={isOverdue ? colors.dangerText : colors.warningText}
                />
                <Text
                  style={[
                    styles.footerTagText,
                    { color: isOverdue ? colors.dangerText : colors.warningText },
                  ]}
                >
                  {formattedNotifyAt}
                </Text>
              </View>
            )}

            {item.creator_name ? (
              <View style={styles.footerTag}>
                <Ionicons name="person-outline" size={12} color={colors.slate500} />
                <Text style={styles.footerTagText}>{item.creator_name}</Text>
              </View>
            ) : null}

            {item.attachment_url ? (
              <TouchableOpacity
                style={[styles.footerTag, styles.footerTagAttachment]}
                onPress={() => setPreviewModalUrl(item.attachment_url || null)}
                activeOpacity={0.7}
              >
                <Ionicons name="attach" size={13} color={colors.primary} />
                <Text style={[styles.footerTagText, { color: colors.primaryDark, fontWeight: '700' }]}>
                  Photo
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleOpenEditModal(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil-outline" size={14} color={colors.slate700} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={() => handleDeleteNote(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={14} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </BentoCard>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleCol}>
          <Text style={styles.headerKicker}>FIELD LOGS & TASKS</Text>
          <Text style={styles.headerTitle}>Notes & Reminders</Text>
        </View>
      </View>

      {/* Search and Filters Section */}
      <View style={styles.filterSection}>
        <SearchFilterBar
          query={searchQuery}
          onChangeQuery={setSearchQuery}
          placeholder="Search notes, reminders, or tasks..."
        />

        <View style={styles.chipsSection}>
          <QuickChipGroup
            options={TYPE_FILTER_OPTIONS}
            selectedValue={selectedType}
            onSelect={(val) => setSelectedType(val as any)}
            scrollable
            size="sm"
          />
          <QuickChipGroup
            options={STATUS_FILTER_OPTIONS}
            selectedValue={selectedStatus}
            onSelect={(val) => setSelectedStatus(val as any)}
            scrollable
            size="sm"
          />
        </View>
      </View>

      {/* Metric Tiles Header */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryTile}>
          <MetricTile
            label="TOTAL"
            value={noteStats.total}
            iconName="notebook-outline"
            iconColor={colors.slate700}
            iconBg={colors.slate100}
          />
        </View>
        <View style={styles.summaryTile}>
          <MetricTile
            label="ACTIVE DUE"
            value={noteStats.active}
            iconName="alarm"
            iconColor={colors.warningText}
            iconBg={colors.warningSurface}
          />
        </View>
        <View style={styles.summaryTile}>
          <MetricTile
            label="COMPLETED"
            value={noteStats.completed}
            iconName="check-all"
            iconColor={colors.successText}
            iconBg={colors.successSurface}
          />
        </View>
      </View>

      {/* Notes List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading task reminders...</Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.ulid}
          renderItem={renderNoteItem}
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
                <Ionicons name="document-text-outline" size={36} color={colors.slate400} />
              </View>
              <Text style={styles.emptyTitle}>No Reminders Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'No notes match your current search'
                  : 'Tap + button below to log a farm note or scheduled reminder'}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleOpenCreateModal}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Add / Edit Note Modal */}
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
                <Text style={styles.modalKicker}>TASK MANAGER</Text>
                <Text style={styles.modalTitle}>
                  {editingNote ? 'Edit Note / Reminder' : 'New Note / Reminder'}
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
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Inspect drip line block B"
                placeholderTextColor={colors.slate400}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.inputLabel}>Details & Instructions</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Specific instructions, observation notes, product names..."
                placeholderTextColor={colors.slate400}
                multiline
                numberOfLines={4}
                value={details}
                onChangeText={setDetails}
              />

              {/* Reminder toggle */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Enable Reminder Alert</Text>
                  <Text style={styles.switchSubLabel}>
                    Schedule date for task notification
                  </Text>
                </View>
                <Switch
                  value={notifyEnabled}
                  onValueChange={setNotifyEnabled}
                  trackColor={{ false: colors.slate300, true: colors.primaryLight }}
                  thumbColor={notifyEnabled ? colors.primary : colors.slate100}
                />
              </View>

              {notifyEnabled && (
                <View style={styles.reminderScheduleBlock}>
                  <Text style={styles.inputLabel}>Notify At Date (YYYY-MM-DD) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2026-06-28"
                    placeholderTextColor={colors.slate400}
                    value={notifyAt}
                    onChangeText={setNotifyAt}
                  />
                  <View style={styles.datePresets}>
                    <TouchableOpacity
                      style={styles.presetPill}
                      onPress={() => {
                        const today = new Date();
                        setNotifyAt(today.toISOString().split('T')[0]);
                      }}
                    >
                      <Text style={styles.presetText}>Today</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.presetPill}
                      onPress={() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        setNotifyAt(tomorrow.toISOString().split('T')[0]);
                      }}
                    >
                      <Text style={styles.presetText}>Tomorrow</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.presetPill}
                      onPress={() => {
                        const in3Days = new Date();
                        in3Days.setDate(in3Days.getDate() + 3);
                        setNotifyAt(in3Days.toISOString().split('T')[0]);
                      }}
                    >
                      <Text style={styles.presetText}>In 3 Days</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.presetPill}
                      onPress={() => {
                        const nextWeek = new Date();
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        setNotifyAt(nextWeek.toISOString().split('T')[0]);
                      }}
                    >
                      <Text style={styles.presetText}>Next Week</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {editingNote && (
                <View>
                  <Text style={styles.inputLabel}>Status</Text>
                  <QuickChipGroup
                    options={EDIT_STATUS_OPTIONS}
                    selectedValue={status}
                    onSelect={(val) => setStatus(val)}
                  />
                </View>
              )}

              <View style={{ marginTop: spacing.md }}>
                <AttachmentPicker
                  label="Attach Field Photo / Document"
                  category="note-reminders"
                  currentPath={attachmentPath}
                  currentUrl={attachmentUrl}
                  onAttachmentChange={(p, u) => {
                    setAttachmentPath(p);
                    setAttachmentUrl(u);
                  }}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleSaveNote}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                  <Text style={styles.saveBtnText}>
                    {editingNote ? 'Update Note' : 'Save Note'}
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
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
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
    ...typography.title1,
    color: colors.slate900,
  },
  filterSection: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  chipsSection: {
    gap: 4,
    marginTop: spacing.xs,
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
    gap: spacing.xs,
  },
  cardCompleted: {
    opacity: 0.75,
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
  createdDate: {
    ...typography.caption,
    color: colors.slate400,
  },
  badgesCluster: {
    flexDirection: 'row',
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: 2,
  },
  checkboxTouch: {
    paddingTop: 1,
  },
  noteTitle: {
    ...typography.title3,
    color: colors.slate900,
    flex: 1,
    lineHeight: 22,
  },
  noteTitleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.slate400,
  },
  detailsBox: {
    backgroundColor: colors.slate50,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: 2,
  },
  detailsText: {
    ...typography.body,
    fontSize: 13,
    color: colors.slate600,
    lineHeight: 18,
  },
  detailsTextCompleted: {
    color: colors.slate400,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    paddingTop: spacing.xs,
    marginTop: 4,
  },
  footerTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  footerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.slate100,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  footerTagReminder: {
    backgroundColor: colors.warningSurface,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  footerTagOverdue: {
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  footerTagAttachment: {
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  footerTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.slate600,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.xs,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    backgroundColor: colors.dangerSurface,
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
  reminderScheduleBlock: {
    marginTop: spacing.xs,
  },
  datePresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs,
  },
  presetPill: {
    backgroundColor: colors.slate100,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  presetText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate700,
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
