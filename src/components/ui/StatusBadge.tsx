import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme/tokens';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  dot?: boolean;
}

const variantStyles: Record<
  StatusVariant,
  { bg: string; border: string; text: string; dot: string }
> = {
  success: {
    bg: colors.successSurface,
    border: colors.successBorder,
    text: colors.successText,
    dot: colors.success,
  },
  warning: {
    bg: colors.warningSurface,
    border: colors.warningBorder,
    text: colors.warningText,
    dot: colors.warning,
  },
  danger: {
    bg: colors.dangerSurface,
    border: colors.dangerBorder,
    text: colors.dangerText,
    dot: colors.danger,
  },
  info: {
    bg: colors.infoSurface,
    border: colors.infoBorder,
    text: colors.infoText,
    dot: colors.info,
  },
  purple: {
    bg: colors.purpleSurface,
    border: colors.purpleBorder,
    text: colors.purpleText,
    dot: colors.purple,
  },
  neutral: {
    bg: colors.slate100,
    border: colors.slate200,
    text: colors.slate600,
    dot: colors.slate400,
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  dot = true,
}) => {
  const current = variantStyles[variant] || variantStyles.neutral;

  return (
    <View style={[styles.badge, { backgroundColor: current.bg, borderColor: current.border }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: current.dot }]} /> : null}
      <Text style={[styles.text, { color: current.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 5,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
