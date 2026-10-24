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
          {/* Staff Reports */}
          <View style={styles.reportsSection}>
            <Text style={styles.sectionTitle}>Staff Reports</Text>

            <TouchableOpacity
              style={[styles.reportCard, styles.isAttendance]}
              onPress={() => selectReport('attendance')}
              activeOpacity={0.7}
            >
              <View style={[styles.reportIconBox, { backgroundColor: '#ecfdf5' }]}>
                <Ionicons name="clipboard-outline" size={24} color="#059669" />
              </View>
              <View style={styles.reportContent}>
                <Text style={styles.reportTitle}>Attendance Report</Text>
                <Text style={styles.reportDesc}>Track daily staff presence, work hours, and availability.</Text>
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
                <Text style={styles.reportTitle}>Payment Report</Text>
                <Text style={styles.reportDesc}>View staff salary disbursements, advances, and settlements.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          </View>

          <View style={styles.reportsSeparator} />

          {/* Farm Reports */}
          <View style={styles.reportsSection}>
            <Text style={styles.sectionTitle}>Farm Reports</Text>

            <TouchableOpacity
              style={[styles.reportCard, styles.isActivity]}
              onPress={() => selectReport('activity')}
              activeOpacity={0.7}
            >
              <View style={[styles.reportIconBox, { backgroundColor: '#fff7ed' }]}>
                <Ionicons name="clipboard-outline" size={24} color="#ea580c" />
              </View>
              <View style={styles.reportContent}>
                <Text style={styles.reportTitle}>Activities Report</Text>
                <Text style={styles.reportDesc}>Review farm work logs by farm, cycle, and date range.</Text>
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
                <Text style={styles.reportTitle}>Expenses Report</Text>
                <Text style={styles.reportDesc}>Track expense entries and spending by farm, cycle, and date range.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          </View>

          {/* Coming Soon Card */}
          <View style={styles.soonCard}>
            <Text style={styles.soonTitle}>More Reports Coming Soon</Text>
            <Text style={styles.soonCopy}>
              We are adding more useful reports soon to help you track your farm operations better.
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
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color="#475569" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {activeReport
            ? `${activeReport.charAt(0).toUpperCase() + activeReport.slice(1)} Report`
            : 'Reports'}
        </Text>
        <View style={styles.headerSpacer} />
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 16,
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
});
