import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, shadows, typography } from '../../theme/tokens';
import { useResponsive, touchTargetHitSlop } from '../../utils/responsive';

export interface ModalSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  kicker?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeight?: number | string;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  dismissable?: boolean;
}

export const ModalSheet: React.FC<ModalSheetProps> = ({
  visible,
  onClose,
  title,
  kicker,
  children,
  footer,
  maxHeight = '88%',
  scrollable = true,
  contentContainerStyle,
  dismissable = true,
}) => {
  const insets = useSafeAreaInsets();
  const { isTablet, modalMaxWidth } = useResponsive();

  const bottomPadding = Math.max(insets.bottom, 16);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity
          style={styles.backdropDismiss}
          activeOpacity={1}
          onPress={dismissable ? onClose : undefined}
        />

        <View
          style={[
            styles.sheetContainer,
            { maxHeight: maxHeight as any },
            isTablet && { maxWidth: modalMaxWidth as number, alignSelf: 'center', width: '100%' },
            { paddingBottom: bottomPadding },
          ]}
        >
          {/* Top Pill Handle Indicator */}
          <View style={styles.handleBar} />

          {/* Optional Header */}
          {(title || kicker) && (
            <View style={styles.headerRow}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                {kicker ? <Text style={styles.kickerText}>{kicker.toUpperCase()}</Text> : null}
                {title ? <Text style={styles.titleText}>{title}</Text> : null}
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={touchTargetHitSlop}
                style={styles.closeBtn}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={22} color={colors.slate600} />
              </TouchableOpacity>
            </View>
          )}

          {/* Body Content */}
          {scrollable ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.staticContent, contentContainerStyle]}>{children}</View>
          )}

          {/* Optional Footer (Sticky Buttons) */}
          {footer ? <View style={styles.footerRow}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    width: '100%',
    ...shadows.medium,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.slate300,
    alignSelf: 'center',
    marginVertical: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
    marginBottom: spacing.sm,
  },
  kickerText: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  titleText: {
    ...typography.title2,
    fontSize: 18,
    color: colors.slate900,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingVertical: spacing.xs,
  },
  staticContent: {
    flexShrink: 1,
  },
  footerRow: {
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
});
