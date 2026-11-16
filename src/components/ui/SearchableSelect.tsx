import React, { useState, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../theme/tokens';

export interface SearchableSelectItem<T = string | number> {
  value: T;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}

export interface SearchableSelectProps<T = string | number> {
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  items: SearchableSelectItem<T>[];
  // Single-select mode
  value?: T | null;
  onSelect?: (value: T) => void;
  // Multi-select mode
  multiple?: boolean;
  selectedValues?: T[];
  onMultiSelect?: (values: T[]) => void;
  // Configuration
  required?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  maxListHeight?: number;
  error?: string;
  helperText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  emptyMessage?: string;
  headerRight?: React.ReactNode;
}

export function SearchableSelect<T = string | number>({
  label,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search records...',
  items,
  value,
  onSelect,
  multiple = false,
  selectedValues = [],
  onMultiSelect,
  required = false,
  disabled = false,
  allowClear = false,
  clearLabel = 'None / Clear Selection',
  maxListHeight = 220,
  error,
  helperText,
  containerStyle,
  emptyMessage = 'No matching records found',
  headerRight,
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        (item.sublabel && item.sublabel.toLowerCase().includes(query)) ||
        (item.badge && item.badge.toLowerCase().includes(query))
    );
  }, [items, searchQuery]);

  // Selected item map for fast lookup
  const selectedSet = useMemo(() => {
    if (multiple) {
      return new Set(selectedValues.map((v) => String(v)));
    }
    return new Set(value !== undefined && value !== null ? [String(value)] : []);
  }, [multiple, selectedValues, value]);

  // Display label for single-select mode
  const currentSingleItem = useMemo(() => {
    if (value === undefined || value === null) return null;
    return items.find((i) => String(i.value) === String(value)) || null;
  }, [items, value]);

  const handleToggleOpen = () => {
    if (disabled) return;
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (!nextState) {
      setSearchQuery('');
    }
  };

  const handleSelect = (itemValue: T) => {
    if (multiple) {
      const isAlreadySelected = selectedSet.has(String(itemValue));
      let updated: T[];
      if (isAlreadySelected) {
        updated = selectedValues.filter((v) => String(v) !== String(itemValue));
      } else {
        updated = [...selectedValues, itemValue];
      }
      onMultiSelect?.(updated);
    } else {
      onSelect?.(itemValue);
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  const handleClearSingle = (e?: any) => {
    e?.stopPropagation?.();
    if (onSelect) {
      // Pass null or empty value
      onSelect(null as unknown as T);
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectAll = () => {
    if (!multiple || !onMultiSelect) return;
    const allAvailable = items.filter((i) => !i.disabled).map((i) => i.value);
    onMultiSelect(allAvailable);
  };

  const handleClearAll = () => {
    if (!multiple || !onMultiSelect) return;
    onMultiSelect([]);
  };

  const handleRemoveTag = (itemValue: T) => {
    if (!multiple || !onMultiSelect) return;
    const updated = selectedValues.filter((v) => String(v) !== String(itemValue));
    onMultiSelect(updated);
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {/* Label and Header Right */}
      {(label || headerRight) && (
        <View style={styles.labelRow}>
          {label ? (
            <Text style={styles.label}>
              {label}
              {required ? <Text style={styles.requiredAsterisk}> *</Text> : null}
            </Text>
          ) : <View />}
          {headerRight}
        </View>
      )}

      {/* Trigger Box */}
      <TouchableOpacity
        style={[
          styles.triggerBox,
          isOpen && styles.triggerBoxOpen,
          disabled && styles.triggerBoxDisabled,
          error ? styles.triggerBoxError : null,
        ]}
        onPress={handleToggleOpen}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <View style={styles.triggerContent}>
          {multiple ? (
            <Text
              style={[
                styles.triggerText,
                selectedValues.length === 0 && styles.placeholderText,
              ]}
              numberOfLines={1}
            >
              {selectedValues.length === 0
                ? placeholder
                : `${selectedValues.length} selected`}
            </Text>
          ) : currentSingleItem ? (
            <View style={styles.singleItemDisplay}>
              {currentSingleItem.icon && (
                <Ionicons
                  name={currentSingleItem.icon}
                  size={16}
                  color={colors.primary}
                  style={{ marginRight: 6 }}
                />
              )}
              <Text style={styles.triggerText} numberOfLines={1}>
                {currentSingleItem.label}
              </Text>
              {currentSingleItem.sublabel ? (
                <Text style={styles.triggerSublabel} numberOfLines={1}>
                  ({currentSingleItem.sublabel})
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.triggerText, styles.placeholderText]} numberOfLines={1}>
              {placeholder}
            </Text>
          )}
        </View>

        <View style={styles.triggerActions}>
          {!multiple && allowClear && currentSingleItem && (
            <TouchableOpacity
              onPress={handleClearSingle}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={16} color={colors.slate400} />
            </TouchableOpacity>
          )}
          <Ionicons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.slate500}
          />
        </View>
      </TouchableOpacity>

      {/* Multi-select Selected Chips Preview */}
      {multiple && selectedValues.length > 0 && (
        <View style={styles.tagsContainer}>
          {selectedValues.map((val) => {
            const item = items.find((i) => String(i.value) === String(val));
            if (!item) return null;
            return (
              <View key={String(val)} style={styles.tagChip}>
                <Text style={styles.tagText} numberOfLines={1}>
                  {item.label}
                </Text>
                {!disabled && (
                  <TouchableOpacity
                    onPress={() => handleRemoveTag(val)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={styles.tagRemoveBtn}
                  >
                    <Ionicons name="close" size={12} color={colors.slate600} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Dropdown Menu Box */}
      {isOpen && (
        <View style={styles.dropdownContainer}>
          {/* Search Input Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={colors.slate400} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.slate400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.searchClearBtn}
              >
                <Ionicons name="close-circle" size={16} color={colors.slate400} />
              </TouchableOpacity>
            )}
          </View>

          {/* Multi-Select Quick Action Toolbar */}
          {multiple && (
            <View style={styles.toolbarRow}>
              <Text style={styles.counterText}>
                {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
              </Text>
              <View style={styles.toolbarActions}>
                <TouchableOpacity onPress={handleSelectAll} activeOpacity={0.7} style={styles.toolbarBtn}>
                  <Text style={styles.toolbarBtnText}>Select All</Text>
                </TouchableOpacity>
                <Text style={styles.toolbarDivider}>|</Text>
                <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7} style={styles.toolbarBtn}>
                  <Text style={styles.toolbarBtnText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Scrollable Item List */}
          <ScrollView
            style={[styles.listScroll, { maxHeight: maxListHeight }]}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            {/* Single Select Optional Clear Option */}
            {!multiple && allowClear && (
              <TouchableOpacity
                style={[styles.itemRow, !value ? styles.itemRowSelected : null]}
                onPress={() => handleClearSingle()}
                activeOpacity={0.7}
              >
                <View style={styles.itemContent}>
                  <Text style={[styles.itemLabel, styles.clearItemLabel]}>{clearLabel}</Text>
                </View>
                {!value && (
                  <Ionicons name="checkmark-sharp" size={16} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}

            {/* Filtered Items */}
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const isSelected = selectedSet.has(String(item.value));
                return (
                  <TouchableOpacity
                    key={String(item.value)}
                    style={[
                      styles.itemRow,
                      isSelected && styles.itemRowSelected,
                      item.disabled && styles.itemRowDisabled,
                    ]}
                    onPress={() => !item.disabled && handleSelect(item.value)}
                    activeOpacity={item.disabled ? 1 : 0.7}
                    disabled={item.disabled}
                  >
                    {/* Multi-select Checkbox */}
                    {multiple && (
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={isSelected ? colors.primary : colors.slate400}
                        style={styles.checkboxIcon}
                      />
                    )}

                    {/* Item Custom Icon */}
                    {item.icon && !multiple && (
                      <Ionicons
                        name={item.icon}
                        size={16}
                        color={isSelected ? colors.primary : colors.slate500}
                        style={styles.itemIcon}
                      />
                    )}

                    <View style={styles.itemContent}>
                      <View style={styles.itemTitleRow}>
                        <Text
                          style={[
                            styles.itemLabel,
                            isSelected && styles.itemLabelSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                        {item.badge ? (
                          <View
                            style={[
                              styles.badge,
                              item.badgeColor ? { backgroundColor: item.badgeColor } : null,
                            ]}
                          >
                            <Text style={styles.badgeText}>{item.badge}</Text>
                          </View>
                        ) : null}
                      </View>

                      {item.sublabel ? (
                        <Text style={styles.itemSublabel} numberOfLines={1}>
                          {item.sublabel}
                        </Text>
                      ) : null}
                    </View>

                    {/* Single-select Checkmark */}
                    {!multiple && isSelected && (
                      <Ionicons name="checkmark-sharp" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={24} color={colors.slate300} style={{ marginBottom: 6 }} />
                <Text style={styles.emptyText}>{emptyMessage}</Text>
              </View>
            )}
          </ScrollView>

          {/* Close Dropdown Footer Button for Multi-select */}
          {multiple && (
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                setIsOpen(false);
                setSearchQuery('');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Helper and Error Messages */}
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate700,
  },
  requiredAsterisk: {
    color: colors.danger,
    fontWeight: '700',
  },
  triggerBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.slate200,
  },
  triggerBoxOpen: {
    borderColor: colors.primary,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  triggerBoxDisabled: {
    backgroundColor: colors.slate100,
    borderColor: colors.slate200,
    opacity: 0.7,
  },
  triggerBoxError: {
    borderColor: colors.danger,
  },
  triggerContent: {
    flex: 1,
    marginRight: 8,
  },
  singleItemDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.slate800,
  },
  triggerSublabel: {
    fontSize: 13,
    color: colors.slate500,
    marginLeft: 6,
  },
  placeholderText: {
    color: colors.slate400,
    fontWeight: '400',
  },
  triggerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearBtn: {
    padding: 2,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    gap: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
    maxWidth: 160,
  },
  tagRemoveBtn: {
    marginLeft: 2,
    padding: 2,
  },
  dropdownContainer: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    paddingTop: 4,
    paddingBottom: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    marginHorizontal: 10,
    marginVertical: 6,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.slate800,
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 2,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  counterText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate500,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolbarBtn: {
    paddingVertical: 2,
  },
  toolbarBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  toolbarDivider: {
    fontSize: 11,
    color: colors.slate300,
  },
  listScroll: {
    paddingHorizontal: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    marginVertical: 1,
  },
  itemRowSelected: {
    backgroundColor: '#f0fdf4',
  },
  itemRowDisabled: {
    opacity: 0.4,
  },
  checkboxIcon: {
    marginRight: 8,
  },
  itemIcon: {
    marginRight: 8,
  },
  itemContent: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemLabel: {
    fontSize: 13,
    color: colors.slate800,
    fontWeight: '500',
  },
  itemLabelSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  clearItemLabel: {
    color: colors.slate500,
    fontStyle: 'italic',
  },
  itemSublabel: {
    fontSize: 11,
    color: colors.slate500,
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.slate100,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.slate600,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 12,
    color: colors.slate400,
  },
  doneBtn: {
    backgroundColor: colors.primary,
    marginHorizontal: 10,
    marginTop: 6,
    paddingVertical: 8,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  doneBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
    marginLeft: 2,
  },
  helperText: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 4,
    marginLeft: 2,
  },
});
