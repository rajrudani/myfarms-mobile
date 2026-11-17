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
import { router } from 'expo-router';
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
import { BentoCard, MetricTile, StatusBadge, QuickChipGroup, SearchableSelect, ModernDatePicker, EmptyState } from '../src/components/ui';
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
  const [activeReport, setActiveReport] = useState<ReportType>(null);
  const [filtersData, setFiltersData] = useState<ReportFiltersData | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  // Export States
  const [exportLoading, setExportLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ReportExportFormat | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Filter States
  const [selectedFarm, setSelectedFarm] = useState<string>('');
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [includeFamily, setIncludeFamily] = useState<boolean>(false);
  const [selectedCycle, setSelectedCycle] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Date range states (strings in YYYY-MM-DD format)
  const [fromDate, setFromDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);

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

  // Load Filters Data
  useEffect(() => {
    async function loadFilters() {
      try {
        const data = await reportsApi.getFilters();
        setFiltersData(data);
      } catch (error) {
        console.error('Error loading report filters:', error);
        Alert.alert(t('Error'), extractErrorMessage(error, t('Failed to load filters data.')));
      } finally {
        setLoadingFilters(false);
      }
    }
    loadFilters();
  }, [t]);

  // Clear selections when switching reports
  const selectReport = (type: ReportType) => {
    setActiveReport(type);
    setSelectedFarm('');
    setSelectedWorker('');
    setIncludeFamily(false);
    setSelectedCycle('');
    setAttendanceData(null);
    setPaymentData(null);
    setActivityData(null);
    setExpenseData(null);
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

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Quick Preset Helper for Dates
  const applyDatePreset = (preset: 'month' | '30days' | 'quarter') => {
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

    setFromDate(from);
    setToDate(to);

    if (activeReport === 'payment' && selectedWorker) {
      fetchPaymentReport(selectedWorker, from, to);
    } else if (activeReport === 'activity' && selectedFarm) {
      fetchActivityReport(selectedFarm, selectedCycle, from, to);
    } else if (activeReport === 'expense' && selectedFarm) {
      fetchExpenseReport(selectedFarm, selectedCycle, from, to);
    }
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
      const farmOptions = [
        { label: t('All Farms'), value: '' },
        ...(filtersData?.farms.map((f) => ({ label: f.name, value: f.id.toString() })) || []),
      ];

      const workerOptions = [
        { label: t('All Staff'), value: '' },
        ...(filtersData?.workers.map((w) => ({ label: w.name, value: w.ulid })) || []),
      ];

      const monthOptions = MONTHS.map((m) => ({ label: t(m.label), value: m.value }));
      const yearOptions = years.map((y) => ({ label: y.toString(), value: y }));

      return (
        <View style={styles.reportContainer}>
          {/* Quick Filter Dock */}
          <View style={styles.filterDock}>
            <View style={styles.filterRow}>
              <Text style={styles.filterSectionLabel}>{t('Farm')}:</Text>
              <QuickChipGroup
                options={farmOptions}
                selectedValue={selectedFarm}
                onSelect={(val) => {
                  setSelectedFarm(val);
                  fetchAttendanceReport(val, selectedWorker, selectedMonth, selectedYear);
                }}
                scrollable
                size="sm"
              />
            </View>

            <SearchableSelect
              label={t('Staff')}
              placeholder={t('All Staff')}
              searchPlaceholder={t('Search staff...')}
              allowClear
              clearLabel={t('All Staff')}
              items={filtersData?.workers.map((w) => ({ value: w.ulid, label: w.name, icon: 'person-outline' })) || []}
              value={selectedWorker}
              onSelect={(val) => {
                const nextWorker = (val as string) || '';
                setSelectedWorker(nextWorker);
                fetchAttendanceReport(selectedFarm, nextWorker, selectedMonth, selectedYear);
              }}
              containerStyle={{ marginBottom: spacing.xs }}
            />

            <View style={styles.filterRow}>
              <Text style={styles.filterSectionLabel}>{t('Month & Year')}:</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <QuickChipGroup
                  options={monthOptions}
                  selectedValue={selectedMonth}
                  onSelect={(val) => {
                    setSelectedMonth(val);
                    fetchAttendanceReport(selectedFarm, selectedWorker, val, selectedYear);
                  }}
                  scrollable
                  size="sm"
                />
                <QuickChipGroup
                  options={yearOptions}
                  selectedValue={selectedYear}
                  onSelect={(val) => {
                    setSelectedYear(val);
                    fetchAttendanceReport(selectedFarm, selectedWorker, selectedMonth, val);
                  }}
                  scrollable
                  size="sm"
                />
              </View>
            </View>
          </View>

          {/* Report Body */}
          {reportLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>{t('Generating attendance report...')}</Text>
            </View>
          ) : !selectedFarm && !selectedWorker ? (
            <View style={styles.emptyView}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="clipboard-outline" size={36} color={colors.slate400} />
              </View>
              <Text style={styles.emptyTitle}>{t('Select a Farm or Staff')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('Choose a farm or worker from the filters above to generate the attendance summary.')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={attendanceData?.rows || []}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.reportListContent}
              ListHeaderComponent={
                attendanceData ? (
                  <View style={{ marginBottom: spacing.md }}>
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
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <EmptyState
                  compact
                  icon="calendar-outline"
                  title={t('No Attendance Records')}
                  message={t('No muster records found for this period. Try adjusting your month or farm filter.')}
                />
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
      const workerOptions =
        filtersData?.workers.map((w) => ({ label: w.name, value: w.ulid })) || [];

      return (
        <View style={styles.reportContainer}>
          <View style={styles.filterDock}>
            <SearchableSelect
              label={t('Staff') + ' *'}
              placeholder={t('Select Staff Member')}
              searchPlaceholder={t('Search staff members...')}
              items={workerOptions.map((w) => ({ value: w.value, label: w.label, icon: 'person-outline' }))}
              value={selectedWorker}
              onSelect={(val) => {
                const nextWorker = val as string;
                setSelectedWorker(nextWorker);
                fetchPaymentReport(nextWorker, fromDate, toDate, includeFamily);
              }}
              containerStyle={{ marginBottom: spacing.xs }}
            />

            {/* Include Family Members Toggle */}
            <View style={[styles.filterRow, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={styles.filterSectionLabel}>{t("Include family members' payments")}</Text>
                <Text style={{ fontSize: 11, color: colors.slate500 }}>
                  {t('Aggregate payments for family members')}
                </Text>
              </View>
              <Switch
                value={includeFamily}
                onValueChange={(val) => {
                  setIncludeFamily(val);
                  if (selectedWorker) {
                    fetchPaymentReport(selectedWorker, fromDate, toDate, val);
                  }
                }}
                trackColor={{ false: colors.slate200, true: colors.primarySurface }}
                thumbColor={includeFamily ? colors.primary : colors.slate400}
              />
            </View>

            {/* Date range presets */}
            <View style={styles.filterRow}>
              <Text style={styles.filterSectionLabel}>{t('Window Presets:')}</Text>
              <View style={styles.datePresetsRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('month')}
                >
                  <Text style={styles.presetChipText}>{t('This Month')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('30days')}
                >
                  <Text style={styles.presetChipText}>{t('Last 30 Days')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('quarter')}
                >
                  <Text style={styles.presetChipText}>{t('Quarter')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <ModernDatePicker
                  label={t('From Date')}
                  value={fromDate}
                  onChange={(d) => {
                    setFromDate(d);
                    fetchPaymentReport(selectedWorker, d, toDate, includeFamily);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ModernDatePicker
                  label={t('To Date')}
                  value={toDate}
                  onChange={(d) => {
                    setToDate(d);
                    fetchPaymentReport(selectedWorker, fromDate, d, includeFamily);
                  }}
                />
              </View>
            </View>
          </View>

          {reportLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>{t('Loading payment vouchers...')}</Text>
            </View>
          ) : !selectedWorker ? (
            <View style={styles.emptyView}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="cash-outline" size={36} color={colors.slate400} />
              </View>
              <Text style={styles.emptyTitle}>{t('Select a Staff Member')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('Choose a staff member above to audit salary advances, payments, and payouts.')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={paymentData?.rows || []}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.reportListContent}
              ListHeaderComponent={
                paymentData ? (
                  <View style={{ marginBottom: spacing.md }}>
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
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <EmptyState
                  compact
                  icon="cash-outline"
                  title={t('No Payment Records')}
                  message={t('No payment records found for this period. Try adjusting your date range or staff filter.')}
                />
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
      const farmOptions =
        filtersData?.farms.map((f) => ({ label: f.name, value: f.id.toString() })) || [];

      const cycleOptions = [
        { label: t('All Cycles'), value: '' },
        ...(filtersData?.crop_cycles
          .filter((c) => c.farm_id.toString() === selectedFarm)
          .map((c) => ({ label: c.label, value: c.id.toString() })) || []),
      ];

      return (
        <View style={styles.reportContainer}>
          <View style={styles.filterDock}>
            <View style={styles.filterRow}>
              <Text style={styles.filterSectionLabel}>{t('Farm')} *:</Text>
              <QuickChipGroup
                options={farmOptions}
                selectedValue={selectedFarm}
                onSelect={(val) => {
                  setSelectedFarm(val);
                  setSelectedCycle('');
                  fetchActivityReport(val, '', fromDate, toDate);
                }}
                scrollable
                size="sm"
              />
            </View>

            {selectedFarm ? (
              <View style={styles.filterRow}>
                <Text style={styles.filterSectionLabel}>{t('Crop Cycle')}:</Text>
                <QuickChipGroup
                  options={cycleOptions}
                  selectedValue={selectedCycle}
                  onSelect={(val) => {
                    setSelectedCycle(val);
                    fetchActivityReport(selectedFarm, val, fromDate, toDate);
                  }}
                  scrollable
                  size="sm"
                />
              </View>
            ) : null}

            {/* Presets */}
            <View style={styles.filterRow}>
              <Text style={styles.filterSectionLabel}>{t('Window Presets:')}</Text>
              <View style={styles.datePresetsRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('month')}
                >
                  <Text style={styles.presetChipText}>{t('This Month')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('30days')}
                >
                  <Text style={styles.presetChipText}>{t('Last 30 Days')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('quarter')}
                >
                  <Text style={styles.presetChipText}>{t('Quarter')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <ModernDatePicker
                  label={t('From Date')}
                  value={fromDate}
                  onChange={(d) => {
                    setFromDate(d);
                    fetchActivityReport(selectedFarm, selectedCycle, d, toDate);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ModernDatePicker
                  label={t('To Date')}
                  value={toDate}
                  onChange={(d) => {
                    setToDate(d);
                    fetchActivityReport(selectedFarm, selectedCycle, fromDate, d);
                  }}
                />
              </View>
            </View>
          </View>

          {reportLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>{t('Fetching activity timeline...')}</Text>
            </View>
          ) : !selectedFarm ? (
            <View style={styles.emptyView}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="construct-outline" size={36} color={colors.slate400} />
              </View>
              <Text style={styles.emptyTitle}>{t('Select a Farm')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('Select a farm to audit agricultural tasks, operations, and status.')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={activityData?.rows || []}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.reportListContent}
              ListHeaderComponent={
                activityData ? (
                  <View style={{ marginBottom: spacing.md }}>
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
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <EmptyState
                  compact
                  icon="clipboard-outline"
                  title={t('No Activity Logs')}
                  message={t('No activity logs recorded for this selection. Try adjusting your date range or farm filter.')}
                />
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
      const farmOptions =
        filtersData?.farms.map((f) => ({ label: f.name, value: f.id.toString() })) || [];

      const cycleOptions = [
        { label: t('All Cycles'), value: '' },
        ...(filtersData?.crop_cycles
          .filter((c) => c.farm_id.toString() === selectedFarm)
          .map((c) => ({ label: c.label, value: c.id.toString() })) || []),
      ];

      return (
        <View style={styles.reportContainer}>
          <View style={styles.filterDock}>
            <View style={styles.filterRow}>
              <Text style={styles.filterSectionLabel}>{t('Farm')} *:</Text>
              <QuickChipGroup
                options={farmOptions}
                selectedValue={selectedFarm}
                onSelect={(val) => {
                  setSelectedFarm(val);
                  setSelectedCycle('');
                  fetchExpenseReport(val, '', fromDate, toDate);
                }}
                scrollable
                size="sm"
              />
            </View>

            {selectedFarm ? (
              <View style={styles.filterRow}>
                <Text style={styles.filterSectionLabel}>{t('Crop Cycle')}:</Text>
                <QuickChipGroup
                  options={cycleOptions}
                  selectedValue={selectedCycle}
                  onSelect={(val) => {
                    setSelectedCycle(val);
                    fetchExpenseReport(selectedFarm, val, fromDate, toDate);
                  }}
                  scrollable
                  size="sm"
                />
              </View>
            ) : null}

            {/* Presets */}
            <View style={styles.filterRow}>
              <Text style={styles.filterSectionLabel}>{t('Window Presets:')}</Text>
              <View style={styles.datePresetsRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('month')}
                >
                  <Text style={styles.presetChipText}>{t('This Month')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('30days')}
                >
                  <Text style={styles.presetChipText}>{t('Last 30 Days')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('quarter')}
                >
                  <Text style={styles.presetChipText}>{t('Quarter')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <ModernDatePicker
                  label={t('From Date')}
                  value={fromDate}
                  onChange={(d) => {
                    setFromDate(d);
                    fetchExpenseReport(selectedFarm, selectedCycle, d, toDate);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ModernDatePicker
                  label={t('To Date')}
                  value={toDate}
                  onChange={(d) => {
                    setToDate(d);
                    fetchExpenseReport(selectedFarm, selectedCycle, fromDate, d);
                  }}
                />
              </View>
            </View>
          </View>

          {reportLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>{t('Compiling farm financial audit...')}</Text>
            </View>
          ) : !selectedFarm ? (
            <View style={styles.emptyView}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="receipt-outline" size={36} color={colors.slate400} />
              </View>
              <Text style={styles.emptyTitle}>{t('Select a Farm')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('Select a farm and date window above to analyze spending and operational expenses.')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={expenseData?.rows || []}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.reportListContent}
              ListHeaderComponent={
                expenseData ? (
                  <View style={{ marginBottom: spacing.md }}>
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
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <EmptyState
                  compact
                  icon="wallet-outline"
                  title={t('No Expense Records')}
                  message={t('No expense records found for this period. Try adjusting your date range or category filter.')}
                />
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
            <TouchableOpacity
              style={styles.exportHeaderBtn}
              onPress={() => setShowExportModal(true)}
              disabled={exportLoading}
              accessibilityLabel="Export options"
            >
              {exportLoading ? (
                <ActivityIndicator size="small" color="#166534" />
              ) : (
                <Ionicons name="share-outline" size={20} color="#166534" />
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {renderContent()}
      </View>

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
  filterDock: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterRow: {
    gap: 4,
  },
  filterSectionLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.slate500,
    fontWeight: '800',
  },
  datePresetsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  presetChip: {
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.slate200,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate700,
  },
  customDateRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  dateFieldLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.slate500,
    marginBottom: 2,
  },
  dateInput: {
    height: 38,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    fontSize: 13,
    color: colors.slate900,
    backgroundColor: colors.slate50,
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
  emptyView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.title2,
    color: colors.slate800,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.slate500,
    textAlign: 'center',
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
