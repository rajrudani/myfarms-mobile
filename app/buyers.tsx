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
import { Buyer } from '../src/types';
import { extractErrorMessage } from '../src/api/client';

export default function BuyersScreen() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Form Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  const fetchBuyers = useCallback(async (showIndicator = true) => {
    if (showIndicator) setLoading(true);
    try {
      const data = await mastersApi.getBuyers();
      setBuyers(data);
    } catch (error) {
      console.error('Error fetching buyers:', error);
      Alert.alert('Error', 'Failed to load buyers list.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBuyers(true);
  }, [fetchBuyers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBuyers(false);
  };

  const handleToggleStatus = async (buyer: Buyer) => {
    try {
      await mastersApi.toggleBuyerStatus(buyer.id);
      fetchBuyers(false);
    } catch (error) {
      console.error('Error toggling status:', error);
      Alert.alert('Error', 'Failed to update status.');
    }
  };

  const openAddModal = () => {
    setEditingBuyer(null);
    setName('');
    setPhone('');
    setCompanyName('');
    setAddress('');
    setNotes('');
    setIsActive(true);
    setModalVisible(true);
  };

  const openEditModal = (buyer: Buyer) => {
    setEditingBuyer(buyer);
    setName(buyer.name);
    setPhone(buyer.phone || '');
    setCompanyName(buyer.company_name || '');
    setAddress(buyer.address || '');
    setNotes(buyer.notes || '');
    setIsActive(buyer.is_active);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Buyer name is required.');
      return;
    }

    const payload = {
      name,
      phone: phone || null,
      company_name: companyName || null,
      address: address || null,
      notes: notes || null,
      is_active: isActive,
    };

    try {
      if (editingBuyer) {
        await mastersApi.updateBuyer(editingBuyer.id, payload);
        Alert.alert('Success', 'Buyer updated successfully.');
      } else {
        await mastersApi.createBuyer(payload);
        Alert.alert('Success', 'Buyer added successfully.');
      }
      setModalVisible(false);
      fetchBuyers(false);
    } catch (error: any) {
      console.error('Error saving buyer:', error);
      const msg = extractErrorMessage(error, 'Failed to save buyer.');
      Alert.alert('Error', msg);
    }
  };

  // Filter buyers by search
  const filteredBuyers = buyers.filter(buyer => {
    const q = search.toLowerCase();
    return (
      buyer.name.toLowerCase().includes(q) ||
      (buyer.company_name && buyer.company_name.toLowerCase().includes(q)) ||
      (buyer.phone && buyer.phone.toLowerCase().includes(q))
    );
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buyers Master</Text>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search buyers..."
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
          data={filteredBuyers}
          keyExtractor={(item) => item.ulid}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#166534']} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No buyers found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.buyCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.buyNameText}>{item.name}</Text>
                  {item.company_name ? (
                    <Text style={styles.companyText}>Company: {item.company_name}</Text>
                  ) : null}
                </View>
                
                {item.phone ? (
                  <View style={styles.phoneBadge}>
                    <Ionicons name="call-outline" size={12} color="#1d4ed8" style={{ marginRight: 4 }} />
                    <Text style={styles.phoneBadgeText}>{item.phone}</Text>
                  </View>
                ) : null}
              </View>

              {(item.address || item.notes) ? (
                <View style={styles.cardBody}>
                  {item.address ? (
                    <Text style={styles.addressText}>📍 Address: {item.address}</Text>
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
              <Text style={styles.modalTitle}>{editingBuyer ? 'Edit Buyer' : 'Add Buyer'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.inputLabel}>Buyer Name*</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Reliance Retail"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.inputLabel}>Company Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Reliance Industries"
                value={companyName}
                onChangeText={setCompanyName}
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. +91 99887 76655"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Buyer address..."
                multiline
                numberOfLines={3}
                value={address}
                onChangeText={setAddress}
              />

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Specifications, payment terms, or notes..."
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
  buyCard: {
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
  buyNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  companyText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 4,
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
  },
  phoneBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
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
  addressText: {
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
