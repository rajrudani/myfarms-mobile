import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleProp,
  ViewStyle,
  Modal,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography, shadows } from '../../theme/tokens';
import { touchTargetHitSlop } from '../../utils/responsive';

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
  renderMode?: 'modal' | 'inline'; // Defaults to 'modal' for mobile ergonomics
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
  renderMode = 'modal',
  required = false,
  disabled = false,
  allowClear = false,
  clearLabel = 'None / Clear Selection',
  maxListHeight = 240,
  error,
  helperText,
  containerStyle,
  emptyMessage = 'No matching records found',
  headerRight,
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  // Focus search input when opened in modal mode
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
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

  const bottomPadding = Math.max(insets.bottom, 16);
  const modalListMaxHeight = Math.min(windowHeight * 0.55, 420);

  // Render Item Helper
  const renderItemRow = (item: SearchableSelectItem<T>) => {
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
            size={20}
            color={isSelected ? colors.primary : colors.slate400}
            style={styles.checkboxIcon}
          />
        )}

        {/* Item Custom Icon */}
        {item.icon && !multiple && (
          <Ionicons
            name={item.icon}
            size={18}
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
          <Ionicons name="checkmark-sharp" size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
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
          isOpen && renderMode === 'inline' && styles.triggerBoxOpen,
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
              hitSlop={touchTargetHitSlop}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={17} color={colors.slate400} />
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

      {/* Inline Render Mode (Legacy compatibility) */}
      {renderMode === 'inline' && isOpen && (
        <View style={styles.dropdownContainer}>
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
                hitSlop={touchTargetHitSlop}
                style={styles.searchClearBtn}
              >
                <Ionicons name="close-circle" size={16} color={colors.slate400} />
              </TouchableOpacity>
            )}
          </View>

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

          <ScrollView
            style={[styles.listScroll, { maxHeight: maxListHeight }]}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
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

            {filteredItems.length > 0 ? (
              filteredItems.map(renderItemRow)
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={24} color={colors.slate300} style={{ marginBottom: 6 }} />
                <Text style={styles.emptyText}>{emptyMessage}</Text>
              </View>
            )}
          </ScrollView>

          {multiple && (
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Modal Bottom Sheet Render Mode (Default & Preferred for Mobile) */}
      {renderMode === 'modal' && (
        <Modal
          visible={isOpen}
          transparent
          animationType="slide"
          onRequestClose={handleClose}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalBackdrop}
          >
            <TouchableOpacity
              style={styles.modalBackdropDismiss}
              activeOpacity={1}
              onPress={handleClose}
            />

            <View style={[styles.modalSheet, { paddingBottom: bottomPadding }]}>
              {/* Handle Bar */}
              <View style={styles.sheetHandle} />

              {/* Sheet Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleGroup}>
                  <Text style={styles.modalTitle}>{label || placeholder}</Text>
                  <Text style={styles.modalSubtitle}>
                    {multiple
                      ? `${selectedValues.length} selected of ${items.length}`
                      : `${items.length} options available`}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={touchTargetHitSlop}
                  style={styles.modalCloseBtn}
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={22} color={colors.slate600} />
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={styles.modalSearchBar}>
                <Ionicons name="search-outline" size={18} color={colors.slate400} style={{ marginRight: 8 }} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.modalSearchInput}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={colors.slate400}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && Platform.OS !== 'ios' && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    hitSlop={touchTargetHitSlop}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.slate400} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Multi-Select Toolbar */}
              {multiple && (
                <View style={styles.modalToolbarRow}>
                  <Text style={styles.counterText}>
                    {filteredItems.length} matching
                  </Text>
                  <View style={styles.toolbarActions}>
                    <TouchableOpacity onPress={handleSelectAll} activeOpacity={0.7} style={styles.toolbarBtn}>
                      <Text style={styles.toolbarBtnText}>Select All</Text>
                    </TouchableOpacity>
                    <Text style={styles.toolbarDivider}>|</Text>
                    <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7} style={styles.toolbarBtn}>
                      <Text style={styles.toolbarBtnText}>Clear All</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Items List */}
              <ScrollView
                style={[styles.modalListScroll, { maxHeight: modalListMaxHeight }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
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
                      <Ionicons name="checkmark-sharp" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                )}

                {filteredItems.length > 0 ? (
                  filteredItems.map(renderItemRow)
                ) : (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="search" size={32} color={colors.slate300} style={{ marginBottom: 8 }} />
                    <Text style={styles.emptyText}>{emptyMessage}</Text>
                  </View>
                )}
              </ScrollView>

              {/* Confirm / Done Button */}
              {multiple ? (
                <TouchableOpacity
                  style={styles.modalDoneBtn}
                  onPress={handleClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalDoneBtnText}>
                    Done ({selectedValues.length} selected)
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
    fontWeight: '700',
    color: colors.slate800,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  requiredAsterisk: {
    color: colors.danger,
    fontWeight: '800',
  },
  triggerBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    ...shadows.subtle,
  },
  triggerBoxOpen: {
    borderColor: colors.primary,
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
    ...typography.body,
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
    gap: 8,
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
    paddingVertical: 5,
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

  // Inline Dropdown Styles
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
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate500,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolbarBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  toolbarBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  toolbarDivider: {
    fontSize: 12,
    color: colors.slate300,
  },
  listScroll: {
    paddingHorizontal: 6,
  },

  // Modal Bottom Sheet Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalBackdropDismiss: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    ...shadows.medium,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.slate300,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  modalHeaderTitleGroup: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  modalTitle: {
    ...typography.title3,
    fontWeight: '800',
    color: colors.slate900,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.slate500,
    marginTop: 2,
    fontWeight: '500',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    paddingHorizontal: spacing.md,
    height: 44,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.slate800,
    paddingVertical: 0,
  },
  modalToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  modalListScroll: {
    marginVertical: 4,
  },
  modalDoneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    ...shadows.subtle,
  },
  modalDoneBtnText: {
    ...typography.body,
    fontWeight: '800',
    color: colors.white,
  },

  // Item Row
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    marginVertical: 2,
  },
  itemRowSelected: {
    backgroundColor: '#f0fdf4',
  },
  itemRowDisabled: {
    opacity: 0.4,
  },
  checkboxIcon: {
    marginRight: 10,
  },
  itemIcon: {
    marginRight: 10,
  },
  itemContent: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemLabel: {
    fontSize: 14,
    color: colors.slate800,
    fontWeight: '600',
  },
  itemLabelSelected: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  clearItemLabel: {
    color: colors.slate500,
    fontStyle: 'italic',
  },
  itemSublabel: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.slate100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate600,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 13,
    color: colors.slate400,
    fontWeight: '500',
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
    ...typography.caption,
    color: colors.danger,
    marginTop: 4,
    fontWeight: '600',
  },
  helperText: {
    ...typography.caption,
    color: colors.slate500,
    marginTop: 4,
  },
});
