import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
  Modal,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { dailyCropPricesApi } from '../src/api/dailyCropPrices';
import { DailyCropPrice } from '../src/types';
import { colors, radius, spacing, shadows } from '../src/theme/tokens';
import {
  BentoCard,
  StatusBadge,
  SearchFilterBar,
  QuickChipGroup,
  ChipOption,
} from '../src/components/ui';

const PRICE_UNIT_OPTIONS: ChipOption<'quintal' | 'kg'>[] = [
  { label: '₹/Qtl', value: 'quintal' },
  { label: '₹/Kg', value: 'kg' },
];

export default function MandiPricesScreen() {
  const [prices, setPrices] = useState<DailyCropPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('Gujarat');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [priceUnit, setPriceUnit] = useState<'quintal' | 'kg'>('quintal');

  // Metadata
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [districtModalVisible, setDistrictModalVisible] = useState(false);

  const fetchMeta = async (stateName: string) => {
    try {
      const meta = await dailyCropPricesApi.getMeta(stateName);
      setStates(meta.states || []);
      setDistricts(meta.districts || []);
    } catch (err) {
      console.error('Failed to load mandi metadata:', err);
    }
  };

  const fetchPrices = useCallback(
    async (showIndicator = true) => {
      if (showIndicator) setLoading(true);
      try {
        const data = await dailyCropPricesApi.getPrices({
          state: selectedState,
          district: selectedDistrict === 'all' ? undefined : selectedDistrict,
          search: search.trim() || undefined,
          per_page: 50,
        });
        setPrices(data);
      } catch (err) {
        console.error('Failed to load mandi prices:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedState, selectedDistrict, search]
  );

  useEffect(() => {
    fetchMeta(selectedState);
  }, [selectedState]);

  useEffect(() => {
    fetchPrices(true);
  }, [fetchPrices]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPrices(false);
  };

  const formatPrice = (priceInQuintal: number) => {
    if (priceUnit === 'kg') {
      const perKg = (priceInQuintal / 100).toFixed(2);
      return `₹${perKg}/kg`;
    }
    return `₹${Math.round(priceInQuintal)}/qtl`;
  };

  const renderPriceItem = ({ item }: { item: DailyCropPrice }) => {
    let arrivalDate = item.arrival_date;
    try {
      const d = new Date(item.arrival_date);
      arrivalDate = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_) {}

    return (
      <BentoCard variant="elevated" style={styles.priceCard}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.commodityRow}>
              <View style={styles.commodityIconBadge}>
                <MaterialCommunityIcons name="sprout" size={16} color={colors.primary} />
              </View>
              <Text style={styles.commodityText}>{item.commodity}</Text>
            </View>
            <View style={styles.marketRow}>
              <Ionicons name="location-outline" size={13} color={colors.slate500} />
              <Text style={styles.marketText} numberOfLines={1}>
                {item.market} {item.district ? `(${item.district})` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.modalPriceContainer}>
            <Text style={styles.modalPriceLabel}>MODAL RATE</Text>
            <Text style={styles.modalPriceValue}>{formatPrice(item.modal_price)}</Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>MIN PRICE</Text>
            <Text style={styles.detailVal}>{formatPrice(item.min_price)}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>MAX PRICE</Text>
            <Text style={styles.detailVal}>{formatPrice(item.max_price)}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>ARRIVAL DATE</Text>
            <Text style={styles.detailVal}>{arrivalDate}</Text>
          </View>
        </View>

        {(item.variety || item.grade) && (
          <View style={styles.tagsRow}>
            {item.variety && (
              <StatusBadge
                label={`Variety: ${item.variety}`}
                variant="info"
                dot={false}
              />
            )}
            {item.grade && (
              <StatusBadge
                label={`Grade: ${item.grade}`}
                variant="warning"
                dot={false}
              />
            )}
          </View>
        )}
      </BentoCard>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Modern Futuristic Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={colors.slate800} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Daily Mandi Prices</Text>
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTagText}>APMC Live</Text>
          </View>
        </View>

        <View style={styles.unitToggleWrap}>
          <QuickChipGroup
            options={PRICE_UNIT_OPTIONS}
            selectedValue={priceUnit}
            onSelect={(val) => setPriceUnit(val)}
            size="sm"
          />
        </View>
      </View>

      {/* Filter Section */}
      <View style={styles.filterSection}>
        <SearchFilterBar
          query={search}
          onChangeQuery={setSearch}
          placeholder="Search crop or mandi..."
        />

        <View style={styles.filterBar}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedDistrict !== 'all' && styles.filterChipActive,
            ]}
            onPress={() => setDistrictModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="location-outline"
              size={14}
              color={selectedDistrict !== 'all' ? colors.primaryDark : colors.slate600}
            />
            <Text
              style={[
                styles.filterChipText,
                selectedDistrict !== 'all' && styles.filterChipTextActive,
              ]}
            >
              {selectedDistrict === 'all' ? 'All Districts' : selectedDistrict}
            </Text>
            <Ionicons
              name="chevron-down"
              size={13}
              color={selectedDistrict !== 'all' ? colors.primaryDark : colors.slate500}
            />
          </TouchableOpacity>

          {selectedDistrict !== 'all' && (
            <TouchableOpacity
              style={styles.clearChip}
              onPress={() => setSelectedDistrict('all')}
              activeOpacity={0.7}
            >
              <Text style={styles.clearChipText}>Reset Filter</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.resultsCount}>
            {prices.length} {prices.length === 1 ? 'quote' : 'quotes'}
          </Text>
        </View>
      </View>

      {/* Mandi Prices List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching government mandi prices...</Text>
        </View>
      ) : (
        <FlatList
          data={prices}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPriceItem}
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
              <View style={styles.emptyIconCircle}>
                <Ionicons name="pricetags-outline" size={32} color={colors.slate400} />
              </View>
              <Text style={styles.emptyTitle}>No Mandi Prices Found</Text>
              <Text style={styles.emptySub}>
                Try searching for another commodity or clearing district filters.
              </Text>
            </View>
          }
        />
      )}

      {/* District Picker Modal */}
      <Modal visible={districtModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Mandi District</Text>
              <TouchableOpacity
                onPress={() => setDistrictModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color={colors.slate600} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={['all', ...districts]}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedDistrict === item && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedDistrict(item);
                    setDistrictModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedDistrict === item && styles.modalItemTextSelected,
                    ]}
                  >
                    {item === 'all' ? 'All Districts' : item}
                  </Text>
                  {selectedDistrict === item && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.slate900,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  liveTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  unitToggleWrap: {
    alignItems: 'flex-end',
  },
  filterSection: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    gap: spacing.sm,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.pill,
  },
  filterChipActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryBorder,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.slate700,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  clearChip: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  clearChipText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },
  resultsCount: {
    marginLeft: 'auto',
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate400,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  priceCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
  },
  commodityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commodityIconBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.xs,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commodityText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate900,
  },
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  marketText: {
    fontSize: 12,
    color: colors.slate500,
    flexShrink: 1,
  },
  modalPriceContainer: {
    alignItems: 'flex-end',
    backgroundColor: colors.primarySurface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  modalPriceLabel: {
    fontSize: 9,
    color: colors.primaryDark,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalPriceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate50,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.slate100,
  },
  detailCol: {
    flex: 1,
    alignItems: 'center',
  },
  detailDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.slate200,
  },
  detailLabel: {
    fontSize: 9,
    color: colors.slate400,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate800,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    color: colors.slate500,
    marginTop: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.slate800,
    marginTop: 14,
  },
  emptySub: {
    fontSize: 13,
    color: colors.slate500,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '65%',
    padding: spacing.lg,
    ...shadows.medium,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.slate300,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.slate900,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  modalItemSelected: {
    backgroundColor: colors.primarySurface,
    borderRadius: radius.sm,
  },
  modalItemText: {
    fontSize: 14,
    color: colors.slate700,
    fontWeight: '500',
  },
  modalItemTextSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
});
