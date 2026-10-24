import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { mastersApi } from '../src/api/masters';
import { FarmActivityMaster } from '../src/types';
import { extractErrorMessage } from '../src/api/client';
import { colors, radius, spacing, shadows } from '../src/theme/tokens';
import {
  BentoCard,
  StatusBadge,
  SearchFilterBar,
} from '../src/components/ui';

export default function ActivitiesScreen() {
  const [activities, setActivities] = useState<FarmActivityMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Form Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState<FarmActivityMaster | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [nameGu, setNameGu] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  const fetchActivities = useCallback(async (showIndicator = true) => {
    if (showIndicator) setLoading(true);
    try {
      const data = await mastersApi.getActivities();
      setActivities(data);
    } catch (error) {
      console.error('Error fetching activities:', error);
      Alert.alert('Error', 'Failed to load activity templates.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities(true);
  }, [fetchActivities]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivities(false);
  };

  const handleToggleStatus = async (activity: FarmActivityMaster) => {
    try {
      await mastersApi.toggleActivityStatus(activity.id);
      fetchActivities(false);
    } catch (error) {
      console.error('Error toggling status:', error);
      Alert.alert('Error', 'Failed to update status.');
    }
  };

  const openAddModal = () => {
    setEditingActivity(null);
    setName('');
    setNameGu('');
    setNameHi('');
    setNotes('');
    setIsActive(true);
    setModalVisible(true);
  };

  const openEditModal = (activity: FarmActivityMaster) => {
    setEditingActivity(activity);
    setName(activity.name);
    setNameGu(activity.name_gu || '');
    setNameHi(activity.name_hi || '');
    setNotes(activity.notes || '');
    setIsActive(activity.is_active);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Activity name is required.');
      return;
    }

    const payload = {
      name,
      name_gu: nameGu || null,
      name_hi: nameHi || null,
      notes: notes || null,
      is_active: isActive,
    };

    try {
      if (editingActivity) {
        await mastersApi.updateActivity(editingActivity.id, payload);
        Alert.alert('Success', 'Activity template updated successfully.');
      } else {
        await mastersApi.createActivity(payload);
        Alert.alert('Success', 'Activity template added successfully.');
      }
      setModalVisible(false);
      fetchActivities(false);
    } catch (error: any) {
      console.error('Error saving activity:', error);
      const msg = extractErrorMessage(error, 'Failed to save activity.');
      Alert.alert('Error', msg);
    }
  };

  const filteredActivities = activities.filter((activity) => {
    const q = search.toLowerCase();
    return (
      activity.name.toLowerCase().includes(q) ||
      (activity.name_gu && activity.name_gu.toLowerCase().includes(q)) ||
      (activity.name_hi && activity.name_hi.toLowerCase().includes(q))
    );
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#334155" />
          </TouchableOpacity>
          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>Activity Master</Text>
            <Text style={styles.headerSubtitle}>Manage agricultural tasks and operational activities.</Text>
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <SearchFilterBar
          query={search}
          onChangeQuery={setSearch}
          placeholder="Search activities..."
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading templates...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredActivities}
          keyExtractor={(item) => item.ulid}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
              <MaterialCommunityIcons name="clipboard-text-outline" size={40} color={colors.slate400} />
              <Text style={styles.emptyText}>No activity templates found.</Text>
              <Text style={styles.emptySubtext}>Tap "+" to add a new activity protocol.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <BentoCard
              variant="elevated"
              style={[styles.actCard, !item.is_active && styles.actCardInactive]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.actIconWrap}>
                  <MaterialCommunityIcons name="leaf-circle-outline" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actNameText}>{item.name}</Text>
                  {item.name_gu || item.name_hi ? (
                    <View style={styles.langRow}>
                      {item.name_gu ? (
                        <StatusBadge label={`GU: ${item.name_gu}`} variant="neutral" dot={false} />
                      ) : null}
                      {item.name_hi ? (
                        <StatusBadge label={`HI: ${item.name_hi}`} variant="neutral" dot={false} />
                      ) : null}
                    </View>
                  ) : null}
                </View>

                <StatusBadge
                  label={item.is_active ? 'Active' : 'Inactive'}
                  variant={item.is_active ? 'success' : 'neutral'}
                  dot
                />
              </View>

              {item.notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>{item.notes}</Text>
                </View>
              ) : null}

              <View style={styles.cardFooter}>
                <View style={styles.statusToggleRow}>
                  <Text style={styles.statusLabel}>Enabled</Text>
                  <Switch
                    value={item.is_active}
                    onValueChange={() => handleToggleStatus(item)}
                    trackColor={{ false: colors.slate300, true: colors.primaryBorder }}
                    thumbColor={item.is_active ? colors.primary : colors.slate100}
                  />
                </View>

                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => openEditModal(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="pencil-outline" size={15} color={colors.slate700} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </BentoCard>
          )}
        />
      )}

      {/* Glowing FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAddModal} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingActivity ? 'Edit Activity Template' : 'Add Activity Template'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.inputLabel}>
                Activity Name (English) <Text style={{ color: colors.danger }}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Sowing, Weeding, Spraying"
                placeholderTextColor={colors.slate400}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.inputLabel}>Activity Name (Gujarati)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. વાવણી"
                placeholderTextColor={colors.slate400}
                value={nameGu}
                onChangeText={setNameGu}
              />

              <Text style={styles.inputLabel}>Activity Name (Hindi)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. बुवाई"
                placeholderTextColor={colors.slate400}
                value={nameHi}
                onChangeText={setNameHi}
              />

              <Text style={styles.inputLabel}>Notes & Instructions</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Standard operating instructions or protocol notes..."
                placeholderTextColor={colors.slate400}
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.saveBtn]}
                  onPress={handleSave}
                >
                  <Text style={styles.saveBtnText}>Save Template</Text>
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
    backgroundColor: colors.slate50,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.slate500,
    marginTop: 10,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 12,
    paddingBottom: 8,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 90,
    gap: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate800,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.slate500,
    marginTop: 4,
  },
  actCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  actCardInactive: {
    opacity: 0.75,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  actIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate900,
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  notesBox: {
    backgroundColor: colors.slate50,
    borderRadius: radius.xs,
    padding: 8,
    marginTop: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  notesText: {
    fontSize: 12,
    color: colors.slate600,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  statusToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate600,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate700,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glowPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
    ...shadows.medium,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.slate900,
  },
  modalScroll: {
    paddingBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate700,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.slate900,
    backgroundColor: colors.slate50,
  },
  textArea: {
    height: 70,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.lg,
  },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: colors.slate100,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate700,
  },
  saveBtn: {
    backgroundColor: colors.primary,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
