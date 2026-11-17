import React, { useState, useEffect, useCallback } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { mastersApi } from '../src/api/masters';
import { Crop } from '../src/types';
import { extractErrorMessage, getBaseUrl } from '../src/api/client';
import { takePhoto, pickImage, uploadMedia } from '../src/utils/media';
import { useTranslation } from '../src/i18n/I18nContext';
import { ModernInput, EmptyState } from '../src/components/ui';

const getAbsoluteImageUrl = (urlPath?: string | null) => {
  if (!urlPath) return undefined;
  if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) {
    return urlPath;
  }
  const apiBase = getBaseUrl().replace('/api', '');
  return `${apiBase}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
};

export default function CropsScreen() {
  const { t, locale } = useTranslation();
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
  const [unit, setUnit] = useState('kg');
  const [defaultDurationDays, setDefaultDurationDays] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
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

  const handlePickImage = async () => {
    try {
      const asset = await pickImage();
      if (!asset) return;
      setUploadingImage(true);
      const res = await uploadMedia(asset.uri, 'crop-images', asset.fileName, asset.mimeType);
      setImagePath(res.path);
      setImageUrl(res.url);
    } catch (err: any) {
      console.error('Failed to upload crop image:', err);
      Alert.alert('Upload Error', extractErrorMessage(err, 'Failed to upload crop photo.'));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const asset = await takePhoto();
      if (!asset) return;
      setUploadingImage(true);
      const res = await uploadMedia(asset.uri, 'crop-images', asset.fileName, asset.mimeType);
      setImagePath(res.path);
      setImageUrl(res.url);
    } catch (err: any) {
      console.error('Failed to capture crop photo:', err);
      Alert.alert('Upload Error', extractErrorMessage(err, 'Failed to capture crop photo.'));
    } finally {
      setUploadingImage(false);
    }
  };

  const openAddModal = () => {
    setEditingCrop(null);
    setName('');
    setNameGu('');
    setNameHi('');
    setCategory('FIELD_CROPS');
    setUnit('kg');
    setDefaultDurationDays('');
    setImagePath('');
    setImageUrl('');
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
    setUnit(crop.unit || 'kg');
    setDefaultDurationDays(crop.default_duration_days ? crop.default_duration_days.toString() : '');
    setImagePath(crop.image_path || '');
    setImageUrl(crop.image_url || '');
    setIsPerennial(crop.is_perennial);
    setIsActive(crop.is_active);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !category || !unit) {
      Alert.alert('Validation Error', 'Crop name, category and default unit are required.');
      return;
    }

    const payload: Partial<Crop> = {
      name: name.trim(),
      name_gu: nameGu.trim() || null,
      name_hi: nameHi.trim() || null,
      category,
      unit,
      default_duration_days: defaultDurationDays ? parseInt(defaultDurationDays, 10) : null,
      image_path: imagePath || null,
      is_perennial: isPerennial,
      is_active: isActive,
    };

    try {
      if (editingCrop) {
        await mastersApi.updateCrop(editingCrop.id, payload);
        Alert.alert(t('Success'), t('Crop updated successfully.'));
      } else {
        await mastersApi.createCrop(payload);
        Alert.alert(t('Success'), t('Crop added successfully.'));
      }
      setModalVisible(false);
      fetchCrops(false);
    } catch (error: any) {
      console.error('Error saving crop:', error);
      const msg = extractErrorMessage(error, t('Failed to save crop.'));
      Alert.alert(t('Error'), msg);
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#334155" />
          </TouchableOpacity>
          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>{t('Crops')}</Text>
            <Text style={styles.headerSubtitle}>{t('Manage crop masters for your farm group.')}</Text>
          </View>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('Search for crops...')}
            placeholderTextColor="#94a3b8"
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
            <EmptyState
              icon="leaf-outline"
              title={search ? t('No Matching Crops') : t('No Crops Registered')}
              message={
                search
                  ? t('No crops match your search query.')
                  : t('Add master crops with category, harvest units, and duration days.')
              }
              actionLabel={!search ? t('+ Add First Crop') : undefined}
              onAction={openAddModal}
              secondaryActionLabel={search ? t('Clear Search') : undefined}
              onSecondaryAction={() => setSearch('')}
            />
          }
          renderItem={({ item }) => {
            const imageUrl = getAbsoluteImageUrl((item as any).image_url || (item as any).image_path);
            const categoryLabel = item.category ? item.category.replace('_', ' ') : 'Crop';

            return (
              <View style={styles.cropCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cropAvatarCol}>
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.cropAvatarImg} />
                    ) : (
                      <View style={styles.cropAvatarPlaceholder}>
                        <Ionicons name="leaf-outline" size={20} color="#15b88a" />
                      </View>
                    )}
                  </View>

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
                  
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryPillText}>{categoryLabel}</Text>
                  </View>
                </View>

                {/* Pill row */}
                <View style={styles.pillsRow}>
                  <View style={[styles.statusPill, item.is_active ? styles.statusPillActive : styles.statusPillInactive]}>
                    <View style={[styles.pillDot, { backgroundColor: item.is_active ? '#14815f' : '#64748b' }]} />
                    <Text style={[styles.statusPillText, { color: item.is_active ? '#14815f' : '#64748b' }]}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>

                  <View style={[styles.statusPill, item.is_perennial ? styles.perennialPill : styles.seasonalPill]}>
                    <Text style={[styles.statusPillText, { color: item.is_perennial ? '#3f5bf0' : '#c97712' }]}>
                      {item.is_perennial ? 'Perennial' : 'Seasonal'}
                    </Text>
                  </View>

                  <View style={styles.unitPill}>
                    <Text style={styles.unitPillText}>Unit: {item.unit}</Text>
                  </View>

                  {item.default_duration_days ? (
                    <View style={[styles.statusPill, { backgroundColor: '#f1f5f9' }]}>
                      <Ionicons name="time-outline" size={12} color="#475569" style={{ marginRight: 4 }} />
                      <Text style={[styles.statusPillText, { color: '#475569' }]}>
                        {item.default_duration_days}d
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Card footer */}
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

                  <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)} activeOpacity={0.7}>
                    <Ionicons name="pencil-outline" size={15} color="#475569" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
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
              <Text style={styles.inputLabel}>Crop Image</Text>
              <View style={styles.imagePickerCard}>
                {uploadingImage ? (
                  <View style={styles.imageLoadingBox}>
                    <ActivityIndicator color="#166534" />
                    <Text style={styles.imageLoadingText}>Uploading photo...</Text>
                  </View>
                ) : imageUrl || imagePath ? (
                  <View style={styles.imagePreviewWrap}>
                    <Image source={{ uri: getAbsoluteImageUrl(imageUrl || imagePath) }} style={styles.imagePreview} />
                    <View style={styles.imageActionBtns}>
                      <TouchableOpacity style={styles.imageActionBtn} onPress={handlePickImage} activeOpacity={0.8}>
                        <Ionicons name="image-outline" size={14} color="#166534" />
                        <Text style={styles.imageActionBtnText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.imageActionBtn, { borderColor: '#ef4444' }]}
                        onPress={() => {
                          setImagePath('');
                          setImageUrl('');
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="trash-outline" size={14} color="#ef4444" />
                        <Text style={[styles.imageActionBtnText, { color: '#ef4444' }]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.imageUploadPlaceholder}>
                    <Ionicons name="cloud-upload-outline" size={28} color="#94a3b8" />
                    <Text style={styles.imageUploadHint}>Upload photo to easily identify crop</Text>
                    <View style={styles.imageBtnRow}>
                      <TouchableOpacity style={styles.uploadPickBtn} onPress={handlePickImage} activeOpacity={0.8}>
                        <Ionicons name="images-outline" size={16} color="#166534" />
                        <Text style={styles.uploadPickBtnText}>Select Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.uploadPickBtn} onPress={handleTakePhoto} activeOpacity={0.8}>
                        <Ionicons name="camera-outline" size={16} color="#166534" />
                        <Text style={styles.uploadPickBtnText}>Take Photo</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              <ModernInput
                label="Crop Name (English)"
                required
                placeholder="e.g. Cotton"
                value={name}
                onChangeText={setName}
                containerStyle={{ marginTop: 10 }}
              />

              <ModernInput
                label="Crop Name (Gujarati)"
                placeholder="e.g. કપાસ"
                value={nameGu}
                onChangeText={setNameGu}
                containerStyle={{ marginTop: 10 }}
              />

              <ModernInput
                label="Crop Name (Hindi)"
                placeholder="e.g. कपास"
                value={nameHi}
                onChangeText={setNameHi}
                containerStyle={{ marginTop: 10 }}
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

              <Text style={styles.inputLabel}>Default Harvest Unit*</Text>
              <View style={styles.pickerContainer}>
                {[
                  { label: 'Kg', value: 'kg' },
                  { label: 'Quintal', value: 'quintal' },
                  { label: 'Ton', value: 'ton' },
                  { label: 'Piece', value: 'piece' },
                ].map((u) => (
                  <TouchableOpacity
                    key={u.value}
                    style={[styles.pickerItem, unit.toLowerCase() === u.value && styles.pickerItemActive]}
                    onPress={() => setUnit(u.value)}
                  >
                    <Text style={[styles.pickerItemText, unit.toLowerCase() === u.value && styles.pickerItemTextActive]}>
                      {u.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ModernInput
                label="Default Duration (Days)"
                placeholder="e.g. 120 (approx days from sowing to harvest)"
                keyboardType="number-pad"
                suffix="days"
                value={defaultDurationDays}
                onChangeText={setDefaultDurationDays}
                containerStyle={{ marginTop: 10 }}
              />

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
    paddingHorizontal: 16,
    paddingTop: 12,
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
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    borderColor: 'rgba(148, 163, 184, 0.25)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cropAvatarCol: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cropAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  cropAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#edf6f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  translationsText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#edf6f1',
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
    textTransform: 'uppercase',
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 6,
  },
  statusPillActive: {
    backgroundColor: '#e7faf1',
  },
  statusPillInactive: {
    backgroundColor: '#f1f5f9',
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  perennialPill: {
    backgroundColor: '#e8eeff',
  },
  seasonalPill: {
    backgroundColor: '#fff3df',
  },
  unitPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  unitPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    marginTop: 12,
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
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
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
  imagePickerCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
  },
  imageLoadingBox: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imageLoadingText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  imagePreviewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  imagePreview: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  imageActionBtns: {
    flex: 1,
    gap: 8,
  },
  imageActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  imageActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  imageUploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  imageUploadHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 10,
  },
  imageBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  uploadPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  uploadPickBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
});
