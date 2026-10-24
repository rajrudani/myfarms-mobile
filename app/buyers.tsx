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
  Linking,
  Platform,
  StatusBar,
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
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#334155" />
          </TouchableOpacity>
          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>Buyers</Text>
            <Text style={styles.headerSubtitle}>Manage buyers for your farm group.</Text>
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for buyers..."
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
          renderItem={({ item }) => {
            const initials = item.name
              ? item.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()
              : 'B';
            const salesCount = (item as any).sales_count ?? 0;

            return (
              <View style={styles.buyCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.buyerAvatar}>
                    <Text style={styles.buyerAvatarText}>{initials}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.buyNameText}>{item.name}</Text>
                    {item.company_name ? (
                      <Text style={styles.companyText}>{item.company_name}</Text>
                    ) : null}
                  </View>
                  
                  <View style={[styles.statusPill, item.is_active ? styles.statusPillActive : styles.statusPillInactive]}>
                    <View style={[styles.pillDot, { backgroundColor: item.is_active ? '#14815f' : '#64748b' }]} />
                    <Text style={[styles.statusPillText, { color: item.is_active ? '#14815f' : '#64748b' }]}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                {/* Pill row */}
                {(salesCount > 0 || item.phone || item.address) ? (
                  <View style={styles.pillsRow}>
                    {salesCount > 0 ? (
                      <View style={[styles.infoPill, styles.salesPill]}>
                        <Ionicons name="bag-handle-outline" size={12} color="#4338ca" />
                        <Text style={[styles.infoPillText, { color: '#4338ca' }]}>
                          {salesCount} {salesCount === 1 ? 'Sale' : 'Sales'}
                        </Text>
                      </View>
                    ) : null}

                    {item.phone ? (
                      <TouchableOpacity
                        style={[styles.infoPill, styles.phonePill]}
                        onPress={() => Linking.openURL(`tel:${item.phone}`)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="call-outline" size={12} color="#1d4ed8" />
                        <Text style={[styles.infoPillText, { color: '#1d4ed8' }]}>{item.phone}</Text>
                      </TouchableOpacity>
                    ) : null}

                    {item.address ? (
                      <View style={[styles.infoPill, styles.addressPill]}>
                        <Ionicons name="location-outline" size={12} color="#475569" />
                        <Text style={styles.infoPillText} numberOfLines={1}>{item.address}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {item.notes ? (
                  <Text style={styles.notesText}>{item.notes}</Text>
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
  buyCard: {
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
  buyerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  buyerAvatarText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2563eb',
  },
  buyNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  companyText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
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
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
    maxWidth: '100%',
  },
  infoPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  salesPill: {
    backgroundColor: '#e0e7ff',
  },
  phonePill: {
    backgroundColor: '#eff6ff',
  },
  addressPill: {
    backgroundColor: '#f1f5f9',
  },
  notesText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    lineHeight: 18,
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
