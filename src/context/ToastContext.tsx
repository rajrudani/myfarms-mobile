import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '../theme/tokens';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions | ToastType) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
  hideToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<any>(null);

  const triggerHaptic = (type: ToastType) => {
    try {
      const Haptics = require('expo-haptics');
      if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === 'error') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (type === 'warning') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // Haptics unavailable in environment, fallback gracefully
    }
  };

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [translateY, opacity]);

  const showToast = useCallback(
    (message: string, options?: ToastOptions | ToastType) => {
      const opts: ToastOptions =
        typeof options === 'string' ? { type: options } : options || {};
      const type = opts.type || 'success';
      const duration = opts.duration ?? 3200;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setToast({
        message,
        type,
        actionLabel: opts.actionLabel,
        onAction: opts.onAction,
      });

      triggerHaptic(type);

      // Animate entry
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
          speed: 14,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      timerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [translateY, opacity, hideToast]
  );

  const getTheme = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          icon: 'checkmark-circle' as const,
          iconColor: colors.success,
          bg: '#064e3b',
          border: '#059669',
        };
      case 'error':
        return {
          icon: 'alert-circle' as const,
          iconColor: colors.danger,
          bg: '#450a0a',
          border: '#b91c1c',
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          iconColor: colors.warning,
          bg: '#451a03',
          border: '#d97706',
        };
      case 'info':
      default:
        return {
          icon: 'information-circle' as const,
          iconColor: colors.info,
          bg: '#0f172a',
          border: '#334155',
        };
    }
  };

  const theme = toast ? getTheme(toast.type) : null;
  const topOffset = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 20) + 8;

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && theme ? (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              top: topOffset,
              transform: [{ translateY }],
              opacity,
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={[
              styles.toastBubble,
              {
                backgroundColor: theme.bg,
                borderColor: theme.border,
              },
            ]}
            activeOpacity={0.9}
            onPress={hideToast}
          >
            <View style={styles.iconCol}>
              <Ionicons name={theme.icon} size={22} color={theme.iconColor} />
            </View>

            <View style={styles.messageCol}>
              <Text style={styles.messageText} numberOfLines={2}>
                {toast.message}
              </Text>
            </View>

            {toast.actionLabel && toast.onAction ? (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  toast.onAction?.();
                  hideToast();
                }}
              >
                <Text style={styles.actionText}>{toast.actionLabel}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={hideToast}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
  },
  toastBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    width: '100%',
    maxWidth: 480,
    ...shadows.medium,
  },
  iconCol: {
    marginRight: 10,
  },
  messageCol: {
    flex: 1,
    paddingRight: 8,
  },
  messageText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.sm,
    marginLeft: 6,
  },
  actionText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 2,
  },
});
