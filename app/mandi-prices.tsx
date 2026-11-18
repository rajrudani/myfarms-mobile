import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { dailyCropPricesApi } from '../src/api/dailyCropPrices';
import { DailyCropPrice } from '../src/types';
import { colors, radius, spacing } from '../src/theme/tokens';
import { storage, MandiUnit } from '../src/utils/storage';
import { ModalSheet } from '../src/components/ui';
import { useTranslation } from '../src/i18n/I18nContext';

interface UnitOptionItem {
  unit: MandiUnit;
  labelKey: string;
  subLabel: string;
}

const UNIT_ITEMS: UnitOptionItem[] = [
  { unit: 'kg', labelKey: 'KG', subLabel: 'per kg (1 kg)' },
  { unit: 'maund_20', labelKey: 'Maund (મણ - 20 kg)', subLabel: 'per 20 kg (20 kg)' },
  { unit: 'maund_40', labelKey: 'Maund (મણ - 40 kg)', subLabel: 'per 40 kg (40 kg)' },
  { unit: 'quintal', labelKey: 'Quintal (100 kg)', subLabel: 'per 100 kg (100 kg)' },
];

export default function MandiPricesScreen() {
  const { t, locale } = useTranslation();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [prices, setPrices] = useState<DailyCropPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);

  // Filters matching PWA
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedState, setSelectedState] = useState('Gujarat');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [priceUnit, setPriceUnit] = useState<MandiUnit>('kg');
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Modals
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [districtModalVisible, setDistrictModalVisible] = useState(false);

  // Search inside picker modals
  const [stateSearch, setStateSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');

  // Metadata
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load saved preferences on mount
  useEffect(() => {
    async function loadSavedPrefs() {
      try {
        const saved = await storage.getMandiPreferences();
        if (saved) {
          if (saved.state) setSelectedState(saved.state);
          if (saved.district) setSelectedDistrict(saved.district);
          if (saved.unit) setPriceUnit(saved.unit);
        }
      } catch (err) {
        console.warn('Failed to load mandi preferences:', err);
      } finally {
        setPrefsLoaded(true);
      }
    }
    loadSavedPrefs();
  }, []);

  // Persist preferences whenever state, district, or unit changes
  useEffect(() => {
    if (!prefsLoaded) return;
    storage.setMandiPreferences({
      state: selectedState,
      district: selectedDistrict,
      unit: priceUnit,
    }).catch((err) => console.warn('Failed to save mandi preferences:', err));
  }, [selectedState, selectedDistrict, priceUnit, prefsLoaded]);

  // Fetch metadata when selectedState changes
  const fetchMeta = useCallback(async (stateName?: string) => {
    try {
      const meta = await dailyCropPricesApi.getMeta(stateName === 'all' ? undefined : stateName);
      setStates(meta.states || []);
      setDistricts(meta.districts || []);
    } catch (err) {
      console.error('Failed to load mandi metadata:', err);
    }
  }, []);

  useEffect(() => {
    fetchMeta(selectedState);
  }, [selectedState, fetchMeta]);

  // Unit Config matching PWA exactly ($divisor, $unitLabel)
  const activeUnitConfig = useMemo(() => {
    switch (priceUnit) {
      case 'maund_20':
        return { divisor: 5, unitLabel: t('per 20 kg'), title: t('Maund (મણ - 20 kg)') };
      case 'maund_40':
        return { divisor: 2.5, unitLabel: t('per 40 kg'), title: t('Maund (મણ - 40 kg)') };
      case 'quintal':
        return { divisor: 1, unitLabel: t('per 100 kg'), title: t('Quintal (100 kg)') };
      case 'kg':
      default:
        return { divisor: 100, unitLabel: t('per kg'), title: t('KG') };
    }
  }, [priceUnit, t]);

  const formatPrice = (priceVal?: number | null) => {
    if (typeof priceVal !== 'number' || isNaN(priceVal)) return '-';
    const calc = priceVal / activeUnitConfig.divisor;
    return calc.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Fetch prices paginated
  const fetchPrices = useCallback(
    async (pageNum = 1, append = false) => {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const res = await dailyCropPricesApi.getPricesPaginated({
          state: selectedState === 'all' ? undefined : selectedState,
          district: selectedDistrict === 'all' ? undefined : selectedDistrict,
          search: debouncedSearch.trim() || undefined,
          page: pageNum,
          per_page: 20,
        });

        const newItems = res.data || [];
        if (append) {
          setPrices((prev) => [...prev, ...newItems]);
        } else {
          setPrices(newItems);
        }

        setPage(pageNum);
        const lastPage = res.meta?.last_page || 1;
        setHasMore(pageNum < lastPage && newItems.length > 0);
        if (res.meta?.total !== undefined) {
          setTotalCount(res.meta.total);
        }
      } catch (err) {
        console.error('Failed to load mandi prices:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [selectedState, selectedDistrict, debouncedSearch]
  );

  // Trigger re-fetch when filters change (after prefs loaded)
  useEffect(() => {
    if (prefsLoaded) {
      fetchPrices(1, false);
    }
  }, [fetchPrices, prefsLoaded]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPrices(1, false);
  };

  const onEndReached = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchPrices(page + 1, true);
    }
  };

  // Filter conditions matching PWA: state !== 'Gujarat' || district !== 'all' || search !== ''
  const isFiltered = selectedState !== 'Gujarat' || selectedDistrict !== 'all' || search.trim() !== '';

  const resetFilters = () => {
    setSelectedState('Gujarat');
    setSelectedDistrict('all');
    setSearch('');
  };

  // Filtered lists for modals
  const filteredStates = useMemo(() => {
    const list = ['all', ...states];
    if (!stateSearch.trim()) return list;
    const q = stateSearch.toLowerCase().trim();
    return list.filter((s) => (s === 'all' ? 'all states'.includes(q) : s.toLowerCase().includes(q)));
  }, [states, stateSearch]);

  const filteredDistricts = useMemo(() => {
    const list = ['all', ...districts];
    if (!districtSearch.trim()) return list;
    const q = districtSearch.toLowerCase().trim();
    return list.filter((d) => (d === 'all' ? 'all districts'.includes(q) : d.toLowerCase().includes(q)));
  }, [districts, districtSearch]);

  // Card renderer matching PWA .mandi-item
  const renderPriceItem = ({ item }: { item: DailyCropPrice }) => {
    let formattedArrivalDate = item.arrival_date;
    try {
      const d = new Date(item.arrival_date);
      const localeMap: Record<string, string> = { en: 'en-GB', gu: 'gu-IN', hi: 'hi-IN' };
      formattedArrivalDate = d.toLocaleDateString(localeMap[locale] || 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
      });
    } catch (_) {}

    return (
      <View style={styles.mandiItem}>
        {/* Item Header */}
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleWrap}>
            <Text style={styles.itemTitle}>
              {item.commodity}
              {item.variety ? ` (${item.variety})` : ''}
            </Text>
            <Text style={styles.itemSubtitle}>
              {t('Grade:')} {item.grade || 'FAQ'}
              {formattedArrivalDate ? ` • ${formattedArrivalDate}` : ''}
            </Text>
          </View>
          <View style={styles.mandiBadge}>
            <Text style={styles.mandiBadgePrice}>₹ {formatPrice(item.modal_price)}</Text>
            <Text style={styles.mandiBadgeUnit}>{activeUnitConfig.unitLabel}</Text>
          </View>
        </View>

        {/* Market Row */}
        <View style={styles.marketRow}>
          <Ionicons name="location-outline" size={14} color="#4a5c4a" style={styles.marketIcon} />
          <Text style={styles.marketText} numberOfLines={1}>
            {item.market}, {item.district}
          </Text>
        </View>

        {/* Price Block */}
        <View style={styles.priceBlock}>
          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>{t('MIN PRICE')}</Text>
            <Text style={styles.priceValue}>₹ {formatPrice(item.min_price)}</Text>
          </View>
          <View style={[styles.priceCol, { alignItems: 'flex-end' }]}>
            <Text style={styles.priceLabel}>{t('MAX PRICE')}</Text>
            <Text style={styles.priceValue}>₹ {formatPrice(item.max_price)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const containerMaxWidth = isTablet ? 900 : '100%';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* PWA-style Sticky Header */}
      <View style={styles.stickyHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
          activeOpacity={0.7}
          accessibilityLabel={t('Back')}
        >
          <Ionicons name="arrow-back" size={20} color="#166534" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('Daily Mandi Prices')}</Text>
        </View>

        <TouchableOpacity
          style={[styles.headerBtn, unitModalVisible && styles.headerBtnActive]}
          onPress={() => setUnitModalVisible(true)}
          activeOpacity={0.7}
          accessibilityLabel={t('Change Unit')}
        >
          <Ionicons name="scale-outline" size={20} color="#166534" />
        </TouchableOpacity>
      </View>

      <View style={[styles.contentWrapper, { maxWidth: containerMaxWidth, alignSelf: 'center', width: '100%' }]}>
        <FlatList
          data={prices}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPriceItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#166534']}
              tintColor="#166534"
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeaderContainer}>
              {/* PWA-style Filter Card (mandi-card) */}
              <View style={styles.mandiCard}>
                <View style={styles.filterGrid}>
                  {/* State Select Group */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('State')}</Text>
                    <TouchableOpacity
                      style={styles.selectInput}
                      onPress={() => setStateModalVisible(true)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.selectInputText} numberOfLines={1}>
                        {selectedState === 'all' ? t('All States') : selectedState}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color="#6b7280" />
                    </TouchableOpacity>
                  </View>

                  {/* District Select Group */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('District')}</Text>
                    <TouchableOpacity
                      style={[styles.selectInput, districts.length === 0 && styles.selectInputDisabled]}
                      onPress={() => setDistrictModalVisible(true)}
                      disabled={districts.length === 0}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.selectInputText} numberOfLines={1}>
                        {selectedDistrict === 'all' ? t('All Districts') : selectedDistrict}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Search Input with Icon */}
                <View style={styles.searchBox}>
                  <Ionicons name="search-outline" size={16} color="#6a7c6a" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder={t('Search by commodity, market, or variety...')}
                    placeholderTextColor="#94a3b8"
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {search.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearch('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Reset Filters Row */}
                {isFiltered && (
                  <View style={styles.resetRow}>
                    <TouchableOpacity style={styles.resetBtn} onPress={resetFilters} activeOpacity={0.7}>
                      <Ionicons name="close" size={15} color="#2b7a5a" />
                      <Text style={styles.resetBtnText}>{t('Reset Filters')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Status and Active Unit Bar */}
              <View style={styles.statusRow}>
                <Text style={styles.statusCount}>
                  {totalCount !== undefined
                    ? (totalCount === 1 ? t(':count quote', { count: totalCount }) : t(':count quotes', { count: totalCount }))
                    : (prices.length === 1 ? t(':count quote', { count: prices.length }) : t(':count quotes', { count: prices.length }))}
                </Text>

                <TouchableOpacity
                  style={styles.activeUnitPill}
                  onPress={() => setUnitModalVisible(true)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="scale-outline" size={13} color="#166534" />
                  <Text style={styles.activeUnitText}>{activeUnitConfig.title}</Text>
                  <Ionicons name="chevron-down" size={11} color="#166534" />
                </TouchableOpacity>
              </View>
            </View>
          }
          ListEmptyComponent={
            loading && !refreshing ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color="#166534" />
              </View>
            ) : (
              <View style={styles.mandiEmpty}>
                <Ionicons name="pricetags-outline" size={38} color="#94a3b8" style={{ marginBottom: 10 }} />
                <Text style={styles.mandiEmptyTitle}>{t('No prices found')}</Text>
                <Text style={styles.mandiEmptySub}>
                  {t("Try adjusting your filters to find what you're looking for.")}
                </Text>
                {isFiltered && (
                  <TouchableOpacity style={styles.emptyResetBtn} onPress={resetFilters} activeOpacity={0.75}>
                    <Text style={styles.emptyResetBtnText}>{t('Reset Filters')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="small" color="#166534" />
              </View>
            ) : null
          }
        />
      </View>

      {/* 1. Unit Selector ModalSheet */}
      <ModalSheet
        visible={unitModalVisible}
        onClose={() => setUnitModalVisible(false)}
        title={t('Change Unit')}
        maxHeight="55%"
      >
        <View style={styles.unitList}>
          {UNIT_ITEMS.map((item) => {
            const isSelected = priceUnit === item.unit;
            return (
              <TouchableOpacity
                key={item.unit}
                style={[styles.unitOption, isSelected && styles.unitOptionSelected]}
                onPress={() => {
                  setPriceUnit(item.unit);
                  setUnitModalVisible(false);
                }}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.unitOptionTitle, isSelected && styles.unitOptionTitleSelected]}>
                    {t(item.labelKey)}
                  </Text>
                  <Text style={styles.unitOptionSub}>{item.subLabel}</Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ModalSheet>

      {/* 2. State Selector ModalSheet */}
      <ModalSheet
        visible={stateModalVisible}
        onClose={() => {
          setStateModalVisible(false);
          setStateSearch('');
        }}
        title={t('Select State')}
        maxHeight="75%"
      >
        <View style={styles.modalBody}>
          <View style={styles.modalSearchBox}>
            <Ionicons name="search-outline" size={16} color="#94a3b8" />
            <TextInput
              style={styles.modalSearchInput}
              placeholder={t('Search state...')}
              placeholderTextColor="#94a3b8"
              value={stateSearch}
              onChangeText={setStateSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {stateSearch.length > 0 && (
              <TouchableOpacity onPress={() => setStateSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.modalItemsList}>
            {filteredStates.map((s) => {
              const isSelected = selectedState === s;
              const label = s === 'all' ? t('All States') : s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                  onPress={() => {
                    setSelectedState(s);
                    setSelectedDistrict('all');
                    setStateModalVisible(false);
                    setStateSearch('');
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                    {label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ModalSheet>

      {/* 3. District Selector ModalSheet */}
      <ModalSheet
        visible={districtModalVisible}
        onClose={() => {
          setDistrictModalVisible(false);
          setDistrictSearch('');
        }}
        title={t('Select Mandi District')}
        maxHeight="75%"
      >
        <View style={styles.modalBody}>
          <View style={styles.modalSearchBox}>
            <Ionicons name="search-outline" size={16} color="#94a3b8" />
            <TextInput
              style={styles.modalSearchInput}
              placeholder={t('Search district name...')}
              placeholderTextColor="#94a3b8"
              value={districtSearch}
              onChangeText={setDistrictSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {districtSearch.length > 0 && (
              <TouchableOpacity onPress={() => setDistrictSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.modalItemsList}>
            {filteredDistricts.map((d) => {
              const isSelected = selectedDistrict === d;
              const label = d === 'all' ? t('All Districts') : d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                  onPress={() => {
                    setSelectedDistrict(d);
                    setDistrictModalVisible(false);
                    setDistrictSearch('');
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                    {label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ModalSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentWrapper: {
    flex: 1,
  },

  // 1. PWA-style Sticky Header (.mandi-sticky-header)
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#f8fafc',
    gap: 10,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dcfce7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  headerBtnActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#166534',
    textAlign: 'center',
  },

  // 2. List Layout
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  listHeaderContainer: {
    marginBottom: 12,
  },

  // 3. PWA Filter Card (.mandi-card)
  mandiCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d2e0d2',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 12,
  },
  filterGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4a5c4a',
    marginBottom: 4,
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fafdfa',
    borderWidth: 1,
    borderColor: '#d2e0d2',
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 38,
  },
  selectInputDisabled: {
    opacity: 0.5,
  },
  selectInputText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a2e1a',
    flex: 1,
    marginRight: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafdfa',
    borderWidth: 1,
    borderColor: '#d2e0d2',
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 38,
    marginTop: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1a2e1a',
    paddingVertical: 0,
  },
  resetRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(43, 122, 90, 0.08)',
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2b7a5a',
  },

  // 4. Status & Unit bar
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  statusCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  activeUnitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeUnitText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },

  // 5. PWA Item Card (.mandi-item)
  mandiItem: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d2e0d2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  itemTitleWrap: {
    flex: 1,
    paddingRight: 10,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a2e1a',
    lineHeight: 20,
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#4a5c4a',
  },
  mandiBadge: {
    backgroundColor: '#d4eed8',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 88,
  },
  mandiBadgePrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e6b41',
    marginBottom: 1,
  },
  mandiBadgeUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1e6b41',
  },
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  marketIcon: {
    flexShrink: 0,
  },
  marketText: {
    fontSize: 12,
    color: '#2d3748',
    fontWeight: '500',
    flex: 1,
  },
  priceBlock: {
    backgroundColor: '#f3f6f3',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceCol: {
    gap: 2,
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#718096',
    letterSpacing: 0.5,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1a2e1a',
  },

  // 6. Empty State (.mandi-empty)
  mandiEmpty: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d2e0d2',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginTop: 10,
  },
  mandiEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a2e1a',
    marginBottom: 4,
  },
  mandiEmptySub: {
    fontSize: 13,
    color: '#718096',
    textAlign: 'center',
  },
  emptyResetBtn: {
    marginTop: 14,
    backgroundColor: '#166534',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  emptyResetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },

  // 7. Loader
  loaderWrap: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 8. Unit Modal
  unitList: {
    gap: 8,
    paddingBottom: 8,
  },
  unitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  unitOptionSelected: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  unitOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  unitOptionTitleSelected: {
    color: '#166534',
  },
  unitOptionSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },

  // 9. State/District Modal
  modalBody: {
    gap: 12,
    paddingBottom: 8,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 0,
  },
  modalItemsList: {
    gap: 6,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalItemSelected: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  modalItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  modalItemTextSelected: {
    fontWeight: '700',
    color: '#166534',
  },
});
