import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Alert,
  TextInput,
  Platform,
  StatusBar,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { reportsApi } from '../src/api/reports';
import { useResponsive } from '../src/utils/responsive';
import {
  ReportFiltersData,
  AttendanceReportRow,
  PaymentReportRow,
  ActivityReportRow,
  ExpenseReportRow,
} from '../src/types';
import { extractErrorMessage } from '../src/api/client';
import {
  BentoCard,
  MetricTile,
  StatusBadge,
  QuickChipGroup,
  SearchableSelect,
  ModernDatePicker,
  ModalSheet,
  EmptyState,
} from '../src/components/ui';
import { colors, spacing, radius, typography, shadows } from '../src/theme/tokens';
import { useTranslation } from '../src/i18n/I18nContext';
import { downloadAndShareReport, ReportExportFormat } from '../src/utils/exportReport';

type ReportType = 'attendance' | 'payment' | 'activity' | 'expense' | null;

const MONTHS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

export default function ReportsScreen() {
  const { t } = useTranslation();
  const { containerMaxWidth, isTablet } = useResponsive();
  const params = useLocalSearchParams();
  const paramType = (params.type as ReportType) || null;
  const paramWorkerId = params.worker_id ? String(params.worker_id) : undefined;
  const paramFarmId = params.farm_id ? String(params.farm_id) : undefined;

  const [activeReport, setActiveReport] = useState<ReportType>(paramType);
  const [filtersData, setFiltersData] = useState<ReportFiltersData | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    if (paramType && ['attendance', 'payment', 'activity', 'expense'].includes(paramType)) {
      setActiveReport(paramType);
    }
    if (paramWorkerId) {
      setSelectedWorker(paramWorkerId);
    }
    if (paramFarmId) {
      setSelectedFarm(paramFarmId);
    }
  }, [paramType, paramWorkerId, paramFarmId]);

  // Defaults
  const defaultFromDate = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  }, []);

  const defaultToDate = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const defaultMonth = useMemo(() => new Date().getMonth() + 1, []);
  const defaultYear = useMemo(() => new Date().getFullYear(), []);

  // Export States
  const [exportLoading, setExportLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ReportExportFormat | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Filter States
  const [selectedFarm, setSelectedFarm] = useState<string>(paramFarmId || '');
  const [selectedWorker, setSelectedWorker] = useState<string>(paramWorkerId || '');
  const [includeFamily, setIncludeFamily] = useState<boolean>(false);
  const [selectedCycle, setSelectedCycle] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultMonth);
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [fromDate, setFromDate] = useState<string>(defaultFromDate);
  const [toDate, setToDate] = useState<string>(defaultToDate);

  // Draft filter states for Filter Modal Sheet
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [draftFarm, setDraftFarm] = useState<string>('');
  const [draftWorker, setDraftWorker] = useState<string>('');
  const [draftIncludeFamily, setDraftIncludeFamily] = useState<boolean>(false);
  const [draftCycle, setDraftCycle] = useState<string>('');
  const [draftMonth, setDraftMonth] = useState<number>(defaultMonth);
  const [draftYear, setDraftYear] = useState<number>(defaultYear);
  const [draftFromDate, setDraftFromDate] = useState<string>(defaultFromDate);
  const [draftToDate, setDraftToDate] = useState<string>(defaultToDate);

  // Report Data States
  const [attendanceData, setAttendanceData] = useState<{
    rows: AttendanceReportRow[];
    summary: { present: number; half_day: number; absent: number; total_attendance: number };
  } | null>(null);

  const [paymentData, setPaymentData] = useState<{
    rows: PaymentReportRow[];
    summary: { total_amount: number };
  } | null>(null);

  const [activityData, setActivityData] = useState<{
    rows: ActivityReportRow[];
    summary: { total: number; completed: number; open: number };
  } | null>(null);

  const [expenseData, setExpenseData] = useState<{
    rows: ExpenseReportRow[];
    summary: { total_spend: number; entries_count: number; completed_amount: number };
  } | null>(null);

  // Resolved display names for chips and summary card
  const selectedFarmName = useMemo(() => {
    if (!selectedFarm || !filtersData?.farms) return null;
    return filtersData.farms.find((f) => f.id.toString() === selectedFarm)?.name || null;
  }, [selectedFarm, filtersData]);

  const selectedWorkerName = useMemo(() => {
    if (!selectedWorker || !filtersData?.workers) return null;
    return filtersData.workers.find((w) => w.ulid === selectedWorker)?.name || null;
  }, [selectedWorker, filtersData]);

  const selectedCycleName = useMemo(() => {
    if (!selectedCycle || !filtersData?.crop_cycles) return null;
    return filtersData.crop_cycles.find((c) => c.id.toString() === selectedCycle)?.label || null;
  }, [selectedCycle, filtersData]);

  // Format date helper for range labels
  const formatDateLabel = (isoDate: string) => {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getSelectedRangeLabel = (from: string, to: string) => {
    if (from && to) {
      return `${formatDateLabel(from)} – ${formatDateLabel(to)}`;
    }
    if (from) {
      return t('From :date', { date: formatDateLabel(from) });
    }
    if (to) {
      return t('Up to :date', { date: formatDateLabel(to) });
    }
    return t('All Dates');
  };

  // Determine if active filters differ from default view
  const hasActiveFilters = useMemo(() => {
    if (!activeReport) return false;
    const defaultFarmId = filtersData?.farms?.[0]?.id?.toString() || '';
    const defaultWorkerId = paramWorkerId || filtersData?.workers?.[0]?.ulid || '';

    if (activeReport === 'attendance') {
      const isDefault =
        (selectedFarm === defaultFarmId || selectedFarm === '') &&
        selectedWorker === '' &&
        selectedMonth === defaultMonth &&
        selectedYear === defaultYear;
      return !isDefault;
    }
    if (activeReport === 'payment') {
      const isDefault =
        selectedWorker === defaultWorkerId &&
        !includeFamily &&
        fromDate === defaultFromDate &&
        toDate === defaultToDate;
      return !isDefault;
    }
    if (activeReport === 'activity' || activeReport === 'expense') {
      const isDefault =
        selectedFarm === defaultFarmId &&
        !selectedCycle &&
        fromDate === defaultFromDate &&
        toDate === defaultToDate;
      return !isDefault;
    }
    return false;
  }, [
    activeReport,
    selectedFarm,
    selectedWorker,
    selectedCycle,
    includeFamily,
    selectedMonth,
    selectedYear,
    fromDate,
    toDate,
    defaultFromDate,
    defaultToDate,
    defaultMonth,
    defaultYear,
    filtersData,
    paramWorkerId,
  ]);

  const filterModalSubtitle = useMemo(() => {
    if (activeReport === 'attendance') return t('Refined attendance search');
    if (activeReport === 'payment') return t('Refined payment search');
    if (activeReport === 'activity') return t('Refine activity records by farm, cycle, and date range.');
    if (activeReport === 'expense') return t('Refine expense records by farm, cycle, and date range.');
    return t('Filters');
  }, [activeReport, t]);

  // Open modal populated with current active filter states
  const openFiltersModal = () => {
    setDraftFarm(selectedFarm);
    setDraftWorker(selectedWorker);
    setDraftIncludeFamily(includeFamily);
    setDraftCycle(selectedCycle);
    setDraftMonth(selectedMonth);
    setDraftYear(selectedYear);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setShowFilterModal(true);
  };

  // Quick Preset Helper for draft date filters inside modal
  const applyDraftDatePreset = (preset: 'month' | '30days' | 'quarter') => {
    const today = new Date();
    const to = today.toISOString().split('T')[0];
    let from = '';

    if (preset === 'month') {
      from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      from = past.toISOString().split('T')[0];
    } else if (preset === 'quarter') {
      const past = new Date();
      past.setDate(past.getDate() - 90);
      from = past.toISOString().split('T')[0];
    }

    setDraftFromDate(from);
    setDraftToDate(to);
  };

  // Run/Fetch Attendance Report
  const fetchAttendanceReport = async (
    farmVal = selectedFarm,
    workerVal = selectedWorker,
    monthVal = selectedMonth,
    yearVal = selectedYear
  ) => {
    if (!farmVal && !workerVal) return;
    setReportLoading(true);
    try {
      const data = await reportsApi.getAttendanceReport({
        farm_id: farmVal,
        farm_staff_id: workerVal,
        month: monthVal,
        year: yearVal,
      });
      setAttendanceData(data);
    } catch (error) {
      console.error(error);
      Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to fetch attendance report.')));
    } finally {
      setReportLoading(false);
    }
  };

  // Run/Fetch Payment Report
  const fetchPaymentReport = async (
    workerVal = selectedWorker,
    fromVal = fromDate,
    toVal = toDate,
    familyVal = includeFamily
  ) => {
    if (!workerVal) return;
    setReportLoading(true);
    try {
      const data = await reportsApi.getPaymentReport({
        farm_staff_id: workerVal,
        include_family: familyVal,
        from_date: fromVal,
        to_date: toVal,
      });
      setPaymentData(data);
    } catch (error) {
      console.error(error);
      Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to fetch payment report.')));
    } finally {
      setReportLoading(false);
    }
  };

  // Run/Fetch Activity Report
  const fetchActivityReport = async (
    farmVal = selectedFarm,
    cycleVal = selectedCycle,
    fromVal = fromDate,
    toVal = toDate
  ) => {
    if (!farmVal) return;
    setReportLoading(true);
    try {
      const data = await reportsApi.getActivityReport({
        farm_id: farmVal,
        crop_cycle_id: cycleVal,
        from_date: fromVal,
        to_date: toVal,
      });
      setActivityData(data);
    } catch (error) {
      console.error(error);
      Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to fetch activity report.')));
    } finally {
      setReportLoading(false);
    }
  };

  // Run/Fetch Expense Report
  const fetchExpenseReport = async (
    farmVal = selectedFarm,
    cycleVal = selectedCycle,
    fromVal = fromDate,
    toVal = toDate
  ) => {
    if (!farmVal) return;
    setReportLoading(true);
    try {
      const data = await reportsApi.getExpenseReport({
        farm_id: farmVal,
        crop_cycle_id: cycleVal,
        from_date: fromVal,
        to_date: toVal,
      });
      setExpenseData(data);
    } catch (error) {
      console.error(error);
      Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to fetch expense report.')));
    } finally {
      setReportLoading(false);
    }
  };

  // Load Filters Data & Preload active report if opening directly
  useEffect(() => {
    async function loadFilters() {
      try {
        const data = await reportsApi.getFilters();
        setFiltersData(data);

        const initialReport = (params.type as ReportType) || activeReport;
        const initialFarm = params.farm_id ? String(params.farm_id) : (data.farms?.[0]?.id?.toString() || '');
        const initialWorker = params.worker_id ? String(params.worker_id) : '';

        if (initialReport === 'attendance') {
          const farmToUse = initialFarm || '';
          if (farmToUse || initialWorker) {
            setSelectedFarm(farmToUse);
            if (initialWorker) setSelectedWorker(initialWorker);
            fetchAttendanceReport(farmToUse, initialWorker, defaultMonth, defaultYear);
          }
        } else if (initialReport === 'payment') {
          const workerToUse = initialWorker || data.workers?.[0]?.ulid || '';
          if (workerToUse) {
            setSelectedWorker(workerToUse);
            fetchPaymentReport(workerToUse, defaultFromDate, defaultToDate, false);
          }
        } else if (initialReport === 'activity') {
          if (initialFarm) {
            setSelectedFarm(initialFarm);
            fetchActivityReport(initialFarm, '', defaultFromDate, defaultToDate);
          }
        } else if (initialReport === 'expense') {
          if (initialFarm) {
            setSelectedFarm(initialFarm);
            fetchExpenseReport(initialFarm, '', defaultFromDate, defaultToDate);
          }
        }
      } catch (error) {
        console.error('Error loading report filters:', error);
        Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to load filters data.')));
      } finally {
        setLoadingFilters(false);
      }
    }
    loadFilters();
  }, [t]);

  // Switch report type & auto-seed default filters
  const selectReport = (type: ReportType) => {
    setActiveReport(type);
    if (!type) {
      setSelectedFarm('');
      setSelectedWorker('');
      setIncludeFamily(false);
      setSelectedCycle('');
      setAttendanceData(null);
      setPaymentData(null);
      setActivityData(null);
      setExpenseData(null);
      return;
    }

    const firstFarmId = filtersData?.farms?.[0]?.id?.toString() || '';
    const firstWorkerId = paramWorkerId || filtersData?.workers?.[0]?.ulid || '';

    setFromDate(defaultFromDate);
    setToDate(defaultToDate);
    setSelectedMonth(defaultMonth);
    setSelectedYear(defaultYear);
    setIncludeFamily(false);

    if (type === 'attendance') {
      const farmToUse = firstFarmId || '';
      setSelectedFarm(farmToUse);
      setSelectedWorker('');
      setSelectedCycle('');
      setAttendanceData(null);
      if (farmToUse) {
        fetchAttendanceReport(farmToUse, '', defaultMonth, defaultYear);
      }
    } else if (type === 'payment') {
      setSelectedFarm('');
      setSelectedCycle('');
      setSelectedWorker(firstWorkerId);
      setPaymentData(null);
      if (firstWorkerId) {
        fetchPaymentReport(firstWorkerId, defaultFromDate, defaultToDate, false);
      }
    } else if (type === 'activity') {
      setSelectedFarm(firstFarmId);
      setSelectedWorker('');
      setSelectedCycle('');
      setActivityData(null);
      if (firstFarmId) {
        fetchActivityReport(firstFarmId, '', defaultFromDate, defaultToDate);
      }
    } else if (type === 'expense') {
      setSelectedFarm(firstFarmId);
      setSelectedWorker('');
      setSelectedCycle('');
      setExpenseData(null);
      if (firstFarmId) {
        fetchExpenseReport(firstFarmId, '', defaultFromDate, defaultToDate);
      }
    }
  };

  // Reset filters to default matching PWA resetFiltersToDefault()
  const resetFiltersToDefault = () => {
    const firstFarmId = filtersData?.farms?.[0]?.id?.toString() || '';
    const firstWorkerId = paramWorkerId || filtersData?.workers?.[0]?.ulid || '';

    setFromDate(defaultFromDate);
    setToDate(defaultToDate);
    setSelectedMonth(defaultMonth);
    setSelectedYear(defaultYear);
    setIncludeFamily(false);

    if (activeReport === 'attendance') {
      const farmToUse = firstFarmId || '';
      setSelectedFarm(farmToUse);
      setSelectedWorker('');
      fetchAttendanceReport(farmToUse, '', defaultMonth, defaultYear);
    } else if (activeReport === 'payment') {
      setSelectedFarm('');
      setSelectedCycle('');
      setSelectedWorker(firstWorkerId);
      if (firstWorkerId) {
        fetchPaymentReport(firstWorkerId, defaultFromDate, defaultToDate, false);
      } else {
        setPaymentData(null);
      }
    } else if (activeReport === 'activity') {
      setSelectedFarm(firstFarmId);
      setSelectedCycle('');
      if (firstFarmId) {
        fetchActivityReport(firstFarmId, '', defaultFromDate, defaultToDate);
      }
    } else if (activeReport === 'expense') {
      setSelectedFarm(firstFarmId);
      setSelectedCycle('');
      if (firstFarmId) {
        fetchExpenseReport(firstFarmId, '', defaultFromDate, defaultToDate);
      }
    }
  };

  // Apply filters from modal sheet
  const handleApplyFilters = () => {
    if (activeReport === 'attendance') {
      if (!draftFarm && !draftWorker) {
        Alert.alert(t('Filter Required'), t('Please select a Farm or Staff member before exporting.'));
        return;
      }
      setSelectedFarm(draftFarm);
      setSelectedWorker(draftWorker);
      setSelectedMonth(draftMonth);
      setSelectedYear(draftYear);
      setShowFilterModal(false);
      fetchAttendanceReport(draftFarm, draftWorker, draftMonth, draftYear);
    } else if (activeReport === 'payment') {
      if (!draftWorker) {
        Alert.alert(t('Filter Required'), t('Please select a Staff member before exporting.'));
        return;
      }
      setSelectedWorker(draftWorker);
      setIncludeFamily(draftIncludeFamily);
      setFromDate(draftFromDate);
      setToDate(draftToDate);
      setShowFilterModal(false);
      fetchPaymentReport(draftWorker, draftFromDate, draftToDate, draftIncludeFamily);
    } else if (activeReport === 'activity') {
      if (!draftFarm) {
        Alert.alert(t('Filter Required'), t('Please select a Farm before exporting.'));
        return;
      }
      setSelectedFarm(draftFarm);
      setSelectedCycle(draftCycle);
      setFromDate(draftFromDate);
      setToDate(draftToDate);
      setShowFilterModal(false);
      fetchActivityReport(draftFarm, draftCycle, draftFromDate, draftToDate);
    } else if (activeReport === 'expense') {
      if (!draftFarm) {
        Alert.alert(t('Filter Required'), t('Please select a Farm before exporting.'));
        return;
      }
      setSelectedFarm(draftFarm);
      setSelectedCycle(draftCycle);
      setFromDate(draftFromDate);
      setToDate(draftToDate);
      setShowFilterModal(false);
      fetchExpenseReport(draftFarm, draftCycle, draftFromDate, draftToDate);
    }
  };

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const years = useMemo(
    () => Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i),
    []
  );

  // Trigger report export and sharing sheet
  const handleExport = async (format: ReportExportFormat) => {
    if (!activeReport) return;

    if (activeReport === 'attendance' && !selectedFarm && !selectedWorker) {
      Alert.alert(t('Filter Required'), t('Please select a Farm or Staff member before exporting.'));
      return;
    }
    if (activeReport === 'payment' && !selectedWorker) {
      Alert.alert(t('Filter Required'), t('Please select a Staff member before exporting.'));
      return;
    }
    if ((activeReport === 'activity' || activeReport === 'expense') && !selectedFarm) {
      Alert.alert(t('Filter Required'), t('Please select a Farm before exporting.'));
      return;
    }

    setExportLoading(true);
    setExportingFormat(format);
    setShowExportModal(false);

    try {
      const params = {
        farm_id: selectedFarm || undefined,
        farm_staff_id: selectedWorker || undefined,
        include_family: activeReport === 'payment' ? includeFamily : undefined,
        crop_cycle_id: selectedCycle || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        month: selectedMonth || undefined,
        year: selectedYear || undefined,
      };

      const titleName =
        activeReport === 'attendance'
          ? t('Attendance Report')
          : activeReport === 'payment'
          ? t('Payment Report')
          : activeReport === 'activity'
          ? t('Activities Report')
          : t('Expenses Report');

      await downloadAndShareReport(activeReport, format, params, {
        dialogTitle: `${titleName} (${format.toUpperCase()})`,
      });
    } finally {
      setExportLoading(false);
      setExportingFormat(null);
    }
  };

  // Render Active Filter Chips Bar (matches PWA .farm-report-filter-card)
  const renderActiveFilterChips = () => {
    if (!activeReport) return null;

    return (
      <View style={styles.filterCard}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScrollContent}
        >
          {/* Attendance Chips */}
          {activeReport === 'attendance' && (
            <>
              <TouchableOpacity
                style={[styles.chip, styles.chipGreen]}
                onPress={openFiltersModal}
                activeOpacity={0.7}
              >
                <Ionicons name="business-outline" size={13} color="#0f8f64" />
                <Text style={[styles.chipText, styles.chipTextGreen]}>
                  {t('Farm: :name', { name: selectedFarmName || t('All Farms') })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chip, styles.chipGreen]}
                onPress={openFiltersModal}
                activeOpacity={0.7}
              >
                <Ionicons name="person-outline" size={13} color="#0f8f64" />
                <Text style={[styles.chipText, styles.chipTextGreen]}>
                  {t('Staff: :name', { name: selectedWorkerName || t('All Staff') })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chip, styles.chipGreen]}
                onPress={openFiltersModal}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={13} color="#0f8f64" />
                <Text style={[styles.chipText, styles.chipTextGreen]}>
                  {t('Date: :range', {
                    range: `${
                      MONTHS.find((m) => m.value === selectedMonth)?.label
                        ? t(MONTHS.find((m) => m.value === selectedMonth)!.label)
                        : selectedMonth
                    } ${selectedYear}`,
                  })}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Payment Chips */}
          {activeReport === 'payment' && (
            <>
              <TouchableOpacity
                style={[styles.chip, selectedWorkerName ? styles.chipGreen : styles.chipWarning]}
                onPress={openFiltersModal}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="person-outline"
                  size={13}
                  color={selectedWorkerName ? '#0f8f64' : '#b7791f'}
                />
                <Text
                  style={[
                    styles.chipText,
                    selectedWorkerName ? styles.chipTextGreen : styles.chipTextWarning,
                  ]}
                >
                  {t('Staff: :name', { name: selectedWorkerName || t('Select') })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chip, styles.chipGreen]}
                onPress={openFiltersModal}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={13} color="#0f8f64" />
                <Text style={[styles.chipText, styles.chipTextGreen]}>
                  {t('Date: :range', { range: getSelectedRangeLabel(fromDate, toDate) })}
                </Text>
              </TouchableOpacity>

              {includeFamily && (
                <TouchableOpacity
                  style={[styles.chip, styles.chipGreen]}
                  onPress={openFiltersModal}
                  activeOpacity={0.7}
                >
                  <Ionicons name="people-outline" size={13} color="#0f8f64" />
                  <Text style={[styles.chipText, styles.chipTextGreen]}>
                    {t('Family: Included')}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Activity & Expense Chips */}
          {(activeReport === 'activity' || activeReport === 'expense') && (
            <>
              <TouchableOpacity
                style={[styles.chip, selectedFarmName ? styles.chipGreen : styles.chipWarning]}
                onPress={openFiltersModal}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="business-outline"
                  size={13}
                  color={selectedFarmName ? '#0f8f64' : '#b7791f'}
                />
                <Text
                  style={[
                    styles.chipText,
                    selectedFarmName ? styles.chipTextGreen : styles.chipTextWarning,
                  ]}
                >
                  {t('Farm: :name', { name: selectedFarmName || t('Select') })}
                </Text>
              </TouchableOpacity>

              {selectedCycleName && (
                <TouchableOpacity
                  style={[styles.chip, styles.chipGreen]}
                  onPress={openFiltersModal}
                  activeOpacity={0.7}
                >
                  <Ionicons name="leaf-outline" size={13} color="#0f8f64" />
                  <Text style={[styles.chipText, styles.chipTextGreen]}>
                    {t('Farm Cycle: :name', { name: selectedCycleName })}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.chip, styles.chipGreen]}
                onPress={openFiltersModal}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={13} color="#0f8f64" />
                <Text style={[styles.chipText, styles.chipTextGreen]}>
                  {t('Date: :range', { range: getSelectedRangeLabel(fromDate, toDate) })}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Reset All Chip when active filters exist */}
          {hasActiveFilters && (
            <TouchableOpacity
              style={[styles.chip, styles.chipReset]}
              onPress={resetFiltersToDefault}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={13} color="#a16207" />
              <Text style={[styles.chipText, styles.chipTextReset]}>{t('Reset All')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  };

  // Render Selected Entity Summary Card (matches PWA .farm-report-summary-card)
  const renderSummaryCard = () => {
    if (activeReport === 'attendance') {
      const titleVal = selectedWorkerName || selectedFarmName || t('All Farms');
      const metaVal = `${selectedWorkerName && selectedFarmName ? `${selectedFarmName} • ` : ''}${
        MONTHS.find((m) => m.value === selectedMonth)?.label
          ? t(MONTHS.find((m) => m.value === selectedMonth)!.label)
          : selectedMonth
      } ${selectedYear}`;

      return (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>
            {selectedWorkerName ? t('Selected Staff') : t('Selected Farm')}
          </Text>
          <Text style={styles.summaryValue}>{titleVal}</Text>
          <Text style={styles.summaryMeta}>{metaVal}</Text>
        </View>
      );
    }

    if (activeReport === 'payment' && selectedWorkerName) {
      return (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t('Selected Staff')}</Text>
          <Text style={styles.summaryValue}>{selectedWorkerName}</Text>
          <Text style={styles.summaryMeta}>
            {getSelectedRangeLabel(fromDate, toDate)}
            {includeFamily ? ` • ${t('Family: Included')}` : ''}
          </Text>
        </View>
      );
    }

    if ((activeReport === 'activity' || activeReport === 'expense') && selectedFarmName) {
      return (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t('Selected Farm')}</Text>
          <Text style={styles.summaryValue}>{selectedFarmName}</Text>
          <Text style={styles.summaryMeta}>
            {selectedCycleName || t('All Farm Cycles')} • {getSelectedRangeLabel(fromDate, toDate)}
          </Text>
        </View>
      );
    }

    return null;
  };

  // Reusable empty report card (matches PWA .farm-report-empty-card)
  const renderEmptyReport = (
    title: string,
    subtitle: string,
    iconName: keyof typeof Ionicons.glyphMap
  ) => (
    <View style={styles.emptyCard}>
      <View style={styles.emptyCardIcon}>
        <Ionicons name={iconName} size={32} color={colors.slate400} />
      </View>
      <Text style={styles.emptyCardTitle}>{title}</Text>
      <Text style={styles.emptyCardCopy}>{subtitle}</Text>
      <View style={styles.emptyCardActions}>
        <TouchableOpacity
          style={styles.emptyCardPrimaryBtn}
          onPress={openFiltersModal}
          activeOpacity={0.8}
        >
          <Ionicons name="funnel-outline" size={16} color={colors.white} />
          <Text style={styles.emptyCardPrimaryBtnText}>{t('Open Filters')}</Text>
        </TouchableOpacity>

        {hasActiveFilters && (
          <TouchableOpacity
            style={styles.emptyCardLinkBtn}
            onPress={resetFiltersToDefault}
            activeOpacity={0.7}
          >
            <Text style={styles.emptyCardLinkBtnText}>{t('Reset To Default View')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Bottom Sheet Filter Modal (matches PWA .farm-report-modal)
  const renderFilterModal = () => (
    <ModalSheet
      visible={showFilterModal}
      onClose={() => setShowFilterModal(false)}
      title={t('Filter Reports')}
      kicker={filterModalSubtitle}
      footer={
        <View style={styles.modalFooterRow}>
          <TouchableOpacity
            style={styles.modalSecondaryBtn}
            onPress={() => setShowFilterModal(false)}
            activeOpacity={0.7}
          >
            <Text style={styles.modalSecondaryBtnText}>{t('Cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalPrimaryBtn}
            onPress={handleApplyFilters}
            activeOpacity={0.8}
          >
            <Text style={styles.modalPrimaryBtnText}>{t('Apply Filters')}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View style={styles.modalBody}>
        {/* Attendance Filter Form */}
        {activeReport === 'attendance' && (
          <>
            <SearchableSelect
              label={t('Farm')}
              placeholder={t('All Farms')}
              searchPlaceholder={t('Search farms...')}
              allowClear
              clearLabel={t('All Farms')}
              items={
                filtersData?.farms.map((f) => ({
                  value: f.id.toString(),
                  label: f.name,
                  icon: 'business-outline',
                })) || []
              }
              value={draftFarm}
              onSelect={(val) => setDraftFarm((val as string) || '')}
              containerStyle={{ marginBottom: spacing.md }}
            />

            <SearchableSelect
              label={t('Staff')}
              placeholder={t('All Staff')}
              searchPlaceholder={t('Search staff...')}
              allowClear
              clearLabel={t('All Staff')}
              items={
                filtersData?.workers.map((w) => ({
                  value: w.ulid,
                  label: w.name,
                  icon: 'person-outline',
                })) || []
              }
              value={draftWorker}
              onSelect={(val) => setDraftWorker((val as string) || '')}
              containerStyle={{ marginBottom: spacing.md }}
            />

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionLabel}>{t('Month')}</Text>
              <QuickChipGroup
                options={MONTHS.map((m) => ({ label: t(m.label), value: m.value }))}
                selectedValue={draftMonth}
                onSelect={(val) => setDraftMonth(val as number)}
                scrollable
                size="sm"
              />
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionLabel}>{t('Year')}</Text>
              <QuickChipGroup
                options={years.map((y) => ({ label: y.toString(), value: y }))}
                selectedValue={draftYear}
                onSelect={(val) => setDraftYear(val as number)}
                scrollable
                size="sm"
              />
            </View>
          </>
        )}

        {/* Payment Filter Form */}
        {activeReport === 'payment' && (
          <>
            <SearchableSelect
              label={t('Staff') + ' *'}
              placeholder={t('Select Staff Member')}
              searchPlaceholder={t('Search staff members...')}
              items={
                filtersData?.workers.map((w) => ({
                  value: w.ulid,
                  label: w.name,
                  icon: 'person-outline',
                })) || []
              }
              value={draftWorker}
              onSelect={(val) => setDraftWorker((val as string) || '')}
              containerStyle={{ marginBottom: spacing.md }}
            />

            <View style={styles.familyToggleRow}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={styles.familyToggleTitle}>{t("Include family members' payments")}</Text>
                <Text style={styles.familyToggleSubtitle}>
                  {t('Aggregate payments for family members')}
                </Text>
              </View>
              <Switch
                value={draftIncludeFamily}
                onValueChange={setDraftIncludeFamily}
                trackColor={{ false: colors.slate200, true: colors.primarySurface }}
                thumbColor={draftIncludeFamily ? colors.primary : colors.slate400}
              />
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionLabel}>{t('Window Presets:')}</Text>
              <View style={styles.modalPresetRow}>
                <TouchableOpacity
                  style={styles.modalPresetChip}
                  onPress={() => applyDraftDatePreset('month')}
                >
                  <Text style={styles.modalPresetText}>{t('This Month')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalPresetChip}
                  onPress={() => applyDraftDatePreset('30days')}
                >
                  <Text style={styles.modalPresetText}>{t('Last 30 Days')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalPresetChip}
                  onPress={() => applyDraftDatePreset('quarter')}
                >
                  <Text style={styles.modalPresetText}>{t('Quarter')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.dateRowContainer}>
              <View style={{ flex: 1 }}>
                <ModernDatePicker
                  label={t('From Date')}
                  value={draftFromDate}
                  onChange={setDraftFromDate}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ModernDatePicker
                  label={t('To Date')}
                  value={draftToDate}
                  onChange={setDraftToDate}
                />
              </View>
            </View>
          </>
        )}

        {/* Activity & Expense Filter Form */}
        {(activeReport === 'activity' || activeReport === 'expense') && (
          <>
            <SearchableSelect
              label={t('Farm') + ' *'}
              placeholder={t('Select Farm')}
              searchPlaceholder={t('Search farms...')}
              items={
                filtersData?.farms.map((f) => ({
                  value: f.id.toString(),
                  label: f.name,
                  icon: 'business-outline',
                })) || []
              }
              value={draftFarm}
              onSelect={(val) => {
                const nextFarm = (val as string) || '';
                setDraftFarm(nextFarm);
                setDraftCycle('');
              }}
              containerStyle={{ marginBottom: spacing.md }}
            />

            {draftFarm ? (
              <SearchableSelect
                label={t('Farm Cycle')}
                placeholder={t('All Farm Cycles')}
                searchPlaceholder={t('Search farm cycles...')}
                allowClear
                clearLabel={t('All Farm Cycles')}
                items={
                  filtersData?.crop_cycles
                    .filter((c) => c.farm_id.toString() === draftFarm)
                    .map((c) => ({
                      value: c.id.toString(),
                      label: c.label,
                      icon: 'leaf-outline',
                    })) || []
                }
                value={draftCycle}
                onSelect={(val) => setDraftCycle((val as string) || '')}
                containerStyle={{ marginBottom: spacing.md }}
              />
            ) : null}

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionLabel}>{t('Window Presets:')}</Text>
              <View style={styles.modalPresetRow}>
                <TouchableOpacity
                  style={styles.modalPresetChip}
                  onPress={() => applyDraftDatePreset('month')}
                >
                  <Text style={styles.modalPresetText}>{t('This Month')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalPresetChip}
                  onPress={() => applyDraftDatePreset('30days')}
                >
                  <Text style={styles.modalPresetText}>{t('Last 30 Days')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalPresetChip}
                  onPress={() => applyDraftDatePreset('quarter')}
                >
                  <Text style={styles.modalPresetText}>{t('Quarter')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.dateRowContainer}>
              <View style={{ flex: 1 }}>
                <ModernDatePicker
                  label={t('From Date')}
                  value={draftFromDate}
                  onChange={setDraftFromDate}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ModernDatePicker
                  label={t('To Date')}
                  value={draftToDate}
                  onChange={setDraftToDate}
                />
              </View>
            </View>
          </>
        )}
      </View>
    </ModalSheet>
  );

  // Reusable export action bar rendered in each report screen
  const renderExportToolbar = () => (
    <View style={styles.exportToolbar}>
      <TouchableOpacity
        style={[styles.exportActionBtn, styles.exportPdfBtn]}
        onPress={() => handleExport('pdf')}
        disabled={exportLoading}
        activeOpacity={0.7}
      >
        {exportLoading && exportingFormat === 'pdf' ? (
          <ActivityIndicator size="small" color="#dc2626" />
        ) : (
          <>
            <Ionicons name="document-text" size={15} color="#dc2626" />
            <Text style={styles.exportPdfText}>{t('Export PDF')}</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.exportActionBtn, styles.exportExcelBtn]}
        onPress={() => handleExport('xlsx')}
        disabled={exportLoading}
        activeOpacity={0.7}
      >
        {exportLoading && exportingFormat === 'xlsx' ? (
          <ActivityIndicator size="small" color="#15803d" />
        ) : (
          <>
            <Ionicons name="grid" size={15} color="#15803d" />
            <Text style={styles.exportExcelText}>{t('Export Excel')}</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.exportActionBtn, styles.shareWhatsappBtn]}
        onPress={() => handleExport('pdf')}
        disabled={exportLoading}
        activeOpacity={0.7}
      >
        <Ionicons name="logo-whatsapp" size={15} color="#16a34a" />
        <Text style={styles.shareWhatsappText}>{t('WhatsApp')}</Text>
      </TouchableOpacity>
    </View>
  );

  // Render Sub-Views based on activeReport
  const renderContent = () => {
    if (loadingFilters) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('Loading analytics filters...')}</Text>
        </View>
      );
    }

    // Report Hub Dashboard Menu
    if (!activeReport) {
      return (
        <ScrollView contentContainerStyle={styles.menuContainer} showsVerticalScrollIndicator={false}>
          {/* Staff Reports */}
          <View style={styles.reportsSection}>
            <Text style={styles.sectionTitle}>{t('Staff Reports')}</Text>

            <TouchableOpacity
              style={[styles.reportCard, styles.isAttendance]}
              onPress={() => selectReport('attendance')}
              activeOpacity={0.7}
            >
              <View style={[styles.reportIconBox, { backgroundColor: '#ecfdf5' }]}>
                <Ionicons name="clipboard-outline" size={24} color="#059669" />
              </View>
              <View style={styles.reportContent}>
                <Text style={styles.reportTitle}>{t('Attendance Report')}</Text>
                <Text style={styles.reportDesc}>{t('Track daily staff presence, work hours, and availability.')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reportCard, styles.isPayment]}
              onPress={() => selectReport('payment')}
              activeOpacity={0.7}
            >
              <View style={[styles.reportIconBox, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="card-outline" size={24} color="#2563eb" />
              </View>
              <View style={styles.reportContent}>
                <Text style={styles.reportTitle}>{t('Payment Report')}</Text>
                <Text style={styles.reportDesc}>{t('View staff salary disbursements, advances, and settlements.')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          </View>

          <View style={styles.reportsSeparator} />

          {/* Farm Reports */}
          <View style={styles.reportsSection}>
            <Text style={styles.sectionTitle}>{t('Farm Reports')}</Text>

            <TouchableOpacity
              style={[styles.reportCard, styles.isActivity]}
              onPress={() => selectReport('activity')}
              activeOpacity={0.7}
            >
              <View style={[styles.reportIconBox, { backgroundColor: '#fff7ed' }]}>
                <Ionicons name="clipboard-outline" size={24} color="#ea580c" />
              </View>
              <View style={styles.reportContent}>
                <Text style={styles.reportTitle}>{t('Activities Report')}</Text>
                <Text style={styles.reportDesc}>{t('Review farm work logs by farm, cycle, and date range.')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reportCard, styles.isExpense]}
              onPress={() => selectReport('expense')}
              activeOpacity={0.7}
            >
              <View style={[styles.reportIconBox, { backgroundColor: '#fef2f2' }]}>
                <Ionicons name="cash-outline" size={24} color="#dc2626" />
              </View>
              <View style={styles.reportContent}>
                <Text style={styles.reportTitle}>{t('Expenses Report')}</Text>
                <Text style={styles.reportDesc}>{t('Track expense entries and spending by farm, cycle, and date range.')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          </View>

          {/* Coming Soon Card */}
          <View style={styles.soonCard}>
            <Text style={styles.soonTitle}>{t('More Reports Coming Soon')}</Text>
            <Text style={styles.soonCopy}>
              {t('We are adding more useful reports soon to help you track your farm operations better.')}
            </Text>
          </View>
        </ScrollView>
      );
    }

    // ----------------------------------------------------
    // ATTENDANCE REPORT VIEW
    // ----------------------------------------------------
    if (activeReport === 'attendance') {
      return (
        <View style={styles.reportContainer}>
          {reportLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>{t('Generating attendance report...')}</Text>
            </View>
          ) : !selectedFarm && !selectedWorker ? (
            renderEmptyReport(
              t('Select a Farm or Staff'),
              t('Choose a farm or worker from the filters above to generate the attendance summary.'),
              'clipboard-outline'
            )
          ) : (
            <FlatList
              data={attendanceData?.rows || []}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.reportListContent}
              ListHeaderComponent={
                <View style={{ marginBottom: spacing.md }}>
                  {renderSummaryCard()}
                  {attendanceData ? (
                    <>
                      <View style={styles.metricsGrid}>
                        <View style={styles.summaryTile}>
                          <MetricTile
                            label={t('PRESENT')}
                            value={attendanceData.summary.present}
                            iconName="check-circle"
                            iconColor={colors.successText}
                            iconBg={colors.successSurface}
                          />
                        </View>
                        <View style={styles.summaryTile}>
                          <MetricTile
                            label={t('HALF DAYS')}
                            value={attendanceData.summary.half_day}
                            iconName="circle-half-full"
                            iconColor={colors.warningText}
                            iconBg={colors.warningSurface}
                          />
                        </View>
                        <View style={styles.summaryTile}>
                          <MetricTile
                            label={t('TOTAL')}
                            value={attendanceData.summary.total_attendance}
                            iconName="calendar-check"
                            iconColor={colors.infoText}
                            iconBg={colors.infoSurface}
                          />
                        </View>
                      </View>
                      {renderExportToolbar()}
                    </>
                  ) : null}
                </View>
              }
              ListEmptyComponent={
                renderEmptyReport(
                  t('No reports found'),
                  t('No muster records found for this period. Try adjusting your month or farm filter.'),
                  'calendar-outline'
                )
              }
              renderItem={({ item }) => {
                const statusVariant =
                  item.status === 'PRESENT'
                    ? 'success'
                    : item.status === 'HALF_DAY'
                    ? 'warning'
                    : 'danger';

                const statusLabel =
                  item.status === 'PRESENT'
                    ? t('PRESENT')
                    : item.status === 'HALF_DAY'
                    ? t('HALF DAYS')
                    : t('ABSENT');

                return (
                  <BentoCard variant="elevated" style={styles.rowCard}>
                    <View style={styles.rowHeader}>
                      <View style={styles.dateRow}>
                        <Ionicons name="calendar-outline" size={13} color={colors.slate500} />
                        <Text style={styles.rowDate}>
                          {new Date(item.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                      <StatusBadge label={statusLabel} variant={statusVariant} dot />
                    </View>

                    <Text style={styles.rowTitle}>{item.staff_name}</Text>
                    <View style={styles.rowMetaPill}>
                      <Ionicons name="map-outline" size={12} color={colors.slate500} />
                      <Text style={styles.rowMetaText}>{item.farm_name}</Text>
                    </View>

                    {item.notes ? (
                      <View style={styles.notesBox}>
                        <Ionicons name="chatbubble-outline" size={12} color={colors.slate500} />
                        <Text style={styles.rowNotes}>{item.notes}</Text>
                      </View>
                    ) : null}
                  </BentoCard>
                );
              }}
            />
          )}
        </View>
      );
    }

    // ----------------------------------------------------
    // PAYMENT REPORT VIEW
    // ----------------------------------------------------
    if (activeReport === 'payment') {
      return (
        <View style={styles.reportContainer}>
          {reportLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>{t('Loading payment vouchers...')}</Text>
            </View>
          ) : !selectedWorker ? (
            renderEmptyReport(
              t('Select a Staff Member'),
              t('Choose a staff member above to audit salary advances, payments, and payouts.'),
              'cash-outline'
            )
          ) : (
            <FlatList
              data={paymentData?.rows || []}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.reportListContent}
              ListHeaderComponent={
                <View style={{ marginBottom: spacing.md }}>
                  {renderSummaryCard()}
                  {paymentData ? (
                    <>
                      <View style={styles.metricsGrid}>
                        <View style={{ flex: 1 }}>
                          <MetricTile
                            label={t('TOTAL SALARY PAID')}
                            value={formatCurrency(paymentData.summary.total_amount)}
                            iconName="cash-check"
                            iconColor={colors.successText}
                            iconBg={colors.successSurface}
                          />
                        </View>
                      </View>
                      {renderExportToolbar()}
                    </>
                  ) : null}
                </View>
              }
              ListEmptyComponent={
                renderEmptyReport(
                  t('No reports found'),
                  t('No payment records found for this period. Try adjusting your date range or staff filter.'),
                  'cash-outline'
                )
              }
              renderItem={({ item }) => (
                <BentoCard variant="elevated" style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <View style={styles.dateRow}>
                      <Ionicons name="calendar-outline" size={13} color={colors.slate500} />
                      <Text style={styles.rowDate}>
                        {new Date(item.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <Text style={styles.amountText}>{formatCurrency(item.amount)}</Text>
                  </View>

                  <View style={styles.paymentMetaRow}>
                    <StatusBadge
                      label={item.payment_method?.replace('_', ' ').toUpperCase() || 'CASH'}
                      variant="info"
                    />
                    <Text style={styles.disbursedText}>{t('Disbursed by:')} {item.given_by}</Text>
                  </View>

                  {item.notes ? (
                    <View style={styles.notesBox}>
                      <Ionicons name="chatbubble-outline" size={12} color={colors.slate500} />
                      <Text style={styles.rowNotes}>{item.notes}</Text>
                    </View>
                  ) : null}
                </BentoCard>
              )}
            />
          )}
        </View>
      );
    }

    // ----------------------------------------------------
    // ACTIVITIES REPORT VIEW
    // ----------------------------------------------------
    if (activeReport === 'activity') {
      return (
        <View style={styles.reportContainer}>
          {reportLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>{t('Fetching activity timeline...')}</Text>
            </View>
          ) : !selectedFarm ? (
            renderEmptyReport(
              t('Select a Farm'),
              t('Select a farm to audit agricultural tasks, operations, and status.'),
              'construct-outline'
            )
          ) : (
            <FlatList
              data={activityData?.rows || []}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.reportListContent}
              ListHeaderComponent={
                <View style={{ marginBottom: spacing.md }}>
                  {renderSummaryCard()}
                  {activityData ? (
                    <>
                      <View style={styles.metricsGrid}>
                        <View style={styles.summaryTile}>
                          <MetricTile
                            label={t('ACTIVITIES')}
                            value={activityData.summary.total}
                            iconName="clipboard-list-outline"
                            iconColor={colors.slate700}
                            iconBg={colors.slate100}
                          />
                        </View>
                        <View style={styles.summaryTile}>
                          <MetricTile
                            label={t('COMPLETED')}
                            value={activityData.summary.completed}
                            iconName="check-circle"
                            iconColor={colors.successText}
                            iconBg={colors.successSurface}
                          />
                        </View>
                        <View style={styles.summaryTile}>
                          <MetricTile
                            label={t('PENDING')}
                            value={activityData.summary.open}
                            iconName="clock-outline"
                            iconColor={colors.warningText}
                            iconBg={colors.warningSurface}
                          />
                        </View>
                      </View>
                      {renderExportToolbar()}
                    </>
                  ) : null}
                </View>
              }
              ListEmptyComponent={
                renderEmptyReport(
                  t('No reports found'),
                  t('No activity logs recorded for this selection. Try adjusting your date range or farm filter.'),
                  'clipboard-outline'
                )
              }
              renderItem={({ item }) => {
                const isCompleted = item.status === 'COMPLETED';
                const statusLabel = isCompleted ? t('COMPLETED') : t('PENDING');
                return (
                  <BentoCard variant="elevated" style={styles.rowCard}>
                    <View style={styles.rowHeader}>
                      <View style={styles.dateRow}>
                        <Ionicons name="calendar-outline" size={13} color={colors.slate500} />
                        <Text style={styles.rowDate}>
                          {new Date(item.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                      <StatusBadge
                        label={statusLabel}
                        variant={isCompleted ? 'success' : 'warning'}
                        dot
                      />
                    </View>

                    <Text style={styles.rowTitle}>{item.activity}</Text>
                    <View style={styles.rowMetaPill}>
                      <Ionicons name="leaf-outline" size={12} color={colors.purpleText} />
                      <Text style={[styles.rowMetaText, { color: colors.purpleText }]}>
                        {item.cycle}
                      </Text>
                    </View>

                    {item.notes ? (
                      <View style={styles.notesBox}>
                        <Ionicons name="chatbubble-outline" size={12} color={colors.slate500} />
                        <Text style={styles.rowNotes}>{item.notes}</Text>
                      </View>
                    ) : null}
                  </BentoCard>
                );
              }}
            />
          )}
        </View>
      );
    }

    // ----------------------------------------------------
    // EXPENSES REPORT VIEW
    // ----------------------------------------------------
    if (activeReport === 'expense') {
      return (
        <View style={styles.reportContainer}>
          {reportLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>{t('Compiling farm financial audit...')}</Text>
            </View>
          ) : !selectedFarm ? (
            renderEmptyReport(
              t('Select a Farm'),
              t('Select a farm and date window above to analyze spending and operational expenses.'),
              'receipt-outline'
            )
          ) : (
            <FlatList
              data={expenseData?.rows || []}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.reportListContent}
              ListHeaderComponent={
                <View style={{ marginBottom: spacing.md }}>
                  {renderSummaryCard()}
                  {expenseData ? (
                    <>
                      <View style={styles.metricsGrid}>
                        <View style={styles.summaryTile}>
                          <MetricTile
                            label={t('TOTAL SPEND')}
                            value={formatCurrency(expenseData.summary.total_spend)}
                            iconName="cash-multiple"
                            iconColor={colors.dangerText}
                            iconBg={colors.dangerSurface}
                          />
                        </View>
                        <View style={styles.summaryTile}>
                          <MetricTile
                            label={t('ENTRIES')}
                            value={expenseData.summary.entries_count}
                            iconName="receipt"
                            iconColor={colors.slate700}
                            iconBg={colors.slate100}
                          />
                        </View>
                        <View style={styles.summaryTile}>
                          <MetricTile
                            label={t('CLEARED')}
                            value={formatCurrency(expenseData.summary.completed_amount)}
                            iconName="check-decagram"
                            iconColor={colors.successText}
                            iconBg={colors.successSurface}
                          />
                        </View>
                      </View>
                      {renderExportToolbar()}
                    </>
                  ) : null}
                </View>
              }
              ListEmptyComponent={
                renderEmptyReport(
                  t('No reports found'),
                  t('No expense records found for this period. Try adjusting your date range or category filter.'),
                  'wallet-outline'
                )
              }
              renderItem={({ item }) => {
                const isCompleted = item.payment_status === 'COMPLETED';
                return (
                  <BentoCard variant="elevated" style={styles.rowCard}>
                    <View style={styles.rowHeader}>
                      <View style={styles.dateRow}>
                        <Ionicons name="calendar-outline" size={13} color={colors.slate500} />
                        <Text style={styles.rowDate}>
                          {new Date(item.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                      <Text style={styles.amountText}>{formatCurrency(item.amount)}</Text>
                    </View>

                    <Text style={styles.rowTitle}>{item.category}</Text>

                    <View style={styles.rowMetaRow}>
                      <StatusBadge
                        label={item.payment_status}
                        variant={isCompleted ? 'success' : 'danger'}
                        dot
                      />
                      <Text style={styles.methodLabel}>
                        {t('Via:')} {item.payment_method?.replace('_', ' ').toUpperCase() || 'CASH'}
                      </Text>
                    </View>

                    {item.notes ? (
                      <View style={styles.notesBox}>
                        <Ionicons name="chatbubble-outline" size={12} color={colors.slate500} />
                        <Text style={styles.rowNotes}>{item.notes}</Text>
                      </View>
                    ) : null}
                  </BentoCard>
                );
              }}
            />
          )}
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <View style={[styles.mainWrapper, { maxWidth: containerMaxWidth }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (activeReport) {
                selectReport(null);
              } else {
                router.back();
              }
            }}
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={20} color="#475569" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {activeReport === 'attendance'
              ? t('Attendance Report')
              : activeReport === 'payment'
              ? t('Payment Report')
              : activeReport === 'activity'
              ? t('Activities Report')
              : activeReport === 'expense'
              ? t('Expenses Report')
              : t('Reports')}
          </Text>
          {activeReport ? (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={openFiltersModal}
                accessibilityLabel={t('Filter Reports')}
              >
                <Ionicons name="funnel-outline" size={18} color="#166534" />
                {hasActiveFilters ? <View style={styles.activeDot} /> : null}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => setShowExportModal(true)}
                disabled={exportLoading}
                accessibilityLabel="Export options"
              >
                {exportLoading ? (
                  <ActivityIndicator size="small" color="#166534" />
                ) : (
                  <Ionicons name="share-outline" size={18} color="#166534" />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {activeReport ? renderActiveFilterChips() : null}
        {renderContent()}
      </View>

      {/* Filter Bottom Sheet Modal */}
      {renderFilterModal()}

      {/* Export Options Bottom Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowExportModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalDragIndicator} />
            <Text style={styles.modalTitle}>{t('Export & Share Report')}</Text>
            <Text style={styles.modalSubtitle}>
              {t('Download reports or share directly to WhatsApp and other apps.')}
            </Text>

            <TouchableOpacity
              style={styles.exportModalOption}
              onPress={() => handleExport('pdf')}
              activeOpacity={0.7}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="document-text" size={24} color="#dc2626" />
              </View>
              <View style={styles.modalOptionInfo}>
                <Text style={styles.modalOptionTitle}>{t('Export as PDF')}</Text>
                <Text style={styles.modalOptionDesc}>
                  {t('Formatted PDF report ready for printing, archiving, or sharing.')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportModalOption}
              onPress={() => handleExport('xlsx')}
              activeOpacity={0.7}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="grid" size={24} color="#15803d" />
              </View>
              <View style={styles.modalOptionInfo}>
                <Text style={styles.modalOptionTitle}>{t('Export as Excel (.xlsx)')}</Text>
                <Text style={styles.modalOptionDesc}>
                  {t('Structured spreadsheet data compatible with Excel and Google Sheets.')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportModalOption}
              onPress={() => handleExport('pdf')}
              activeOpacity={0.7}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="logo-whatsapp" size={24} color="#16a34a" />
              </View>
              <View style={styles.modalOptionInfo}>
                <Text style={styles.modalOptionTitle}>{t('Share on WhatsApp')}</Text>
                <Text style={styles.modalOptionDesc}>
                  {t('Instantly send PDF report summary to workers, partners, or accountant.')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowExportModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>{t('Cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  mainWrapper: {
    width: '100%',
    alignSelf: 'center',
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.slate500,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#166534',
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 38,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0f8f64',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  menuContainer: {
    padding: 16,
    paddingBottom: 60,
    gap: 16,
  },
  reportsSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#166534',
    paddingHorizontal: 2,
  },
  reportsSeparator: {
    height: 1,
    backgroundColor: '#cbd5e1',
    marginVertical: 4,
  },
  reportCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  isAttendance: {},
  isPayment: {},
  isActivity: {},
  isExpense: {},
  reportIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportContent: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  reportDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    fontWeight: '500',
    lineHeight: 16,
  },
  soonCard: {
    marginTop: 6,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  soonTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  soonCopy: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    color: '#64748b',
    textAlign: 'center',
  },
  reportContainer: {
    flex: 1,
  },
  // Active Filter Chips Card (matches PWA .farm-report-filter-card)
  filterCard: {
    backgroundColor: '#eef2f7',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(203, 213, 225, 0.7)',
    paddingVertical: 9,
  },
  chipsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  chipGreen: {
    backgroundColor: '#dff8ea',
  },
  chipWarning: {
    backgroundColor: '#fef3c7',
  },
  chipReset: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextGreen: {
    color: '#0f8f64',
  },
  chipTextWarning: {
    color: '#b7791f',
  },
  chipTextReset: {
    color: '#a16207',
  },

  // Summary Card (matches PWA .farm-report-summary-card)
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
    marginBottom: spacing.md,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#64748b',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  summaryMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },

  // Empty Report Card (matches PWA .farm-report-empty-card)
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginHorizontal: 16,
  },
  emptyCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyCardCopy: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyCardActions: {
    width: '100%',
    gap: 10,
    alignItems: 'center',
  },
  emptyCardPrimaryBtn: {
    width: '100%',
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#0f8f64',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyCardPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  emptyCardLinkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  emptyCardLinkBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f8f64',
  },

  // Filter Modal Body & Controls
  modalBody: {
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  modalSection: {
    marginBottom: spacing.xs,
  },
  modalSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.slate600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  modalPresetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalPresetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalPresetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  dateRowContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  familyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: spacing.xs,
  },
  familyToggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  familyToggleSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  modalFooterRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalSecondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  modalPrimaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#0f8f64',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },

  metricsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryTile: {
    flex: 1,
  },
  reportListContent: {
    padding: spacing.lg,
    paddingBottom: 90,
  },
  rowCard: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowDate: {
    ...typography.caption,
    color: colors.slate600,
  },
  amountText: {
    ...typography.title2,
    fontWeight: '800',
    color: colors.primary,
  },
  rowTitle: {
    ...typography.title3,
    color: colors.slate900,
  },
  rowMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  rowMetaText: {
    fontSize: 11,
    color: colors.slate600,
    fontWeight: '600',
  },
  paymentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  disbursedText: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.slate500,
  },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  methodLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.slate500,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.slate50,
    borderRadius: radius.xs,
    padding: spacing.xs,
    gap: 4,
    marginTop: 2,
  },
  rowNotes: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.slate600,
    flex: 1,
  },
  exportHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.xs,
  },
  exportActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    gap: 6,
    borderWidth: 1,
  },
  exportPdfBtn: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  exportPdfText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  exportExcelBtn: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  exportExcelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803d',
  },
  shareWhatsappBtn: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  shareWhatsappText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalDragIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: spacing.lg,
  },
  exportModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  modalOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionInfo: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  modalOptionDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  modalCancelBtn: {
    marginTop: spacing.sm,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
});
