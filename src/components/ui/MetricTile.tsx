import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { formatCurrency, formatQuantity, formatCompactCurrency } from '../../utils/formatters';

export interface MetricTileProps {
  label: string;
  value: string | number;
  subtext?: string;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  badgeText?: string;
  badgeColor?: string;
  onPress?: () => void;
  formatAs?: 'currency' | 'compact-currency' | 'quantity' | 'none';
  style?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
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
  formatAs,
  style,
  cardStyle,
}) => {
  let displayValue = value;
  if (formatAs && formatAs !== 'none') {
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
    if (!isNaN(num)) {
      if (formatAs === 'currency') {
        displayValue = formatCurrency(num);
      } else if (formatAs === 'compact-currency') {
        displayValue = formatCompactCurrency(num);
      } else if (formatAs === 'quantity') {
        displayValue = formatQuantity(num);
      }
    }
  }

  const content = (
    <View style={[styles.card, cardStyle]}>
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

      <Text
        style={styles.valueText}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {displayValue}
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
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[styles.touchable, style]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.touchable, style]}>{content}</View>;
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
    shadowColor: colors.slate900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
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
