import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';

export interface ChipOption<T = string> {
  label: string;
  value: T;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface QuickChipGroupProps<T = string> {
  options: ChipOption<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  scrollable?: boolean;
  size?: 'sm' | 'md';
}

export function QuickChipGroup<T extends string | number>({
  options,
  selectedValue,
  onSelect,
  scrollable = false,
  size = 'md',
}: QuickChipGroupProps<T>) {
  const content = (
    <View style={[styles.container, !scrollable && styles.wrapContainer]}>
      {options.map((opt) => {
        const isSelected = selectedValue === opt.value;
        return (
          <TouchableOpacity
            key={String(opt.value)}
            style={[
              styles.chip,
              size === 'sm' && styles.chipSmall,
              isSelected && styles.chipSelected,
            ]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
          >
            {opt.icon ? <View style={styles.iconBox}>{opt.icon}</View> : null}
            <Text
              style={[
                styles.chipText,
                size === 'sm' && styles.chipTextSmall,
                isSelected && styles.chipTextSelected,
              ]}
            >
              {opt.label}
            </Text>
            {opt.badge !== undefined ? (
              <View
                style={[
                  styles.badge,
                  isSelected ? styles.badgeSelected : styles.badgeUnselected,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    isSelected ? styles.badgeTextSelected : styles.badgeTextUnselected,
                  ]}
                >
                  {opt.badge}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {content}
      </ScrollView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wrapContainer: {
    flexWrap: 'wrap',
  },
  scrollContent: {
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  iconBox: {
    marginRight: -2,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate700,
  },
  chipTextSmall: {
    fontSize: 12,
  },
  chipTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  badgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgeUnselected: {
    backgroundColor: colors.slate200,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextSelected: {
    color: colors.white,
  },
  badgeTextUnselected: {
    color: colors.slate600,
  },
});
