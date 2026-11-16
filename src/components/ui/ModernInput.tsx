import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';

export interface ModernInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  required?: boolean;
  error?: string | null;
  helperText?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  wrapperStyle?: StyleProp<ViewStyle>;
  onClear?: () => void;
  showClearButton?: boolean;
}

export const ModernInput: React.FC<ModernInputProps> = ({
  label,
  required = false,
  error,
  helperText,
  prefix,
  suffix,
  containerStyle,
  inputStyle,
  wrapperStyle,
  onClear,
  showClearButton = false,
  value,
  onFocus,
  onBlur,
  editable = true,
  multiline = false,
  numberOfLines,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const hasValue = value !== undefined && value !== null && String(value).length > 0;
  const hasError = !!error;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.requiredAsterisk}> *</Text>}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          multiline && styles.inputWrapperMultiline,
          !editable && styles.inputWrapperDisabled,
          isFocused && styles.inputWrapperFocused,
          hasError && styles.inputWrapperError,
          wrapperStyle,
        ]}
      >
        {prefix ? (
          <View style={styles.prefixContainer}>
            {typeof prefix === 'string' ? (
              <Text style={styles.affixText}>{prefix}</Text>
            ) : (
              prefix
            )}
          </View>
        ) : null}

        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            inputStyle,
          ]}
          value={value}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          placeholderTextColor={colors.slate400}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />

        {showClearButton && hasValue && editable && onClear ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={onClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        ) : null}

        {suffix ? (
          <View style={styles.suffixContainer}>
            {typeof suffix === 'string' ? (
              <Text style={styles.affixText}>{suffix}</Text>
            ) : (
              suffix
            )}
          </View>
        ) : null}
      </View>

      {hasError ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate700,
    letterSpacing: 0.1,
  },
  requiredAsterisk: {
    color: colors.danger,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    paddingHorizontal: spacing.md,
    shadowColor: colors.slate900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  inputWrapperMultiline: {
    minHeight: 88,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
    backgroundColor: '#fafdfb',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  inputWrapperError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSurface,
  },
  inputWrapperDisabled: {
    backgroundColor: colors.slate100,
    borderColor: colors.slate200,
    opacity: 0.8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.slate900,
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    paddingTop: 4,
    paddingBottom: 4,
  },
  prefixContainer: {
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suffixContainer: {
    marginLeft: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  affixText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate500,
  },
  clearButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.slate200,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  clearButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.slate600,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 4,
  },
});
