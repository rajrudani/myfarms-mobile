import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, shadows } from '../../theme/tokens';
import { useTranslation } from '../../i18n/I18nContext';

export interface ConfirmModalProps {
  visible: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  variant,
  destructive = false,
  icon,
  loading = false,
}) => {
  const { t } = useTranslation();
  const [internalLoading, setInternalLoading] = useState(false);
  const handleClose = onCancel || onClose || (() => {});
  const resolvedConfirmLabel = confirmLabel || confirmText || t('Confirm');
  const resolvedCancelLabel = cancelLabel || cancelText || t('Cancel');
  const effectiveVariant: 'danger' | 'warning' | 'primary' = variant || (destructive ? 'danger' : 'danger');

  const getVariantStyles = () => {
    switch (effectiveVariant) {
      case 'danger':
        return {
          icon: icon || ('trash-outline' as const),
          iconColor: colors.danger,
          iconBg: colors.dangerSurface,
          iconBorder: colors.dangerBorder,
          btnBg: colors.danger,
          btnText: colors.white,
        };
      case 'warning':
        return {
          icon: icon || ('warning-outline' as const),
          iconColor: colors.warning,
          iconBg: colors.warningSurface,
          iconBorder: colors.warningBorder,
          btnBg: colors.warning,
          btnText: colors.white,
        };
      case 'primary':
      default:
        return {
          icon: icon || ('checkmark-circle-outline' as const),
          iconColor: colors.primary,
          iconBg: colors.primarySurface,
          iconBorder: colors.primaryBorder,
          btnBg: colors.primary,
          btnText: colors.white,
        };
    }
  };

  const v = getVariantStyles();
  const isLoading = loading || internalLoading;

  const handleConfirmPress = async () => {
    try {
      const Haptics = require('expo-haptics');
      if (effectiveVariant === 'danger') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      // Haptics fallback
    }

    try {
      setInternalLoading(true);
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={isLoading ? undefined : handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetCard}>
              {/* Icon Halo */}
              <View
                style={[
                  styles.iconHalo,
                  { backgroundColor: v.iconBg, borderColor: v.iconBorder },
                ]}
              >
                <Ionicons name={v.icon} size={32} color={v.iconColor} />
              </View>

              {/* Title & Description */}
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              {/* Action Buttons */}
              <View style={styles.buttonStack}>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: v.btnBg }]}
                  onPress={handleConfirmPress}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={[styles.confirmBtnText, { color: v.btnText }]}>
                      {t(resolvedConfirmLabel)}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleClose}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>{t(resolvedCancelLabel)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: Platform.OS === 'ios' ? 16 : 12,
  },
  sheetCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.xl,
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    ...shadows.medium,
  },
  iconHalo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.slate900,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 14,
    color: colors.slate600,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
    paddingHorizontal: 8,
  },
  buttonStack: {
    width: '100%',
    gap: 10,
  },
  confirmBtn: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate700,
  },
});
