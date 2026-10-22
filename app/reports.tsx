import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Alert,
  TextInput,
  Platform,
  StatusBar,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { reportsApi } from '../src/api/reports';
import {
  ReportFiltersData,
  AttendanceReportRow,
  PaymentReportRow,
  ActivityReportRow,
  ExpenseReportRow,
} from '../src/types';
import { extractErrorMessage } from '../src/api/client';
import { BentoCard, MetricTile, StatusBadge, QuickChipGroup } from '../src/components/ui';
import { colors, spacing, radius, typography, shadows } from '../src/theme/tokens';

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
  const [activeReport, setActiveReport] = useState<ReportType>(null);
  const [filtersData, setFiltersData] = useState<ReportFiltersData | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  // Filter States
  const [selectedFarm, setSelectedFarm] = useState<string>('');
  const [selectedWorker, setSelectedWorker] = useState<string>('');
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
        Alert.alert('Error', extractErrorMessage(error, 'Failed to load filters data.'));
      } finally {
        setLoadingFilters(false);
      }
    }
    loadFilters();
  }, []);

  // Clear selections when switching reports
  const selectReport = (type: ReportType) => {
    setActiveReport(type);
    setSelectedFarm('');
    setSelectedWorker('');
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
      Alert.alert('Error', extractErrorMessage(error, 'Failed to fetch attendance report.'));
    } finally {
      setReportLoading(false);
    }
  };

  // Run/Fetch Payment Report
  const fetchPaymentReport = async (
    workerVal = selectedWorker,
    fromVal = fromDate,
    toVal = toDate
  ) => {
    if (!workerVal) return;
    setReportLoading(true);
    try {
      const data = await reportsApi.getPaymentReport({
        farm_staff_id: workerVal,
        from_date: fromVal,
        to_date: toVal,
      });
      setPaymentData(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to fetch payment report.'));
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
      Alert.alert('Error', extractErrorMessage(error, 'Failed to fetch activity report.'));
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
      Alert.alert('Error', extractErrorMessage(error, 'Failed to fetch expense report.'));
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

  // Render Sub-Views based on activeReport
  const renderContent = () => {
    if (loadingFilters) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading analytics filters...</Text>
        </View>
      );
    }

    // Report Hub Dashboard Menu
    if (!activeReport) {
      return (
        <ScrollView contentContainerStyle={styles.menuContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.menuHeroCard}>
            <View style={styles.menuHeroKickerRow}>
              <Ionicons name="stats-chart" size={14} color={colors.primary} />
              <Text style={styles.menuHeroKicker}>FARM INTELLIGENCE DOCK</Text>
            </View>
            <Text style={styles.menuHeroTitle}>Operational Reports & Insights</Text>
            <Text style={styles.menuHeroSubtitle}>
              Export muster rolls, labor wages, farm activity timeline, and cost breakdown
            </Text>
          </View>

          <Text style={styles.sectionHeader}>Staff & Workforce</Text>

          <BentoCard
            variant="elevated"
            style={styles.reportMenuItem}
            onPress={() => selectReport('attendance')}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.successSurface }]}>
              <Ionicons name="clipboard-outline" size={24} color={colors.successText} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Staff Attendance Report</Text>
              <Text style={styles.cardDesc}>
                Track daily muster presence, half-day rates, and staff availability by farm & month.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
          </BentoCard>

          <BentoCard
            variant="elevated"
            style={styles.reportMenuItem}
            onPress={() => selectReport('payment')}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.infoSurface }]}>
              <Ionicons name="cash-outline" size={24} color={colors.infoText} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Wages & Payment Report</Text>
              <Text style={styles.cardDesc}>
                View salary disbursements, advance payments, settlements, and payment channels.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
          </BentoCard>

          <Text style={styles.sectionHeader}>Farm Production & Costs</Text>

          <BentoCard
            variant="elevated"
            style={styles.reportMenuItem}
            onPress={() => selectReport('activity')}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.accentSurface }]}>
              <Ionicons name="construct-outline" size={24} color={colors.accentDark} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Farm Activities Report</Text>
              <Text style={styles.cardDesc}>
                Audit agronomy work logs, crop cycle tasks, irrigation, and pesticide sprays.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
          </BentoCard>

          <BentoCard
            variant="elevated"
            style={styles.reportMenuItem}
            onPress={() => selectReport('expense')}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.purpleSurface }]}>
              <Ionicons name="receipt-outline" size={24} color={colors.purpleText} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Farm Expenses Report</Text>
              <Text style={styles.cardDesc}>
                Itemized spend breakdown by category, vendor, crop cycle, and date window.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
          </BentoCard>
        </ScrollView>
      );
    }

    // ----------------------------------------------------
    // ATTENDANCE REPORT VIEW
    // ----------------------------------------------------
    if (activeReport === 'attendance') {
      const farmOptions = [
        { label: 'All Farms', value: '' },
        ...(filtersData?.farms.map((f) => ({ label: f.name, value: f.id.toString() })) || []),
      ];

      const workerOptions = [
        { label: 'All Staff', value: '' },
        ...(filtersData?.workers.map((w) => ({ label: w.name, value: w.ulid })) || []),
      ];

      const monthOptions = MONTHS.map((m) => ({ label: m.label, value: m.value }));
      const yearOptions = years.map((y) => ({ label: y.toString(), value: y }));

      return (
        <View style={styles.reportContainer}>
          {/* Quick Filter Dock */}
          <View style={styles.filterDock}>
            <View style={styles.filterRow}>
              <Text style={styles.filterSectionLabel}>Farm:</Text>
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

            <View style={styles.filterRow}>
              <Text style={styles.filterSectionLabel}>Staff:</Text>
              <QuickChipGroup
                options={workerOptions}
                selectedValue={selectedWorker}
                onSelect={(val) => {
                  setSelectedWorker(val);
                  fetchAttendanceReport(selectedFarm, val, selectedMonth, selectedYear);
                }}
                scrollable
                size="sm"
              />
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterSectionLabel}>Month & Year:</Text>
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
              <Text style={styles.loadingText}>Generating attendance report...</Text>
            </View>
          ) : !selectedFarm && !selectedWorker ? (
            <View style={styles.emptyView}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="clipboard-outline" size={36} color={colors.slate400} />
              </View>
              <Text style={styles.emptyTitle}>Select a Farm or Staff</Text>
              <Text style={styles.emptySubtitle}>
                Choose a farm or worker from the filters above to generate the attendance summary.
              </Text>
            </View>
          ) : (
            <FlatList
              data={attendanceData?.rows || []}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.reportListContent}
              ListHeaderComponent={
                attendanceData ? (
                  <View style={styles.metricsGrid}>
                    <View style={styles.summaryTile}>
                      <MetricTile
                        label="PRESENT"
                        value={attendanceData.summary.present}
                        iconName="check-circle"
                        iconColor={colors.successText}
                        iconBg={colors.successSurface}
                      />
                    </View>
                    <View style={styles.summaryTile}>
                      <MetricTile
                        label="HALF DAYS"
                        value={attendanceData.summary.half_day}
                        iconName="circle-half-full"
                        iconColor={colors.warningText}
                        iconBg={colors.warningSurface}
                      />
                    </View>
                    <View style={styles.summaryTile}>
                      <MetricTile
                        label="TOTAL"
                        value={attendanceData.summary.total_attendance}
                        iconName="calendar-check"
                        iconColor={colors.infoText}
                        iconBg={colors.infoSurface}
                      />
                    </View>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyView}>
                  <Text style={styles.emptySubtitle}>No muster records found for this period.</Text>
                </View>
              }
              renderItem={({ item }) => {
                const statusVariant =
                  item.status === 'PRESENT'
                    ? 'success'
                    : item.status === 'HALF_DAY'
                    ? 'warning'
                    : 'danger';

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
                      <StatusBadge label={item.status} variant={statusVariant} dot />
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
            <View style={styles.filterRow}>
              <Text style={styles.filterSectionLabel}>Staff Member *:</Text>
              <QuickChipGroup
                options={workerOptions}
                selectedValue={selectedWorker}
                onSelect={(val) => {
                  setSelectedWorker(val);
                  fetchPaymentReport(val, fromDate, toDate);
                }}
                scrollable
                size="sm"
              />
            </View>

            {/* Date range presets */}
            <View style={styles.filterRow}>
              <Text style={styles.filterSectionLabel}>Window Presets:</Text>
              <View style={styles.datePresetsRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('month')}
                >
                  <Text style={styles.presetChipText}>This Month</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('30days')}
                >
                  <Text style={styles.presetChipText}>Last 30 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('quarter')}
                >
                  <Text style={styles.presetChipText}>Quarter</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.customDateRow}>
              <View style={{ flex: 1, marginRight: spacing.xs }}>
                <Text style={styles.dateFieldLabel}>From Date</Text>
                <TextInput
                  style={styles.dateInput}
                  value={fromDate}
                  onChangeText={(text) => {
                    setFromDate(text);
                    if (text.length === 10) fetchPaymentReport(selectedWorker, text, toDate);
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.slate400}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateFieldLabel}>To Date</Text>
                <TextInput
                  style={styles.dateInput}
                  value={toDate}
                  onChangeText={(text) => {
                    setToDate(text);
                    if (text.length === 10) fetchPaymentReport(selectedWorker, fromDate, text);
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.slate400}
                />
              </View>
            </View>
          </View>

          {reportLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading payment vouchers...</Text>
            </View>
          ) : !selectedWorker ? (
            <View style={styles.emptyView}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="cash-outline" size={36} color={colors.slate400} />
              </View>
              <Text style={styles.emptyTitle}>Select a Staff Member</Text>
              <Text style={styles.emptySubtitle}>
                Choose a staff member above to audit salary advances, payments, and payouts.
              </Text>
            </View>
          ) : (
            <FlatList
              data={paymentData?.rows || []}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.reportListContent}
              ListHeaderComponent={
                paymentData ? (
                  <View style={styles.metricsGrid}>
                    <View style={{ flex: 1 }}>
                      <MetricTile
                        label="TOTAL SALARY PAID"
                        value={formatCurrency(paymentData.summary.total_amount)}
                        iconName="cash-check"
                        iconColor={colors.successText}
                        iconBg={colors.successSurface}
                      />
                    </View>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyView}>
                  <Text style={styles.emptySubtitle}>No payment records found for this period.</Text>
                </View>
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
                    <Text style={styles.disbursedText}>Disbursed by: {item.given_by}</Text>
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
        { label: 'All Cycles', value: '' },
        ...(filtersData?.crop_cycles
          .filter((c) => c.farm_id.toString() === selectedFarm)
          .map((c) => ({ label: c.label, value: c.id.toString() })) || []),
      ];

      return (
        <View style={styles.reportContainer}>
          <View style={styles.filterDock}>
            <View style={styles.filterRow}>
              <Text style={styles.filterSectionLabel}>Farm *:</Text>
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
                <Text style={styles.filterSectionLabel}>Crop Cycle:</Text>
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
              <Text style={styles.filterSectionLabel}>Window Presets:</Text>
              <View style={styles.datePresetsRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('month')}
                >
                  <Text style={styles.presetChipText}>This Month</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('30days')}
                >
                  <Text style={styles.presetChipText}>Last 30 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('quarter')}
                >
                  <Text style={styles.presetChipText}>Quarter</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.customDateRow}>
              <View style={{ flex: 1, marginRight: spacing.xs }}>
                <Text style={styles.dateFieldLabel}>From Date</Text>
                <TextInput
                  style={styles.dateInput}
                  value={fromDate}
                  onChangeText={(text) => {
                    setFromDate(text);
                    if (text.length === 10)
                      fetchActivityReport(selectedFarm, selectedCycle, text, toDate);
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.slate400}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateFieldLabel}>To Date</Text>
                <TextInput
                  style={styles.dateInput}
                  value={toDate}
                  onChangeText={(text) => {
                    setToDate(text);
                    if (text.length === 10)
                      fetchActivityReport(selectedFarm, selectedCycle, fromDate, text);
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.slate400}
                />
              </View>
            </View>
          </View>

          {reportLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Fetching activity timeline...</Text>
            </View>
          ) : !selectedFarm ? (
            <View style={styles.emptyView}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="construct-outline" size={36} color={colors.slate400} />
              </View>
              <Text style={styles.emptyTitle}>Select a Farm</Text>
              <Text style={styles.emptySubtitle}>
                Select a farm to audit agricultural tasks, operations, and status.
              </Text>
            </View>
          ) : (
            <FlatList
              data={activityData?.rows || []}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.reportListContent}
              ListHeaderComponent={
                activityData ? (
                  <View style={styles.metricsGrid}>
                    <View style={styles.summaryTile}>
                      <MetricTile
                        label="ACTIVITIES"
                        value={activityData.summary.total}
                        iconName="clipboard-list-outline"
                        iconColor={colors.slate700}
                        iconBg={colors.slate100}
                      />
                    </View>
                    <View style={styles.summaryTile}>
                      <MetricTile
                        label="COMPLETED"
                        value={activityData.summary.completed}
                        iconName="check-circle"
                        iconColor={colors.successText}
                        iconBg={colors.successSurface}
                      />
                    </View>
                    <View style={styles.summaryTile}>
                      <MetricTile
                        label="PENDING"
                        value={activityData.summary.open}
                        iconName="clock-outline"
                        iconColor={colors.warningText}
                        iconBg={colors.warningSurface}
                      />
                    </View>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyView}>
                  <Text style={styles.emptySubtitle}>No activity logs recorded for this selection.</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isCompleted = item.status === 'COMPLETED';
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
                        label={item.status}
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
        { label: 'All Cycles', value: '' },
        ...(filtersData?.crop_cycles
          .filter((c) => c.farm_id.toString() === selectedFarm)
          .map((c) => ({ label: c.label, value: c.id.toString() })) || []),
      ];

      return (
        <View style={styles.reportContainer}>
          <View style={styles.filterDock}>
            <View style={styles.filterRow}>
              <Text style={styles.filterSectionLabel}>Farm *:</Text>
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
                <Text style={styles.filterSectionLabel}>Crop Cycle:</Text>
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
              <Text style={styles.filterSectionLabel}>Window Presets:</Text>
              <View style={styles.datePresetsRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('month')}
                >
                  <Text style={styles.presetChipText}>This Month</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('30days')}
                >
                  <Text style={styles.presetChipText}>Last 30 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyDatePreset('quarter')}
                >
                  <Text style={styles.presetChipText}>Quarter</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.customDateRow}>
              <View style={{ flex: 1, marginRight: spacing.xs }}>
                <Text style={styles.dateFieldLabel}>From Date</Text>
                <TextInput
                  style={styles.dateInput}
                  value={fromDate}
                  onChangeText={(text) => {
                    setFromDate(text);
                    if (text.length === 10)
                      fetchExpenseReport(selectedFarm, selectedCycle, text, toDate);
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.slate400}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateFieldLabel}>To Date</Text>
                <TextInput
                  style={styles.dateInput}
                  value={toDate}
                  onChangeText={(text) => {
                    setToDate(text);
                    if (text.length === 10)
                      fetchExpenseReport(selectedFarm, selectedCycle, fromDate, text);
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.slate400}
                />
              </View>
            </View>
          </View>

          {reportLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Compiling farm financial audit...</Text>
            </View>
          ) : !selectedFarm ? (
            <View style={styles.emptyView}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="receipt-outline" size={36} color={colors.slate400} />
              </View>
              <Text style={styles.emptyTitle}>Select a Farm</Text>
              <Text style={styles.emptySubtitle}>
                Select a farm and date window above to analyze spending and operational expenses.
              </Text>
            </View>
          ) : (
            <FlatList
              data={expenseData?.rows || []}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.reportListContent}
              ListHeaderComponent={
                expenseData ? (
                  <View style={styles.metricsGrid}>
                    <View style={styles.summaryTile}>
                      <MetricTile
                        label="TOTAL SPEND"
                        value={formatCurrency(expenseData.summary.total_spend)}
                        iconName="cash-multiple"
                        iconColor={colors.dangerText}
                        iconBg={colors.dangerSurface}
                      />
                    </View>
                    <View style={styles.summaryTile}>
                      <MetricTile
                        label="ENTRIES"
                        value={expenseData.summary.entries_count}
                        iconName="receipt"
                        iconColor={colors.slate700}
                        iconBg={colors.slate100}
                      />
                    </View>
                    <View style={styles.summaryTile}>
                      <MetricTile
                        label="CLEARED"
                        value={formatCurrency(expenseData.summary.completed_amount)}
                        iconName="check-decagram"
                        iconColor={colors.successText}
                        iconBg={colors.successSurface}
                      />
                    </View>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyView}>
                  <Text style={styles.emptySubtitle}>No expense records found for this period.</Text>
                </View>
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
                        Via: {item.payment_method?.replace('_', ' ').toUpperCase() || 'CASH'}
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

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
        >
          <Ionicons name="arrow-back-outline" size={22} color={colors.slate800} />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
          <Text style={styles.headerKicker}>ANALYTICS & EXPORTS</Text>
          <Text style={styles.headerTitle}>
            {activeReport
              ? `${activeReport.charAt(0).toUpperCase() + activeReport.slice(1)} Report`
              : 'Farm Reports & Intelligence'}
          </Text>
        </View>
      </View>

      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate50,
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
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 12,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    gap: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flex: 1,
  },
  headerKicker: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
  },
  headerTitle: {
    ...typography.title2,
    color: colors.slate900,
  },
  menuContainer: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  menuHeroCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  menuHeroKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  menuHeroKicker: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
  },
  menuHeroTitle: {
    ...typography.title1,
    color: colors.slate900,
  },
  menuHeroSubtitle: {
    ...typography.bodySmall,
    color: colors.slate500,
    marginTop: 4,
  },
  sectionHeader: {
    ...typography.caption,
    color: colors.slate700,
    fontWeight: '800',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    letterSpacing: 0.8,
  },
  reportMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    ...typography.title3,
    color: colors.slate900,
  },
  cardDesc: {
    ...typography.bodySmall,
    color: colors.slate500,
    marginTop: 2,
    lineHeight: 16,
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
});
