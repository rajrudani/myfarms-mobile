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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { mastersApi } from '../src/api/masters';
import { Crop } from '../src/types';
import { extractErrorMessage } from '../src/api/client';

export default function CropsScreen() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Form Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCrop, setEditingCrop] = useState<Crop | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [nameGu, setNameGu] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [category, setCategory] = useState('FIELD_CROPS');
  const [unit, setUnit] = useState('BAG');
  const [isPerennial, setIsPerennial] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const fetchCrops = useCallback(async (showIndicator = true) => {
    if (showIndicator) setLoading(true);
    try {
      const data = await mastersApi.getCrops();
      setCrops(data);
    } catch (error) {
      console.error('Error fetching crops:', error);
      Alert.alert('Error', 'Failed to load crops.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCrops(true);
  }, [fetchCrops]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCrops(false);
  };

  const handleToggleStatus = async (crop: Crop) => {
    try {
      await mastersApi.toggleCropStatus(crop.id);
      fetchCrops(false);
    } catch (error) {
      console.error('Error toggling crop status:', error);
      Alert.alert('Error', 'Failed to update crop status.');
    }
  };

  const openAddModal = () => {
    setEditingCrop(null);
    setName('');
    setNameGu('');
    setNameHi('');
    setCategory('FIELD_CROPS');
    setUnit('BAG');
    setIsPerennial(false);
    setIsActive(true);
    setModalVisible(true);
  };

  const openEditModal = (crop: Crop) => {
    setEditingCrop(crop);
    setName(crop.name);
    setNameGu(crop.name_gu || '');
    setNameHi(crop.name_hi || '');
    setCategory(crop.category);
    setUnit(crop.unit);
    setIsPerennial(crop.is_perennial);
    setIsActive(crop.is_active);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !category || !unit) {
      Alert.alert('Validation Error', 'Crop name, category and default unit are required.');
      return;
    }

    const payload = {
      name,
      name_gu: nameGu || null,
      name_hi: nameHi || null,
      category,
      unit,
      is_perennial: isPerennial,
      is_active: isActive,
    };

    try {
      if (editingCrop) {
        await mastersApi.updateCrop(editingCrop.id, payload);
        Alert.alert('Success', 'Crop updated successfully.');
      } else {
        await mastersApi.createCrop(payload);
        Alert.alert('Success', 'Crop added successfully.');
      }
      setModalVisible(false);
      fetchCrops(false);
    } catch (error: any) {
      console.error('Error saving crop:', error);
      const msg = extractErrorMessage(error, 'Failed to save crop.');
      Alert.alert('Error', msg);
    }
  };

  // Filter crops by search
  const filteredCrops = crops.filter(crop => {
    const q = search.toLowerCase();
    return (
      crop.name.toLowerCase().includes(q) ||
      (crop.name_gu && crop.name_gu.toLowerCase().includes(q)) ||
      (crop.name_hi && crop.name_hi.toLowerCase().includes(q)) ||
      crop.category.toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Crops Master</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search crops..."
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#166534" />
        </View>
      ) : (
        <FlatList
          data={filteredCrops}
          keyExtractor={(item) => item.ulid}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#166534']} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="grid-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No crops found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.cropCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cropNameText}>{item.name}</Text>
                  {item.name_gu || item.name_hi ? (
                    <Text style={styles.translationsText}>
                      {item.name_gu ? `GU: ${item.name_gu}` : ''}
                      {item.name_gu && item.name_hi ? '  |  ' : ''}
                      {item.name_hi ? `HI: ${item.name_hi}` : ''}
                    </Text>
                  ) : null}
                </View>
                
                <View style={styles.badgeRow}>
                  {item.is_perennial && (
                    <View style={[styles.badge, styles.perennialBadge]}>
                      <Text style={styles.badgeText}>PERENNIAL</Text>
                    </View>
                  )}
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.category.replace('_', ' ')}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.unitText}>Default unit: {item.unit}</Text>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.statusToggleRow}>
                  <Text style={styles.statusLabel}>Active</Text>
                  <Switch
                    value={item.is_active}
                    onValueChange={() => handleToggleStatus(item)}
                    trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                    thumbColor={item.is_active ? '#166534' : '#f1f5f9'}
                  />
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
                    <Ionicons name="pencil-outline" size={16} color="#475569" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <Ionicons name="add-outline" size={32} color="#fff" />
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
              <Text style={styles.modalTitle}>{editingCrop ? 'Edit Crop' : 'Add Crop'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.inputLabel}>Crop Name (English)*</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Cotton"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.inputLabel}>Crop Name (Gujarati)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. કપાસ"
                value={nameGu}
                onChangeText={setNameGu}
              />

              <Text style={styles.inputLabel}>Crop Name (Hindi)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. कपास"
                value={nameHi}
                onChangeText={setNameHi}
              />

              <Text style={styles.inputLabel}>Category*</Text>
              <View style={styles.pickerContainer}>
                {['FIELD_CROPS', 'VEGETABLE_CROPS', 'FRUIT_CROPS', 'FLOWERS', 'SPICES'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.pickerItem, category === cat && styles.pickerItemActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.pickerItemText, category === cat && styles.pickerItemTextActive]}>
                      {cat.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Default unit*</Text>
              <View style={styles.pickerContainer}>
                {['BAG', 'KG', 'TON', 'BOX', 'MAN', 'QUINTAL'].map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.pickerItem, unit === u && styles.pickerItemActive]}
                    onPress={() => setUnit(u)}
                  >
                    <Text style={[styles.pickerItemText, unit === u && styles.pickerItemTextActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Perennial Crop</Text>
                  <Text style={styles.switchSubLabel}>Does this crop grow multi-season?</Text>
                </View>
                <Switch
                  value={isPerennial}
                  onValueChange={setIsPerennial}
                  trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                  thumbColor={isPerennial ? '#166534' : '#f1f5f9'}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>Save</Text>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    marginRight: 12,
    padding: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  searchSection: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 120,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  cropCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cropNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  translationsText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
    marginLeft: 6,
  },
  perennialBadge: {
    backgroundColor: '#fef3c7',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1e40af',
  },
  cardBody: {
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  unitText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  statusToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginRight: 8,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginLeft: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#166534',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#166534',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalScroll: {
    paddingBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    marginBottom: 8,
  },
  pickerItemActive: {
    backgroundColor: '#166534',
  },
  pickerItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  pickerItemTextActive: {
    color: '#ffffff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginTop: 8,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  switchSubLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f1f5f9',
    marginRight: 12,
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#166534',
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
