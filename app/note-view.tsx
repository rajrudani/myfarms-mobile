import React, { useState, useEffect } from 'react';
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
  Switch,
  SafeAreaView,
  StatusBar,
  Platform,
  Image,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { notesApi } from '../src/api/notes';
import { NoteReminder, NoteReminderStatus } from '../src/types';
import { extractErrorMessage } from '../src/api/client';
import { AttachmentPicker } from '../src/components/AttachmentPicker';
import { colors, radius, spacing, typography } from '../src/theme/tokens';

export default function NoteViewScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const noteId = params.id;
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [note, setNote] = useState<NoteReminder | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMenuVisible, setStatusMenuVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editNotifyEnabled, setEditNotifyEnabled] = useState(false);
  const [editNotifyAt, setEditNotifyAt] = useState('');
  const [editStatus, setEditStatus] = useState<NoteReminderStatus>('active');
  const [editAttachmentPath, setEditAttachmentPath] = useState<string | null>(null);
  const [editAttachmentUrl, setEditAttachmentUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchNoteDetails = async () => {
    if (!noteId) return;
    setLoading(true);
    try {
      const data = await notesApi.getById(noteId);
      setNote(data);
    } catch (error) {
      console.error('Failed to load note:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to load note details.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNoteDetails();
  }, [noteId]);

  const handleOpenEdit = () => {
    if (!note) return;
    setEditTitle(note.title);
    setEditDetails(note.details || '');
    setEditNotifyEnabled(note.notify_enabled);
    setEditAttachmentPath(note.attachment_path || null);
    setEditAttachmentUrl(note.attachment_url || null);
    if (note.notify_at) {
      setEditNotifyAt(note.notify_at.split('T')[0]);
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setEditNotifyAt(tomorrow.toISOString().split('T')[0]);
    }
    setEditStatus(note.status);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!note) return;
    if (!editTitle.trim()) {
      Alert.alert('Validation Error', 'Title is required.');
      return;
    }
    if (editNotifyEnabled && !editNotifyAt.trim()) {
      Alert.alert('Validation Error', 'Notification date is required when reminder is enabled.');
      return;
    }

    setSaving(true);
    try {
      const updated = await notesApi.update(note.ulid || note.id, {
        title: editTitle.trim(),
        details: editDetails.trim(),
        notify_enabled: editNotifyEnabled,
        notify_at: editNotifyEnabled ? editNotifyAt : null,
        status: editStatus,
        attachment_path: editAttachmentPath,
      });
      setNote(updated);
      setEditModalVisible(false);
      Alert.alert('Success', 'Note updated successfully!');
    } catch (error) {
      console.error('Failed to update note:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to update note.'));
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (nextStatus: NoteReminderStatus) => {
    if (!note) return;
    setStatusMenuVisible(false);
    try {
      const updated = await notesApi.update(note.ulid || note.id, {
        status: nextStatus,
      });
      setNote(updated);
    } catch (error) {
      console.error('Failed to change status:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to change status.'));
    }
  };

  const handleDelete = () => {
    if (!note) return;
    const isReminder = note.notify_enabled;
    const label = isReminder ? 'Reminder' : 'Note';

    Alert.alert(
      `Delete ${label}`,
      `Are you sure you want to delete this ${label.toLowerCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await notesApi.delete(note.ulid || note.id);
              router.back();
            } catch (error) {
              console.error('Failed to delete note:', error);
              Alert.alert('Error', extractErrorMessage(error, `Failed to delete ${label.toLowerCase()}.`));
            }
          },
        },
      ]
    );
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

  const isImageAttachment = (path?: string | null) => {
    if (!path) return false;
    const lower = path.toLowerCase();
    return (
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.gif')
    );
  };

  const isOverdue = note?.is_overdue || (note?.status === 'active' && note?.notify_at && new Date(note.notify_at) < new Date());
  const effectiveStatus = isOverdue ? 'overdue' : note?.status || 'active';

  const getStatusBadgeStyle = (statusVal: string) => {
    switch (statusVal) {
      case 'completed':
        return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
      case 'overdue':
        return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' };
      case 'inactive':
        return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
      case 'active':
      default:
        return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
    }
  };

  const statusStyle = getStatusBadgeStyle(effectiveStatus);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <View style={styles.topbar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#334155" />
          </TouchableOpacity>
          <Text style={styles.topbarTitle}>Loading Details...</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching record...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!note) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <View style={styles.topbar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#334155" />
          </TouchableOpacity>
          <Text style={styles.topbarTitle}>Record Not Found</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyTitle}>Note or Reminder not found</Text>
          <TouchableOpacity style={styles.backToNotesLink} onPress={() => router.back()}>
            <Text style={styles.backToNotesText}>Back to Reminders & Notes</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isReminder = Boolean(note.notify_enabled && note.notify_at);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Sticky Topbar */}
      <View style={styles.topbar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color="#334155" />
        </TouchableOpacity>

        <Text style={styles.topbarTitle}>
          {isReminder ? 'Reminder Details' : 'Note Details'}
        </Text>

        <TouchableOpacity
          style={styles.editButton}
          onPress={handleOpenEdit}
          activeOpacity={0.7}
          accessibilityLabel="Edit"
        >
          <Ionicons name="create-outline" size={18} color="#166534" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { maxWidth: isTablet ? 720 : '100%', alignSelf: 'center', width: '100%' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Meta Row: Creator • Date & Status Pill */}
        <View style={styles.metaRow}>
          <Text style={styles.createdInfo}>
            {note.creator_name || 'Staff'} • {formatDate(note.created_at)}
          </Text>

          <TouchableOpacity
            style={[
              styles.statusBadge,
              { backgroundColor: statusStyle.bg, borderColor: statusStyle.border },
            ]}
            onPress={() => setStatusMenuVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.statusDot, { backgroundColor: statusStyle.text }]} />
            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
              {effectiveStatus.toUpperCase()}
            </Text>
            <Ionicons name="chevron-down" size={12} color={statusStyle.text} />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text style={styles.titleText}>{note.title}</Text>

        {/* Scheduled Reminder Alert Box */}
        {isReminder && (
          <View style={styles.reminderAlert}>
            <View style={styles.reminderAlertBar} />
            <View style={styles.reminderAlertIconBox}>
              <Ionicons name="notifications" size={22} color="#b45309" />
            </View>
            <View style={styles.reminderAlertContent}>
              <Text style={styles.reminderAlertLabel}>SCHEDULED REMINDER</Text>
              <Text style={styles.reminderAlertValue}>Notify At: {formatDate(note.notify_at)}</Text>
            </View>
          </View>
        )}

        {/* Description Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>DESCRIPTION</Text>
          {note.details ? (
            <Text style={styles.descText}>{note.details}</Text>
          ) : (
            <Text style={styles.emptyDescText}>No description added.</Text>
          )}

          {/* Embedded Image Preview */}
          {note.attachment_url && isImageAttachment(note.attachment_path) && (
            <TouchableOpacity
              style={styles.imagePreviewWrap}
              onPress={() => setImageModalVisible(true)}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: note.attachment_url }}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <View style={styles.imagePreviewOverlay}>
                <Ionicons name="expand" size={14} color="#ffffff" />
                <Text style={styles.imagePreviewText}>Tap to preview</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* File Attachment Card (if not image) */}
        {note.attachment_url && !isImageAttachment(note.attachment_path) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ATTACHMENTS</Text>
            <TouchableOpacity
              style={styles.attachmentRow}
              onPress={() => note.attachment_url && Linking.openURL(note.attachment_url)}
              activeOpacity={0.7}
            >
              <View style={styles.attachmentIconBox}>
                <Ionicons name="document-text-outline" size={22} color="#166534" />
              </View>
              <View style={styles.attachmentInfo}>
                <Text style={styles.attachmentName} numberOfLines={1}>
                  {note.attachment_path ? note.attachment_path.split('/').pop() : 'Attached Document'}
                </Text>
                <Text style={styles.attachmentMeta}>Document file</Text>
              </View>
              <View style={styles.attachmentDownloadBtn}>
                <Ionicons name="download-outline" size={18} color="#166534" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.primaryActionBtn}
            onPress={handleOpenEdit}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={18} color="#ffffff" />
            <Text style={styles.primaryActionBtnText}>
              {isReminder ? 'Edit Reminder' : 'Edit Note'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dangerActionBtn}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={18} color="#dc2626" />
            <Text style={styles.dangerActionBtnText}>
              {isReminder ? 'Delete Reminder' : 'Delete Note'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backLinkWrap}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backLinkText}>Back to Reminders & Notes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Status Picker Modal */}
      <Modal
        visible={statusMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setStatusMenuVisible(false)}
        >
          <View style={styles.statusSheet}>
            <Text style={styles.statusSheetTitle}>Update Status</Text>
            {(['active', 'completed', 'overdue', 'inactive'] as NoteReminderStatus[]).map((st) => {
              const itemStyle = getStatusBadgeStyle(st);
              const isSelected = effectiveStatus === st;
              return (
                <TouchableOpacity
                  key={st}
                  style={[
                    styles.statusSheetOption,
                    isSelected && { backgroundColor: itemStyle.bg },
                  ]}
                  onPress={() => handleQuickStatusChange(st)}
                >
                  <View style={[styles.statusDot, { backgroundColor: itemStyle.text }]} />
                  <Text style={[styles.statusOptionText, { color: itemStyle.text }]}>
                    {st.toUpperCase()}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={18} color={itemStyle.text} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full Screen Image Preview Modal */}
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.imageModalBg}>
          <TouchableOpacity
            style={styles.imageModalClose}
            onPress={() => setImageModalVisible(false)}
          >
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
          {note.attachment_url && (
            <Image
              source={{ uri: note.attachment_url }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Edit Note Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalCard}>
            <View style={styles.editModalHead}>
              <Text style={styles.editModalTitle}>
                {editNotifyEnabled ? 'Edit Reminder' : 'Edit Note'}
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.editModalClose}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.editModalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>
                Title <Text style={{ color: '#dc2626' }}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="e.g. Check irrigation valves"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Details & Instructions</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={editDetails}
                onChangeText={setEditDetails}
                placeholder="Write observations, notes or instructions..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
              />

              {/* Reminder Switch */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Enable Reminder</Text>
                  <Text style={styles.switchSub}>Schedule date for task alert</Text>
                </View>
                <Switch
                  value={editNotifyEnabled}
                  onValueChange={setEditNotifyEnabled}
                  trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                  thumbColor={editNotifyEnabled ? colors.primary : '#f8fafc'}
                />
              </View>

              {editNotifyEnabled && (
                <View style={styles.notifyBlock}>
                  <Text style={styles.inputLabel}>
                    Notify At (YYYY-MM-DD) <Text style={{ color: '#dc2626' }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={editNotifyAt}
                    onChangeText={setEditNotifyAt}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                  />
                  <View style={styles.presetRow}>
                    <TouchableOpacity
                      style={styles.presetChip}
                      onPress={() => setEditNotifyAt(new Date().toISOString().split('T')[0])}
                    >
                      <Text style={styles.presetChipText}>Today</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.presetChip}
                      onPress={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        setEditNotifyAt(d.toISOString().split('T')[0]);
                      }}
                    >
                      <Text style={styles.presetChipText}>Tomorrow</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.presetChip}
                      onPress={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 3);
                        setEditNotifyAt(d.toISOString().split('T')[0]);
                      }}
                    >
                      <Text style={styles.presetChipText}>In 3 Days</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.presetChip}
                      onPress={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 7);
                        setEditNotifyAt(d.toISOString().split('T')[0]);
                      }}
                    >
                      <Text style={styles.presetChipText}>Next Week</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Status Picker */}
              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.statusChipsRow}>
                {(['active', 'completed', 'overdue', 'inactive'] as NoteReminderStatus[]).map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.statusChip,
                      editStatus === st && styles.statusChipActive,
                    ]}
                    onPress={() => setEditStatus(st)}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        editStatus === st && styles.statusChipActiveText,
                      ]}
                    >
                      {st.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Attachment Picker */}
              <View style={{ marginTop: 12 }}>
                <AttachmentPicker
                  label="Attachment (Photo / Document)"
                  category="note-reminders"
                  currentPath={editAttachmentPath}
                  currentUrl={editAttachmentUrl}
                  onAttachmentChange={(path, url) => {
                    setEditAttachmentPath(path);
                    setEditAttachmentUrl(url);
                  }}
                />
              </View>

              {/* Modal Buttons */}
              <View style={styles.modalButtons}>
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
                    <Text style={styles.modalSaveText}>Update</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 10,
    paddingBottom: 10,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topbarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  editButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },
  loadingText: {
    ...typography.bodySmall,
    color: '#64748b',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  backToNotesLink: {
    marginTop: 8,
  },
  backToNotesText: {
    fontSize: 14,
    color: '#16a34a',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  // Metadata Row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  createdInfo: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  titleText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    lineHeight: 30,
  },

  // Scheduled Reminder Alert Box
  reminderAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fdf8f0',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
    position: 'relative',
    overflow: 'hidden',
  },
  reminderAlertBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 6,
    backgroundColor: '#eab308',
  },
  reminderAlertIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fde6b3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderAlertContent: {
    flex: 1,
  },
  reminderAlertLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  reminderAlertValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#451a03',
    marginTop: 2,
  },

  // Description Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 20,
    gap: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.8,
  },
  descText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#111827',
  },
  emptyDescText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#94a3b8',
  },

  // Image Preview
  imagePreviewWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
    marginTop: 6,
  },
  previewImage: {
    width: '100%',
    height: 200,
  },
  imagePreviewOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  imagePreviewText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Non-image Attachment Row
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  attachmentIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentInfo: {
    flex: 1,
    minWidth: 0,
  },
  attachmentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  attachmentMeta: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  attachmentDownloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom Actions
  bottomActions: {
    gap: 12,
    marginTop: 8,
  },
  primaryActionBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#14532d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#14532d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  dangerActionBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dangerActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#dc2626',
  },
  backLinkWrap: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textDecorationLine: 'underline',
  },

  // Status Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  statusSheet: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  statusSheetTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  statusSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Image Modal
  imageModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  imageModalClose: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 30 : 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },

  // Edit Modal
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  editModalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  editModalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  editModalClose: {
    padding: 4,
  },
  editModalScroll: {
    padding: 20,
    gap: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    height: 42,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  textArea: {
    height: 96,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  switchSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  notifyBlock: {
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetRow: {
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
    backgroundColor: '#166534',
    borderColor: '#166534',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  statusChipActiveText: {
    color: '#ffffff',
  },
  modalButtons: {
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
