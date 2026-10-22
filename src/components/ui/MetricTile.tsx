import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../theme/tokens';

interface MetricTileProps {
  label: string;
  value: string | number;
  subtext?: string;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  badgeText?: string;
  badgeColor?: string;
  onPress?: () => void;
}

export const MetricTile: React.FC<MetricTileProps> = ({
  label,
  value,
  subtext,
  iconName,
  iconColor = colors.primary,
  iconBg = colors.primarySurface,
  badgeText,
  badgeColor = colors.primary,
  onPress,
}) => {
  const content = (
    <View style={styles.card}>
      <View style={styles.topRow}>
        {iconName ? (
          <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
            <MaterialCommunityIcons name={iconName} size={20} color={iconColor} />
          </View>
        ) : null}

        {badgeText ? (
          <View style={[styles.badge, { backgroundColor: iconBg }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.valueText} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.labelText} numberOfLines={1}>
        {label}
      </Text>
      {subtext ? (
        <Text style={styles.subtext} numberOfLines={1}>
          {subtext}
        </Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.touchable}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.touchable}>{content}</View>;
};

const styles = StyleSheet.create({
  touchable: {
    flex: 1,
    minWidth: '45%',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    padding: spacing.md,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  valueText: {
    ...typography.metric,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate600,
  },
  subtext: {
    fontSize: 11,
    color: colors.slate400,
    marginTop: 2,
  },
});
