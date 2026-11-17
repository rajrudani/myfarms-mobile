import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing, shadows } from '../../theme/tokens';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  mciIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconComponent?: React.ReactNode;
  iconColor?: string;
  iconBgColor?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'file-tray-outline',
  mciIcon,
  iconComponent,
  iconColor = colors.slate400,
  iconBgColor = colors.slate100,
  title,
  message,
  actionLabel,
  actionIcon = 'add',
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  style,
  compact = false,
}) => {
  return (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      {/* Icon Halo */}
      <View style={[styles.iconHalo, { backgroundColor: iconBgColor }, compact && styles.iconHaloCompact]}>
        {iconComponent ? (
          iconComponent
        ) : mciIcon ? (
          <MaterialCommunityIcons
            name={mciIcon}
            size={compact ? 24 : 32}
            color={iconColor}
          />
        ) : (
          <Ionicons
            name={icon}
            size={compact ? 24 : 32}
            color={iconColor}
          />
        )}
      </View>

      {/* Title */}
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>

      {/* Message */}
      {message ? (
        <Text style={[styles.message, compact && styles.messageCompact]}>
          {message}
        </Text>
      ) : null}

      {/* Actions */}
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onAction}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {actionIcon ? (
            <Ionicons name={actionIcon} size={16} color={colors.white} />
          ) : null}
          <Text style={styles.actionBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}

      {secondaryActionLabel && onSecondaryAction ? (
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={onSecondaryAction}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.secondaryBtnText}>{secondaryActionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 1.5,
    paddingHorizontal: spacing.xl,
  },
  containerCompact: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  iconHalo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.slate200,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  iconHaloCompact: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate800,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 14,
  },
  message: {
    fontSize: 13,
    color: colors.slate500,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 290,
  },
  messageCompact: {
    fontSize: 12,
    lineHeight: 16,
    maxWidth: 240,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
    gap: 6,
    ...shadows.glowPrimary,
  },
  actionBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginTop: spacing.xs,
  },
  secondaryBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
