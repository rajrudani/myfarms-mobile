import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Platform,
  StyleProp,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography, shadows } from '../../theme/tokens';
import { touchTargetHitSlop } from '../../utils/responsive';

export interface ModernDatePickerProps {
  label?: string;
  value?: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
  allowClear?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Helpers to format dates safely without time zone shifts
function parseDateParts(dateStr?: string | null): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.split('T')[0].trim();
  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1; // 0-indexed month
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return { year: y, month: m, day: d };
    }
  }
  return null;
}

function formatDateString(y: number, m: number, d: number): string {
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

export function formatReadableDate(dateStr?: string | null): string {
  const parsed = parseDateParts(dateStr);
  if (!parsed) return '';
  return `${parsed.day} ${MONTH_NAMES_SHORT[parsed.month]} ${parsed.year}`;
}

export const ModernDatePicker: React.FC<ModernDatePickerProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  required = false,
  error,
  helperText,
  minDate,
  maxDate,
  allowClear = false,
  containerStyle,
  disabled = false,
}) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);

  // Parse current initial viewing month & year
  const initialParts = useMemo(() => {
    const parsed = parseDateParts(value);
    if (parsed) return parsed;
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(initialParts.year);
  const [viewMonth, setViewMonth] = useState<number>(initialParts.month);

  const todayStr = useMemo(() => {
    const now = new Date();
    return formatDateString(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const yesterdayStr = useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    return formatDateString(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const inSevenDaysStr = useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() + 7);
    return formatDateString(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    const parsed = parseDateParts(value);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    } else {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleClear = (e?: any) => {
    e?.stopPropagation?.();
    onChange('');
    setIsOpen(false);
  };

  // Build calendar matrix for currently viewed month
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 for Sunday
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: {
      key: string;
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isToday: boolean;
      isDisabled: boolean;
    }[] = [];

    // Leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = formatDateString(prevYear, prevMonth, dayNum);
      cells.push({
        key: `prev-${dayNum}`,
        dayNumber: dayNum,
        dateStr,
        isCurrentMonth: false,
        isSelected: value === dateStr,
        isToday: dateStr === todayStr,
        isDisabled: true, // Non-current month days are passive
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = formatDateString(viewYear, viewMonth, d);
      const isSelected = value === dateStr;
      const isToday = dateStr === todayStr;

      let isDisabled = false;
      if (minDate && dateStr < minDate) isDisabled = true;
      if (maxDate && dateStr > maxDate) isDisabled = true;

      cells.push({
        key: `curr-${d}`,
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isSelected,
        isToday,
        isDisabled,
      });
    }

    // Trailing days to fill standard 35 or 42 cell grid
    const totalSlots = cells.length > 35 ? 42 : 35;
    const remaining = totalSlots - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = formatDateString(nextYear, nextMonth, d);
      cells.push({
        key: `next-${d}`,
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        isSelected: value === dateStr,
        isToday: dateStr === todayStr,
        isDisabled: true,
      });
    }

    return cells;
  }, [viewYear, viewMonth, value, todayStr, minDate, maxDate]);

  const readableDisplay = value ? formatReadableDate(value) : '';
  const bottomPadding = Math.max(insets.bottom, 20);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label}
            {required ? <Text style={styles.requiredAsterisk}> *</Text> : null}
          </Text>
        </View>
      )}

      {/* Trigger Box */}
      <TouchableOpacity
        style={[
          styles.triggerBox,
          error ? styles.triggerBoxError : null,
          disabled && styles.triggerBoxDisabled,
        ]}
        onPress={handleOpen}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <View style={styles.triggerLeft}>
          <Ionicons
            name="calendar-outline"
            size={18}
            color={value ? colors.primary : colors.slate400}
            style={styles.calendarIcon}
          />
          <Text
            style={[
              styles.triggerText,
              !value && styles.placeholderText,
            ]}
            numberOfLines={1}
          >
            {readableDisplay || placeholder}
          </Text>
        </View>

        <View style={styles.triggerRight}>
          {allowClear && value && !disabled && (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={touchTargetHitSlop}
              style={styles.clearBtn}
              accessibilityLabel="Clear Date"
            >
              <Ionicons name="close-circle" size={17} color={colors.slate400} />
            </TouchableOpacity>
          )}
          <Ionicons name="chevron-down" size={17} color={colors.slate400} />
        </View>
      </TouchableOpacity>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}

      {/* Bottom Sheet Calendar Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.backdrop}>
          <TouchableOpacity
            style={styles.backdropDismiss}
            activeOpacity={1}
            onPress={handleClose}
          />

          <View style={[styles.sheetContainer, { paddingBottom: bottomPadding }]}>
            {/* Top Handle Bar */}
            <View style={styles.handleBar} />

            {/* Modal Header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{label || 'Select Date'}</Text>
                {value ? (
                  <Text style={styles.selectedSubtitle}>
                    {formatReadableDate(value)} ({value})
                  </Text>
                ) : (
                  <Text style={styles.selectedSubtitle}>Choose date from below</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={touchTargetHitSlop}
                style={styles.closeBtn}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={22} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            {/* 1-Tap Quick Presets */}
            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={[styles.presetChip, value === todayStr && styles.presetChipActive]}
                onPress={() => handleSelectDate(todayStr)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="today-outline"
                  size={14}
                  color={value === todayStr ? colors.white : colors.primary}
                />
                <Text
                  style={[
                    styles.presetChipText,
                    value === todayStr && styles.presetChipTextActive,
                  ]}
                >
                  Today
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.presetChip, value === yesterdayStr && styles.presetChipActive]}
                onPress={() => handleSelectDate(yesterdayStr)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={value === yesterdayStr ? colors.white : colors.slate700}
                />
                <Text
                  style={[
                    styles.presetChipText,
                    value === yesterdayStr && styles.presetChipTextActive,
                  ]}
                >
                  Yesterday
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.presetChip, value === inSevenDaysStr && styles.presetChipActive]}
                onPress={() => handleSelectDate(inSevenDaysStr)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="calendar-number-outline"
                  size={14}
                  color={value === inSevenDaysStr ? colors.white : colors.slate700}
                />
                <Text
                  style={[
                    styles.presetChipText,
                    value === inSevenDaysStr && styles.presetChipTextActive,
                  ]}
                >
                  +7 Days
                </Text>
              </TouchableOpacity>
            </View>

            {/* Month & Year Navigation Row */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                hitSlop={touchTargetHitSlop}
                style={styles.navArrowBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={20} color={colors.slate700} />
              </TouchableOpacity>

              <View style={styles.monthYearTitleBox}>
                <Text style={styles.monthYearTitle}>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleNextMonth}
                hitSlop={touchTargetHitSlop}
                style={styles.navArrowBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.slate700} />
              </TouchableOpacity>
            </View>

            {/* Weekdays Row */}
            <View style={styles.weekdaysRow}>
              {DAY_LABELS.map((day, idx) => (
                <View key={day} style={styles.weekdayCell}>
                  <Text
                    style={[
                      styles.weekdayText,
                      idx === 0 && { color: colors.danger }, // Sunday indicator
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {calendarCells.map((cell) => {
                return (
                  <TouchableOpacity
                    key={cell.key}
                    style={[
                      styles.dayCell,
                      cell.isSelected && styles.dayCellSelected,
                      cell.isToday && !cell.isSelected && styles.dayCellToday,
                    ]}
                    onPress={() => !cell.isDisabled && handleSelectDate(cell.dateStr)}
                    disabled={cell.isDisabled}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayNumberText,
                        !cell.isCurrentMonth && styles.dayNumberPassive,
                        cell.isToday && !cell.isSelected && styles.dayNumberToday,
                        cell.isSelected && styles.dayNumberSelected,
                        cell.isDisabled && styles.dayNumberDisabled,
                      ]}
                    >
                      {cell.dayNumber}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Footer with Clear & Close */}
            <View style={styles.sheetFooter}>
              {allowClear && value ? (
                <TouchableOpacity
                  style={styles.sheetClearBtn}
                  onPress={handleClear}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sheetClearBtnText}>Clear Date</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.sheetCloseDoneBtn}
                onPress={handleClose}
                activeOpacity={0.7}
              >
                <Text style={styles.sheetCloseDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  labelRow: {
    marginBottom: 6,
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.slate800,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  requiredAsterisk: {
    color: colors.danger,
    fontWeight: '800',
  },
  triggerBox: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    ...shadows.subtle,
  },
  triggerBoxError: {
    borderColor: colors.danger,
  },
  triggerBoxDisabled: {
    backgroundColor: colors.slate100,
    borderColor: colors.slate200,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: spacing.sm,
  },
  calendarIcon: {
    marginRight: 8,
  },
  triggerText: {
    ...typography.body,
    color: colors.slate900,
    fontWeight: '500',
  },
  placeholderText: {
    color: colors.slate400,
    fontWeight: '400',
  },
  triggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearBtn: {
    padding: 2,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: 4,
    fontWeight: '600',
  },
  helperText: {
    ...typography.caption,
    color: colors.slate500,
    marginTop: 4,
  },

  // Modal Backdrop
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    ...shadows.medium,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.slate300,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  sheetTitle: {
    ...typography.title3,
    color: colors.slate900,
    fontWeight: '800',
  },
  selectedSubtitle: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
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

  // Quick Presets
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  presetChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  presetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetChipText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.slate700,
  },
  presetChipTextActive: {
    color: colors.white,
  },

  // Month Navigation
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  monthYearTitleBox: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  monthYearTitle: {
    ...typography.title2,
    color: colors.slate900,
    fontWeight: '800',
  },
  navArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Weekdays
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  weekdayCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    ...typography.caption,
    color: colors.slate500,
    fontWeight: '700',
  },

  // Days Grid
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: spacing.xs,
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: radius.pill,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
    ...shadows.glowPrimary,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dayNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate800,
  },
  dayNumberPassive: {
    color: colors.slate300,
    fontWeight: '400',
  },
  dayNumberToday: {
    color: colors.primary,
    fontWeight: '800',
  },
  dayNumberSelected: {
    color: colors.white,
    fontWeight: '800',
  },
  dayNumberDisabled: {
    color: colors.slate200,
    fontWeight: '400',
  },

  // Sheet Footer
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    marginTop: spacing.xs,
  },
  sheetClearBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  sheetClearBtnText: {
    ...typography.bodySmall,
    color: colors.danger,
    fontWeight: '700',
  },
  sheetCloseDoneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: radius.md,
    ...shadows.subtle,
  },
  sheetCloseDoneBtnText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: '800',
  },
});
