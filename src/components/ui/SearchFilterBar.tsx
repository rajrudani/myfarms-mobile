import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme/tokens';

interface SearchFilterBarProps {
  query: string;
  onChangeQuery: (text: string) => void;
  placeholder?: string;
  hasFilter?: boolean;
  isFilterActive?: boolean;
  onToggleFilter?: () => void;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  query,
  onChangeQuery,
  placeholder = 'Search...',
  hasFilter = false,
  isFilterActive = false,
  onToggleFilter,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={colors.slate400} style={styles.icon} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={onChangeQuery}
          placeholder={placeholder}
          placeholderTextColor={colors.slate400}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => onChangeQuery('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={colors.slate400} />
          </TouchableOpacity>
        ) : null}
      </View>

      {hasFilter && onToggleFilter ? (
        <TouchableOpacity
          style={[styles.filterBtn, isFilterActive && styles.filterBtnActive]}
          onPress={onToggleFilter}
          activeOpacity={0.7}
        >
          <Ionicons
            name="funnel"
            size={18}
            color={isFilterActive ? colors.white : colors.slate600}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  icon: {
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.slate900,
    height: '100%',
  },
  clearBtn: {
    padding: spacing.xs,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
