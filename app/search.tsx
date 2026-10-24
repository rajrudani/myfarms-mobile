import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { dashboardApi } from '../src/api/dashboard';
import { DashboardSearchCategory, DashboardSearchResultItem } from '../src/types';
import { colors, radius, spacing, typography } from '../src/theme/tokens';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<DashboardSearchCategory[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setCategories([]);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await dashboardApi.search(trimmed);
        setCategories(response.results || []);
        setHasSearched(true);
      } catch (error) {
        console.error('Search error:', error);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const handleSelectItem = (item: DashboardSearchResultItem) => {
    switch (item.type) {
      case 'farm':
        router.push({
          pathname: '/farm-view',
          params: { farm_id: String(item.id), farm_ulid: item.ulid },
        });
        break;
      case 'sale':
        router.push({
          pathname: '/sale-view',
          params: { sale_id: String(item.id), sale_ulid: item.ulid },
        });
        break;
      case 'purchase':
      case 'payment':
        router.push({
          pathname: '/agro-shop',
          params: { shop_ulid: item.shop_ulid || item.ulid },
        });
        break;
      case 'staff':
        router.push({
          pathname: '/staff-view',
          params: { staff_id: String(item.id), staff_ulid: item.ulid },
        });
        break;
      case 'note':
        router.push({
          pathname: '/note-view',
          params: { id: item.ulid || String(item.id) },
        });
        break;
      case 'visit':
        router.push('/consultant-visits');
        break;
      case 'shop':
        router.push({
          pathname: '/agro-shop',
          params: { shop_ulid: item.ulid },
        });
        break;
      default:
        break;
    }
  };

  const getCategoryIcon = (iconName: string): any => {
    switch (iconName) {
      case 'map':
        return 'map-outline';
      case 'cash':
        return 'cash-outline';
      case 'cart':
        return 'cart-outline';
      case 'card':
        return 'card-outline';
      case 'people':
        return 'people-outline';
      case 'notifications':
        return 'notifications-outline';
      case 'clipboard':
        return 'clipboard-outline';
      case 'business':
        return 'business-outline';
      default:
        return 'search-outline';
    }
  };

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

        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={18} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search farms, sales, purchases, staff..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && Platform.OS !== 'ios' && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        ) : query.trim().length < 2 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="search" size={28} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>Global Search</Text>
            <Text style={styles.emptySubtitle}>
              Type at least 2 characters to search across farms, sales, purchases, staff, notes & visits.
            </Text>
          </View>
        ) : categories.length === 0 && hasSearched ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="alert-circle-outline" size={28} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySubtitle}>
              No matching records found for "{query}". Try a different keyword or check spelling.
            </Text>
          </View>
        ) : (
          <View style={styles.resultsContainer}>
            {categories.map((category) => (
              <View key={category.label} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryIconWrap}>
                    <Ionicons name={getCategoryIcon(category.icon)} size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.categoryTitle}>{category.label}</Text>
                  <View style={styles.categoryCountBadge}>
                    <Text style={styles.categoryCountText}>{category.items.length}</Text>
                  </View>
                </View>

                <View style={styles.categoryCardList}>
                  {category.items.map((item) => (
                    <TouchableOpacity
                      key={`${item.type}-${item.id}`}
                      style={styles.resultItem}
                      onPress={() => handleSelectItem(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.resultItemBody}>
                        <Text style={styles.resultItemTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.resultItemMeta} numberOfLines={1}>
                          {item.meta}
                        </Text>
                      </View>

                      {item.status_label && (
                        <View
                          style={[
                            styles.statusBadge,
                            item.status_color === 'success' && styles.statusSuccess,
                            item.status_color === 'danger' && styles.statusDanger,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              item.status_color === 'success' && styles.statusSuccessText,
                              item.status_color === 'danger' && styles.statusDangerText,
                            ]}
                          >
                            {item.status_label}
                          </Text>
                        </View>
                      )}

                      <Ionicons name="chevron-forward" size={16} color="#94a3b8" style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
    gap: 10,
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
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  loadingText: {
    ...typography.bodySmall,
    color: '#64748b',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: spacing.xl,
    gap: 8,
  },
  emptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  resultsContainer: {
    gap: 20,
  },
  categorySection: {
    gap: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  categoryIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.04,
  },
  categoryCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  categoryCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  categoryCardList: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  resultItemBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  resultItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  resultItemMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  statusSuccess: {
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
  },
  statusDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  statusSuccessText: {
    color: '#166534',
  },
  statusDangerText: {
    color: '#991b1b',
  },
});
