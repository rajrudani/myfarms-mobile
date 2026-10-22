import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme/tokens';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label?: string;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 1,
  unit,
  label,
}) => {
  const handleDecrement = () => {
    const next = Math.max(min, value - step);
    onChange(next);
  };

  const handleIncrement = () => {
    const next = Math.min(max, value + step);
    onChange(next);
  };

  const handleManualInput = (text: string) => {
    const parsed = parseFloat(text);
    if (isNaN(parsed)) {
      onChange(min);
    } else {
      onChange(Math.min(max, Math.max(min, parsed)));
    }
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.stepperRow}>
        <TouchableOpacity
          style={[styles.btn, value <= min && styles.btnDisabled]}
          onPress={handleDecrement}
          disabled={value <= min}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="minus"
            size={20}
            color={value <= min ? colors.slate400 : colors.slate700}
          />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={value.toString()}
            onChangeText={handleManualInput}
            selectTextOnFocus
          />
          {unit ? <Text style={styles.unitText}>{unit}</Text> : null}
        </View>

        <TouchableOpacity
          style={[styles.btn, value >= max && styles.btnDisabled]}
          onPress={handleIncrement}
          disabled={value >= max}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="plus"
            size={20}
            color={value >= max ? colors.slate400 : colors.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate600,
    marginBottom: spacing.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    padding: 4,
  },
  btn: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    backgroundColor: colors.slate100,
    borderColor: colors.slate200,
    opacity: 0.5,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  input: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.slate900,
    textAlign: 'center',
    minWidth: 40,
  },
  unitText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate500,
    marginLeft: 4,
  },
});
