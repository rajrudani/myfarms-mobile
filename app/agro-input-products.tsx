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
import { AgroInputProduct } from '../src/types';
import { extractErrorMessage } from '../src/api/client';

export default function AgroInputProductsScreen() {
  const [products, setProducts] = useState<AgroInputProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Form Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AgroInputProduct | null>(null);

  // Form Fields
  const [type, setType] = useState('FERTILIZER');
  const [name, setName] = useState('');
  const [nameGu, setNameGu] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [formulation, setFormulation] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  const fetchProducts = useCallback(async (showIndicator = true) => {
    if (showIndicator) setLoading(true);
    try {
      const data = await mastersApi.getInputProducts();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert('Error', 'Failed to load input products.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(true);
  }, [fetchProducts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts(false);
  };

  const handleToggleStatus = async (product: AgroInputProduct) => {
    try {
      await mastersApi.toggleInputProductStatus(product.id);
      fetchProducts(false);
    } catch (error) {
      console.error('Error toggling status:', error);
      Alert.alert('Error', 'Failed to update status.');
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setType('FERTILIZER');
    setName('');
    setNameGu('');
    setNameHi('');
    setBrand('');
    setCategory('');
    setFormulation('');
    setNotes('');
    setIsActive(true);
    setModalVisible(true);
  };

  const openEditModal = (product: AgroInputProduct) => {
    setEditingProduct(product);
    setType(product.type);
    setName(product.name);
    setNameGu(product.name_gu || '');
    setNameHi(product.name_hi || '');
    setBrand(product.brand || '');
    setCategory(product.category || '');
    setFormulation(product.formulation || '');
    setNotes(product.notes || '');
    setIsActive(product.is_active);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !type) {
      Alert.alert('Validation Error', 'Product name and type are required.');
      return;
    }

    const payload = {
      type,
      name,
      name_gu: nameGu || null,
      name_hi: nameHi || null,
      brand: brand || null,
      category: category || null,
      formulation: formulation || null,
      is_active: isActive,
      notes: notes || null,
    };

    try {
      if (editingProduct) {
        await mastersApi.updateInputProduct(editingProduct.id, payload);
        Alert.alert('Success', 'Product updated successfully.');
      } else {
        await mastersApi.createInputProduct(payload);
        Alert.alert('Success', 'Product added successfully.');
      }
      setModalVisible(false);
      fetchProducts(false);
    } catch (error: any) {
      console.error('Error saving product:', error);
      const msg = extractErrorMessage(error, 'Failed to save product.');
      Alert.alert('Error', msg);
    }
  };

  // Filter products by search
  const filteredProducts = products.filter(product => {
    const q = search.toLowerCase();
    return (
      product.name.toLowerCase().includes(q) ||
      (product.brand && product.brand.toLowerCase().includes(q)) ||
      (product.category && product.category.toLowerCase().includes(q)) ||
      product.type.toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agro Input Products</Text>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
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
          data={filteredProducts}
          keyExtractor={(item) => item.ulid}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#166534']} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No input products found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.prodCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prodNameText}>{item.name}</Text>
                  {item.brand ? (
                    <Text style={styles.brandText}>Brand: {item.brand}</Text>
                  ) : null}
                </View>
                
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.type}</Text>
                  </View>
                  {item.category ? (
                    <View style={[styles.badge, styles.catBadge]}>
                      <Text style={[styles.badgeText, styles.catBadgeText]}>{item.category}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {(item.formulation || item.notes) ? (
                <View style={styles.cardBody}>
                  {item.formulation ? (
                    <Text style={styles.formulationText}>Formulation: {item.formulation}</Text>
                  ) : null}
                  {item.notes ? (
                    <Text style={styles.notesText}>💡 Notes: {item.notes}</Text>
                  ) : null}
                </View>
              ) : null}

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
              <Text style={styles.modalTitle}>{editingProduct ? 'Edit Product' : 'Add Product'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.inputLabel}>Product Type*</Text>
              <View style={styles.pickerContainer}>
                {['FERTILIZER', 'PESTICIDE', 'SEED', 'EQUIPMENT', 'OTHER'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pickerItem, type === t && styles.pickerItemActive]}
                    onPress={() => setType(t)}
                  >
                    <Text style={[styles.pickerItemText, type === t && styles.pickerItemTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Product Name*</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Urea"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.inputLabel}>Brand / Manufacturer</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. IFFCO"
                value={brand}
                onChangeText={setBrand}
              />

              <Text style={styles.inputLabel}>Category</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Nitrogenous"
                value={category}
                onChangeText={setCategory}
              />

              <Text style={styles.inputLabel}>Formulation / Form</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Granular, Liquid"
                value={formulation}
                onChangeText={setFormulation}
              />

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Specifications, instructions, or notes..."
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />

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
  prodCard: {
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
  prodNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  brandText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
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
  catBadge: {
    backgroundColor: '#f0fdf4',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1e40af',
  },
  catBadgeText: {
    color: '#166534',
  },
  cardBody: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  formulationText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  notesText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
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
  textArea: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: 'top',
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
