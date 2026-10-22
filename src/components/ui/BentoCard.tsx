import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, radius, shadows, spacing } from '../../theme/tokens';

interface BentoCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'glass' | 'tinted';
  onPress?: () => void;
  activeOpacity?: number;
}

export const BentoCard: React.FC<BentoCardProps> = ({
  children,
  style,
  variant = 'default',
  onPress,
  activeOpacity = 0.7,
}) => {
  const combinedStyle = [
    styles.base,
    variant === 'elevated' && styles.elevated,
    variant === 'glass' && styles.glass,
    variant === 'tinted' && styles.tinted,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={combinedStyle}
        onPress={onPress}
        activeOpacity={activeOpacity}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={combinedStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    padding: spacing.lg,
    ...shadows.subtle,
  },
  elevated: {
    ...shadows.medium,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  tinted: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryBorder,
  },
});
