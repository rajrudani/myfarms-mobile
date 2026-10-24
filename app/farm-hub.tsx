import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  FlatList,
  Image,
  Switch,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { farmsApi } from '../src/api/farms';
import { cropCyclesApi } from '../src/api/cropCycles';
import { expensesApi } from '../src/api/expenses';
import { mastersApi } from '../src/api/masters';
import { Farm, CropCycle, FarmExpense, Crop, FarmActivityMaster, FarmActivity, AgroInputProduct } from '../src/types';
import { useAuth } from '../src/hooks/useAuth';
import { getBaseUrl, extractErrorMessage } from '../src/api/client';
import { farmActivitiesApi } from '../src/api/farmActivities';

const getNormalizedOptions = (options: any): { key: string; label: string }[] => {
  if (!options) return [];
  if (Array.isArray(options)) {
    return options.map(val => ({
      key: val.toString(),
      label: val.charAt(0).toUpperCase() + val.slice(1).toLowerCase(),
    }));
  }
  if (typeof options === 'object') {
    return Object.keys(options).map(key => ({
      key: key,
      label: options[key],
    }));
  }
  return [];
};

const findFallbackMaster = (selectedName: string) => {
  if (!selectedName) return undefined;
  const normalized = selectedName.trim().toLowerCase();
  
  const nameMappings = [
    { key: 'f1', names: ['pesticide application', 'જંતુનાશક છંટકાવ', 'कीटनाशक छिड़काव'] },
    { key: 'f2', names: ['fertilizer application', 'ખાતર ઉપયોગ', 'उर्वरक अनुप्रयोग'] },
    { key: 'f3', names: ['harvesting/picking', 'કાપણી/તોડણી', 'कटाई/तोड़ाई'] },
    { key: 'f4', names: ['irrigation', 'સિંચાઈ', 'सिंचाई'] },
    { key: 'f5', names: ['sowing/planting', 'વાવેતર/રોપણ', 'बुवाई/रोपाई'] },
    { key: 'f6', names: ['other', 'અન્ય', 'अन्य'] }
  ];

  const matched = nameMappings.find(m => m.names.includes(normalized));
  if (matched) {
    return fallbackActivityMasters.find(f => f.id === matched.key);
  }
  return undefined;
};

const fallbackActivityMasters: FarmActivityMaster[] = [
  {
    id: 'f1',
    ulid: 'f1',
    name: 'Pesticide Application',
    is_active: true,
    fields: [
      { key: 'product_id', label: 'Pesticide', type: 'morph', required: true, morph: 'agro_input_products' },
      { key: 'quantity', label: 'Quantity', type: 'number', required: true, min: 0 },
      { key: 'quantity_unit', label: 'Unit', type: 'enum', required: true, options: { 'LITRE': 'Litre', 'ML': 'ML', 'KG': 'KG', 'GRAM': 'Gram' } }
    ]
  },
  {
    id: 'f2',
    ulid: 'f2',
    name: 'Fertilizer Application',
    is_active: true,
    fields: [
      { key: 'product_id', label: 'Fertilizer', type: 'morph', required: true, morph: 'agro_input_products' },
      { key: 'quantity', label: 'Quantity', type: 'number', required: true, min: 0 },
      { key: 'quantity_unit', label: 'Unit', type: 'enum', required: true, options: { 'KG': 'KG', 'GRAM': 'Gram', 'BAGS': 'Bags' } }
    ]
  },
  {
    id: 'f3',
    ulid: 'f3',
    name: 'Harvesting/Picking',
    is_active: true,
    fields: [
      { key: 'quantity', label: 'Quantity', type: 'number', required: true, min: 0 },
      { key: 'quantity_unit', label: 'Unit', type: 'enum', required: true, options: { 'KG': 'KG', 'TONS': 'Tons', 'BAGS': 'Bags', 'QUINTAL': 'Quintal' } }
    ]
  },
  {
    id: 'f4',
    ulid: 'f4',
    name: 'Irrigation',
    is_active: true,
    fields: [
      { key: 'duration_hours', label: 'Duration (Hours)', type: 'decimal', required: false, min: 0 }
    ]
  },
  {
    id: 'f5',
    ulid: 'f5',
    name: 'Sowing/Planting',
    is_active: true,
    fields: [
      { key: 'quantity', label: 'Quantity', type: 'number', required: true, min: 0 },
      { key: 'quantity_unit', label: 'Unit', type: 'enum', required: true, options: { 'KG': 'KG', 'GRAM': 'Gram', 'SEEDLINGS': 'Seedlings' } }
    ]
  },
  {
    id: 'f6',
    ulid: 'f6',
    name: 'Other',
    is_active: true,
    fields: [
      { key: 'task_name', label: 'Task', type: 'string', required: true },
      { key: 'labor_count', label: 'Labor Count', type: 'number', required: false, min: 0 },
      { key: 'duration_hours', label: 'Duration (Hours)', type: 'number', required: false, min: 0 }
    ]
  }
];

const getAbsoluteImageUrl = (urlPath?: string | null) => {
  if (!urlPath) return undefined;
  if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) {
    return urlPath;
  }
  const apiBase = getBaseUrl().replace('/api', '');
  return `${apiBase}${urlPath}`;
};

interface CalendarModalProps {
  visible: boolean;
  value: string; // YYYY-MM-DD
  onClose: () => void;
  onSelect: (dateStr: string) => void;
  title: string;
}

function CalendarOverlay({ visible, value, onClose, onSelect, title }: CalendarModalProps) {
  if (!visible) return null;

  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const parseDate = (str: string) => {
    if (!str) return new Date();
    const parts = str.split('-');
    if (parts.length !== 3) return new Date();
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    const d = parseInt(parts[2]);
    return new Date(y, m, d);
  };

  const [displayDate, setDisplayDate] = useState(() => parseDate(value));

  // Sync state when value changes or calendar becomes visible
  useEffect(() => {
    if (visible) {
      setDisplayDate(parseDate(value));
      setShowMonthPicker(false);
      setShowYearPicker(false);
    }
  }, [visible, value]);

  const monthNames = [
    '1. Jan', '2. Feb', '3. Mar', '4. Apr', '5. May', '6. Jun',
    '7. Jul', '8. Aug', '9. Sep', '10. Oct', '11. Nov', '12. Dec'
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();

  const handlePrevMonth = () => {
    setDisplayDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setDisplayDate(new Date(year, month + 1, 1));
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);

  const daysArray = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push({ day: 0, key: `prev-${i}`, isCurrent: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push({ day: d, key: `day-${d}`, isCurrent: true });
  }

  const handleSelectDay = (day: number) => {
    const mm = (month + 1).toString().padStart(2, '0');
    const dd = day.toString().padStart(2, '0');
    onSelect(`${year}-${mm}-${dd}`);
  };

  const isDaySelected = (day: number) => {
    if (!value) return false;
    const parts = value.split('-');
    if (parts.length !== 3) return false;
    return parseInt(parts[0]) === year && parseInt(parts[1]) === (month + 1) && parseInt(parts[2]) === day;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  const gridRows = [];
  let row = [];
  for (let i = 0; i < daysArray.length; i++) {
    row.push(daysArray[i]);
    if (row.length === 7 || i === daysArray.length - 1) {
      gridRows.push(row);
      row = [];
    }
  }

  return (
    <View style={styles.sheetOverlayContent}>
      <View style={{ flex: 1 }}>
        <View style={styles.calendarHeader}>
          <Text style={styles.calendarTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.calendarCloseBtn}>
            <Ionicons name="close" size={20} color="#475569" />
          </TouchableOpacity>
        </View>

        <View style={styles.monthNav}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn} disabled={showMonthPicker || showYearPicker}>
            <Ionicons name="chevron-back" size={20} color={showMonthPicker || showYearPicker ? "#cbd5e1" : "#16a34a"} />
          </TouchableOpacity>
          
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
            <TouchableOpacity 
              onPress={() => { setShowMonthPicker(!showMonthPicker); setShowYearPicker(false); }} 
              style={[styles.headerDropdown, showMonthPicker && styles.headerDropdownActive]}
            >
              <Text style={styles.monthText}>{monthNames[month]}</Text>
              <Ionicons name={showMonthPicker ? "chevron-up" : "chevron-down"} size={14} color="#14532d" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => { setShowYearPicker(!showYearPicker); setShowMonthPicker(false); }} 
              style={[styles.headerDropdown, showYearPicker && styles.headerDropdownActive]}
            >
              <Text style={styles.monthText}>{year}</Text>
              <Ionicons name={showYearPicker ? "chevron-up" : "chevron-down"} size={14} color="#14532d" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn} disabled={showMonthPicker || showYearPicker}>
            <Ionicons name="chevron-forward" size={20} color={showMonthPicker || showYearPicker ? "#cbd5e1" : "#16a34a"} />
          </TouchableOpacity>
        </View>

        {/* Month Selection List Overlay */}
        {showMonthPicker && (
          <ScrollView style={styles.pickerOverlayList} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
            <View style={styles.pickerGrid}>
              {monthNames.map((mName, index) => {
                const isSelected = index === month;
                return (
                  <TouchableOpacity
                    key={mName}
                    style={[styles.pickerGridItem, isSelected && styles.pickerGridItemActive]}
                    onPress={() => {
                      setDisplayDate(new Date(year, index, 1));
                      setShowMonthPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerGridItemText, isSelected && styles.pickerGridItemTextActive]}>
                      {mName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Year Selection List Overlay */}
        {showYearPicker && (
          <ScrollView style={styles.pickerOverlayList} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
            <View style={styles.pickerGrid}>
              {Array.from({ length: 16 }).map((_, i) => {
                const yr = 2025 + i; // starts from 2025 up to 2040
                const isSelected = yr === year;
                return (
                  <TouchableOpacity
                    key={yr}
                    style={[styles.pickerGridItem, isSelected && styles.pickerGridItemActive]}
                    onPress={() => {
                      setDisplayDate(new Date(yr, month, 1));
                      setShowYearPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerGridItemText, isSelected && styles.pickerGridItemTextActive]}>
                      {yr}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Standard Weekdays Header and Days Grid */}
        {!showMonthPicker && !showYearPicker && (
          <>
            <View style={styles.weekdaysRow}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, idx) => (
                <Text key={idx} style={styles.weekdayLabel}>{day}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {gridRows.map((r, rowIdx) => (
                <View key={rowIdx} style={styles.gridRow}>
                  {r.map((dItem) => {
                    if (!dItem.isCurrent) {
                      return <View key={dItem.key} style={styles.emptyDayCell} />;
                    }
                    const selected = isDaySelected(dItem.day);
                    const today = isToday(dItem.day);
                    return (
                      <TouchableOpacity
                        key={dItem.key}
                        style={[
                          styles.dayCell, 
                          selected && styles.dayCellSelected,
                          !selected && today && styles.dayCellToday
                        ]}
                        onPress={() => handleSelectDay(dItem.day)}
                        activeOpacity={0.6}
                      >
                        <Text style={[
                          styles.dayCellText, 
                          selected && styles.dayCellTextSelected,
                          !selected && today && styles.dayCellTextToday
                        ]}>
                          {dItem.day}
                        </Text>
                        {today && !selected && (
                          <View style={styles.todayDot} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  {r.length < 7 && Array.from({ length: 7 - r.length }).map((_, padIdx) => (
                    <View key={`pad-${padIdx}`} style={styles.emptyDayCell} />
                  ))}
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

export default function FarmHubScreen() {
  const { farm_id, farm_ulid } = useLocalSearchParams();
  const farmIdentifier = (farm_ulid as string) || (farm_id as string);

  const [farm, setFarm] = useState<Farm | null>(null);
  const [cycles, setCycles] = useState<CropCycle[]>([]);
  const [expenses, setExpenses] = useState<FarmExpense[]>([]);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'cycles' | 'activities' | 'expenses'>('cycles');

  // Add Crop Cycle Modal State
  const [cycleModalVisible, setCycleModalVisible] = useState(false);
  const [cropType, setCropType] = useState('');
  const [allocatedArea, setAllocatedArea] = useState('');
  const [allocatedAreaUnit, setAllocatedAreaUnit] = useState('ACRE');
  const [seasonName, setSeasonName] = useState('');
  const [startedOn, setStartedOn] = useState(new Date().toISOString().split('T')[0]);
  const [expectedHarvestOn, setExpectedHarvestOn] = useState('');
  const [notes, setNotes] = useState('');
  const [savingCycle, setSavingCycle] = useState(false);

  // PWA fields and states
  const [crops, setCrops] = useState<Crop[]>([]);
  const [selectedCropId, setSelectedCropId] = useState('');
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [cropSearchQuery, setCropSearchQuery] = useState('');
  const [cropError, setCropError] = useState('');
  const [areaError, setAreaError] = useState('');
  const [startedOnError, setStartedOnError] = useState('');
  const [seasonNameError, setSeasonNameError] = useState('');

  // Add Expense Modal State
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseErrors, setExpenseErrors] = useState<Record<string, string>>({});

  // Calendar states
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<string>('start');
  const [calendarTitle, setCalendarTitle] = useState('Select Date');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState('completed');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [savingExpense, setSavingExpense] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showCycleDropdown, setShowCycleDropdown] = useState(false);

  // Add Activity Modal State
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [activityMastersList, setActivityMastersList] = useState<FarmActivityMaster[]>([]);
  const [selectedActivityMasterId, setSelectedActivityMasterId] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [activityNotes, setActivityNotes] = useState('');
  const [selectedActivityCycleId, setSelectedActivityCycleId] = useState<string>('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [showActivityMasterDropdown, setShowActivityMasterDropdown] = useState(false);
  const [activityCycleModalVisible, setActivityCycleModalVisible] = useState(false);
  const [activityCycleSearchQuery, setActivityCycleSearchQuery] = useState('');
  const [activityMasterError, setActivityMasterError] = useState('');
  const [activityMasterModalVisible, setActivityMasterModalVisible] = useState(false);
  const [activityMasterSearchQuery, setActivityMasterSearchQuery] = useState('');

  // Dynamic fields states
  const [inputProductsList, setInputProductsList] = useState<AgroInputProduct[]>([]);
  const [activityFieldsValues, setActivityFieldsValues] = useState<Record<string, any>>({});
  const [activityErrors, setActivityErrors] = useState<Record<string, string>>({});
  const [showFieldDropdowns, setShowFieldDropdowns] = useState<Record<string, boolean>>({});
  const [customProductNames, setCustomProductNames] = useState<Record<string, string>>({});
  const [expenseOpenedFromCard, setExpenseOpenedFromCard] = useState(false);
  const [expenseCategoryModalVisible, setExpenseCategoryModalVisible] = useState(false);
  const [expenseCategorySearchQuery, setExpenseCategorySearchQuery] = useState('');
  const [activitiesSearchQuery, setActivitiesSearchQuery] = useState('');
  const [expensesSearchQuery, setExpensesSearchQuery] = useState('');

  // View/Edit Modal States
  const [selectedCycle, setSelectedCycle] = useState<CropCycle | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<FarmExpense | null>(null);
  const [cycleDetailVisible, setCycleDetailVisible] = useState(false);
  const [expenseDetailVisible, setExpenseDetailVisible] = useState(false);
  const [isEditingCycle, setIsEditingCycle] = useState(false);
  const [isEditingExpense, setIsEditingExpense] = useState(false);
  
  // Edit Form Fields
  const [editCropType, setEditCropType] = useState('');
  const [editAllocatedArea, setEditAllocatedArea] = useState('');
  const [editAllocatedAreaUnit, setEditAllocatedAreaUnit] = useState('ACRE');
  const [editSeasonName, setEditSeasonName] = useState('');
  const [editStartedOn, setEditStartedOn] = useState('');
  const [editExpectedHarvestOn, setEditExpectedHarvestOn] = useState('');
  const [editActualHarvestOn, setEditActualHarvestOn] = useState('');
  const [editCycleStatus, setEditCycleStatus] = useState('ACTIVE');
  const [editHarvestAmount, setEditHarvestAmount] = useState('');
  const [editHarvestUnit, setEditHarvestUnit] = useState('');
  const [editCycleNotes, setEditCycleNotes] = useState('');
  const [updatingCycle, setUpdatingCycle] = useState(false);
  const [showEditCycleStatusDropdown, setShowEditCycleStatusDropdown] = useState(false);

  const [editExpenseCategory, setEditExpenseCategory] = useState('');
  const [editExpenseAmount, setEditExpenseAmount] = useState('');
  const [editExpenseDate, setEditExpenseDate] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState('');
  const [editExpenseNotes, setEditExpenseNotes] = useState('');
  const [editSelectedCycleId, setEditSelectedCycleId] = useState('');
  const [updatingExpense, setUpdatingExpense] = useState(false);
  const [showEditCategoryDropdown, setShowEditCategoryDropdown] = useState(false);
  const [showEditCycleDropdown, setShowEditCycleDropdown] = useState(false);

  const categories = ['Seed', 'Fertilizer', 'Pesticide', 'Labor', 'Equipment', 'Fuel', 'Other'];

  const fetchHubData = async () => {
    if (!farmIdentifier) return;
    try {
      // 1. Fetch farm details first to get the correct numeric database ID
      const farmData = await farmsApi.getById(farmIdentifier);
      setFarm(farmData);

      const dbId = farmData.id;
      if (dbId) {
        // Fetch crop cycles (critical)
        try {
          const cyclesData = await cropCyclesApi.getAll({ farm_id: dbId });
          setCycles(cyclesData);
        } catch (err) {
          console.error('Error fetching crop cycles:', err);
        }

        // Fetch expenses (critical)
        try {
          const expensesData = await expensesApi.getAll({ farm_id: dbId });
          setExpenses(expensesData);
        } catch (err) {
          console.error('Error fetching expenses:', err);
        }

        // Fetch logged activity records
        try {
          const activitiesData = await farmActivitiesApi.getAll({ farm_id: dbId });
          setActivities(activitiesData);
        } catch (err) {
          console.error('Error fetching farm activities:', err);
        }

        // Fetch activity templates (non-critical)
        try {
          const activitiesListData = await mastersApi.getActivities();
          if (activitiesListData && activitiesListData.length > 0) {
            // Deduplicate by name (case-insensitive)
            const uniqueMap = new Map<string, FarmActivityMaster>();
            activitiesListData.forEach(a => {
              if (a.is_active) {
                const key = a.name.trim().toLowerCase();
                const existing = uniqueMap.get(key);
                if (!existing || (a.farm_group_id !== null && existing.farm_group_id === null)) {
                  uniqueMap.set(key, a);
                }
              }
            });
            setActivityMastersList(Array.from(uniqueMap.values()));
          } else {
            setActivityMastersList(fallbackActivityMasters);
          }
        } catch (err) {
          console.error('Error fetching activity templates:', err);
          setActivityMastersList(fallbackActivityMasters);
        }

        // Fetch input products (non-critical)
        try {
          const inputProductsListData = await mastersApi.getInputProducts();
          setInputProductsList(inputProductsListData.filter(p => p.is_active));
        } catch (err) {
          console.error('Error fetching input products:', err);
        }
      } else {
        setCycles([]);
        setExpenses([]);
        setActivities([]);
        setActivityMastersList(fallbackActivityMasters);
        setInputProductsList([]);
      }
    } catch (error) {
      console.error('Error fetching farm hub data:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHubData();
  }, [farmIdentifier]);

  useFocusEffect(
    useCallback(() => {
      if (farmIdentifier) {
        fetchHubData();
      }
    }, [farmIdentifier])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHubData();
    fetchCrops();
  };

  const fetchCrops = async () => {
    try {
      const data = await mastersApi.getCrops();
      setCrops(data.filter((c) => c.is_active));
    } catch (error) {
      console.error('Error fetching crops:', error);
    }
  };

  useEffect(() => {
    fetchCrops();
  }, []);

  useEffect(() => {
    if (!selectedCropId) {
      setSeasonName('');
      return;
    }
    const cropObj = crops.find(c => c.id.toString() === selectedCropId.toString());
    if (!cropObj) return;

    const cropName = cropObj.name;
    const variety = cropType.trim();
    const area = allocatedArea.trim();
    
    let label = cropName;
    if (variety) {
      label += ` (${variety})`;
    }
    
    let parts = [label];
    if (area) {
      parts.push(`${area} acres`);
    }
    
    setSeasonName(parts.join(' - '));
  }, [selectedCropId, cropType, allocatedArea, crops]);

  const handleSelectCalendarDate = (dateStr: string) => {
    setCalendarVisible(false);
    switch (calendarTarget) {
      case 'start':
        setStartedOn(dateStr);
        if (startedOnError) setStartedOnError('');
        break;
      case 'expected':
        setExpectedHarvestOn(dateStr);
        break;
      case 'expense':
        setExpenseDate(dateStr);
        if (expenseErrors.date) {
          setExpenseErrors(prev => ({ ...prev, date: '' }));
        }
        break;
      case 'editStart':
        setEditStartedOn(dateStr);
        break;
      case 'editExpected':
        setEditExpectedHarvestOn(dateStr);
        break;
      case 'editActual':
        setEditActualHarvestOn(dateStr);
        break;
      case 'editExpense':
        setEditExpenseDate(dateStr);
        break;
      case 'activity':
        setActivityDate(dateStr);
        break;
    }

    if (calendarTarget.startsWith('field:')) {
      const fieldKey = calendarTarget.replace('field:', '');
      setActivityFieldsValues(prev => ({ ...prev, [fieldKey]: dateStr }));
      if (activityErrors[fieldKey]) {
        setActivityErrors(prev => ({ ...prev, [fieldKey]: '' }));
      }
    }
  };

  const handleCreateCycle = async () => {
    setCropError('');
    setAreaError('');
    setStartedOnError('');
    setSeasonNameError('');

    let hasError = false;
    if (!selectedCropId) {
      setCropError('Crop selection is required.');
      hasError = true;
    }
    if (!allocatedArea.trim()) {
      setAreaError('Allocated area is required.');
      hasError = true;
    } else if (isNaN(Number(allocatedArea)) || Number(allocatedArea) <= 0) {
      setAreaError('Area size must be a valid positive number.');
      hasError = true;
    }
    if (!startedOn.trim()) {
      setStartedOnError('Start date is required.');
      hasError = true;
    }
    if (!seasonName.trim()) {
      setSeasonNameError('Season/Cycle name is required.');
      hasError = true;
    }

    if (hasError) return;

    setSavingCycle(true);
    try {
      const newCycle: CropCycle = {
        farm_id: farm?.id || farmIdentifier,
        crop_id: parseInt(selectedCropId),
        crop_type: cropType || undefined,
        allocated_area: parseFloat(allocatedArea),
        allocated_area_unit: 'acre',
        season_name: seasonName,
        started_on: startedOn,
        expected_harvest_on: expectedHarvestOn || undefined,
        status: 'active',
        notes: notes || undefined,
      };

      await cropCyclesApi.create(newCycle);
      Alert.alert('Success', 'Crop cycle added successfully.');
      setSelectedCropId('');
      setCropType('');
      setAllocatedArea('');
      setSeasonName('');
      setExpectedHarvestOn('');
      setNotes('');
      setCycleModalVisible(false);
      fetchHubData();
    } catch (error: any) {
      console.error('Error creating crop cycle:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setSavingCycle(false);
    }
  };

  const handleCreateExpense = async () => {
    let hasError = false;
    const errors: Record<string, string> = {};

    if (!expenseCategory) {
      errors.category = 'Category is required.';
      hasError = true;
    }
    if (!expenseAmount || isNaN(parseFloat(expenseAmount)) || parseFloat(expenseAmount) <= 0) {
      errors.amount = 'Valid amount is required.';
      hasError = true;
    }
    if (!expenseDate) {
      errors.date = 'Expense date is required.';
      hasError = true;
    }

    setExpenseErrors(errors);
    if (hasError) return;

    setSavingExpense(true);
    try {
      const categoryToMasterIdMap: Record<string, number> = {
        'Seed': 1,
        'Fuel': 2,
        'Labor': 3,
        'Electricity': 4,
        'Transportation': 5,
        'Equipment': 6,
        'Other': 6,
        'Pesticide': 7,
        'Fertilizer': 7,
      };

      const masterId = categoryToMasterIdMap[expenseCategory] || 6;

      const newExpense: FarmExpense = {
        farm_id: farm?.id || farmIdentifier,
        crop_cycle_id: selectedCycleId ? selectedCycleId : null,
        expense_master_id: masterId,
        date: expenseDate,
        expense_category: expenseCategory,
        amount: parseFloat(expenseAmount),
        payment_method: paymentStatus === 'completed' ? paymentMethod : 'cash',
        payment_status: paymentStatus,
        notes: expenseNotes || undefined,
      };

      await expensesApi.create(newExpense);
      Alert.alert('Success', 'Expense logged successfully.');
      setExpenseAmount('');
      setExpenseNotes('');
      setSelectedCycleId('');
      setExpenseCategory('');
      setExpenseErrors({});
      setExpenseModalVisible(false);
      fetchHubData();
    } catch (error: any) {
      console.error('Error creating expense:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setSavingExpense(false);
    }
  };

  const handleCreateActivity = async () => {
    let hasError = false;
    const errors: Record<string, string> = {};

    if (!selectedActivityMasterId) {
      setActivityMasterError('Please select an activity type.');
      hasError = true;
    }

    // Validate dynamic fields
    const selectedMaster = activityMastersList.find(m => m.id.toString() === selectedActivityMasterId.toString());
    let fields = selectedMaster?.fields || [];
    if (fields.length === 0 && selectedMaster) {
      const fallback = findFallbackMaster(selectedMaster.name);
      if (fallback) {
        fields = fallback.fields || [];
      }
    }
    fields.forEach(f => {
      const val = activityFieldsValues[f.key];
      if (f.required && (val === undefined || val === null || val === '')) {
        errors[f.key] = `${f.label} is required.`;
        hasError = true;
      }
      if (val === 'new' && (!customProductNames[f.key] || !customProductNames[f.key].trim())) {
        errors[f.key] = `Please enter custom ${f.label.toLowerCase()} name.`;
        hasError = true;
      }
    });

    setActivityErrors(errors);
    if (hasError) return;

    setSavingActivity(true);
    try {
      const activeObj = activityMastersList.find(m => m.id.toString() === selectedActivityMasterId.toString());
      let finalMasterId = selectedActivityMasterId;

      if (selectedActivityMasterId.toString().startsWith('f')) {
        const createdMaster = await mastersApi.createActivity({
          name: activeObj?.name || 'General',
          is_active: true,
        });
        finalMasterId = createdMaster.id.toString();
      }

      // Handle dynamic custom product creation if "+ Add Custom Product..." is selected
      const updatedFieldsValues = { ...activityFieldsValues };
      const selectedMasterObj = activityMastersList.find(m => m.id.toString() === selectedActivityMasterId.toString());
      let fieldsList = selectedMasterObj?.fields || [];
      if (fieldsList.length === 0 && selectedMasterObj) {
        const fallback = findFallbackMaster(selectedMasterObj.name);
        if (fallback) {
          fieldsList = fallback.fields || [];
        }
      }

      for (const f of fieldsList) {
        if (f.type === 'morph' && updatedFieldsValues[f.key] === 'new') {
          const customName = customProductNames[f.key];
          if (customName && customName.trim()) {
            const newProduct = await mastersApi.createInputProduct({
              name: customName.trim(),
              is_active: true,
            });
            // Update the locally cached list too
            setInputProductsList(prev => [...prev, newProduct]);
            updatedFieldsValues[f.key] = newProduct.id;
          }
        }
      }

      const activityPayload: FarmActivity = {
        farm_id: farm?.id || farmIdentifier,
        crop_cycle_id: selectedActivityCycleId ? parseInt(selectedActivityCycleId) : null,
        farm_activity_master_id: parseInt(finalMasterId),
        date: activityDate,
        status: new Date(activityDate) > new Date() ? 'scheduled' : 'completed',
        notes: activityNotes || undefined,
        activity_type: activeObj?.name || 'Unknown',
        details_json: updatedFieldsValues,
      };

      await farmActivitiesApi.create(activityPayload);
      Alert.alert('Success', 'Activity scheduled successfully.');
      setActivityModalVisible(false);
      setSelectedActivityMasterId('');
      setActivityNotes('');
      setActivityFieldsValues({});
      setCustomProductNames({});
      fetchHubData();
    } catch (error: any) {
      console.error('Error creating activity:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setSavingActivity(false);
    }
  };

  const handleUpdateCycle = async () => {
    if (!selectedCycle || (!selectedCycle.id && !selectedCycle.ulid)) return;
    if (!editCropType || !editAllocatedArea) {
      Alert.alert('Validation Error', 'Crop type and area are required.');
      return;
    }
    setUpdatingCycle(true);
    const identifier = selectedCycle.ulid || selectedCycle.id!;
    try {
      const updatedCycle: CropCycle = {
        ...selectedCycle,
        crop_type: editCropType,
        allocated_area: parseFloat(editAllocatedArea),
        allocated_area_unit: editAllocatedAreaUnit,
        season_name: editSeasonName || undefined,
        started_on: editStartedOn,
        expected_harvest_on: editExpectedHarvestOn || undefined,
        actual_harvest_on: editActualHarvestOn || undefined,
        status: editCycleStatus,
        harvest_amount: editHarvestAmount ? parseFloat(editHarvestAmount) : undefined,
        harvest_unit: editHarvestUnit || undefined,
        notes: editCycleNotes || undefined,
      };

      const result = await cropCyclesApi.update(identifier, updatedCycle);
      Alert.alert('Success', 'Crop cycle updated.');
      setIsEditingCycle(false);
      setSelectedCycle(result);
      fetchHubData();
    } catch (error: any) {
      console.error('Error updating crop cycle:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setUpdatingCycle(false);
    }
  };

  const handleDeleteCycle = (cycle: CropCycle) => {
    if (!cycle.id && !cycle.ulid) return;
    const identifier = cycle.ulid || cycle.id!;
    Alert.alert('Delete Cycle', 'Are you sure you want to delete this crop cycle?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await cropCyclesApi.delete(identifier);
            Alert.alert('Success', 'Crop cycle deleted.');
            setCycleDetailVisible(false);
            fetchHubData();
          } catch (error) {
            console.error(error);
            Alert.alert('Error', extractErrorMessage(error));
          }
        },
      },
    ]);
  };

  const handleUpdateExpense = async () => {
    if (!selectedExpense || (!selectedExpense.id && !selectedExpense.ulid)) return;
    if (!editExpenseAmount || !editExpenseCategory) {
      Alert.alert('Validation Error', 'Amount and category are required.');
      return;
    }
    setUpdatingExpense(true);
    const identifier = selectedExpense.ulid || selectedExpense.id!;
    try {
      const categoryToMasterIdMap: Record<string, number> = {
        'Seed': 1,
        'Fuel': 2,
        'Labor': 3,
        'Electricity': 4,
        'Transportation': 5,
        'Equipment': 6,
        'Other': 6,
        'Pesticide': 7,
        'Fertilizer': 7,
      };

      const masterId = categoryToMasterIdMap[editExpenseCategory] || 6;

      const updatedExpense: FarmExpense = {
        ...selectedExpense,
        crop_cycle_id: editSelectedCycleId ? editSelectedCycleId : null,
        expense_master_id: masterId,
        date: editExpenseDate,
        expense_category: editExpenseCategory,
        amount: parseFloat(editExpenseAmount),
        payment_method: editPaymentMethod,
        payment_status: editPaymentStatus,
        notes: editExpenseNotes || undefined,
      };

      const result = await expensesApi.update(identifier, updatedExpense);
      Alert.alert('Success', 'Expense updated.');
      setIsEditingExpense(false);
      setSelectedExpense(result);
      fetchHubData();
    } catch (error: any) {
      console.error('Error updating expense:', error);
      Alert.alert('Error', extractErrorMessage(error));
    } finally {
      setUpdatingExpense(false);
    }
  };

  const handleDeleteExpense = (expense: FarmExpense) => {
    if (!expense.id && !expense.ulid) return;
    const identifier = expense.ulid || expense.id!;
    Alert.alert('Delete Expense', 'Are you sure you want to delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await expensesApi.delete(identifier);
            Alert.alert('Success', 'Expense deleted.');
            setExpenseDetailVisible(false);
            fetchHubData();
          } catch (error) {
            console.error(error);
            Alert.alert('Error', extractErrorMessage(error));
          }
        },
      },
    ]);
  };

  const handleOpenCycleView = (cycle: CropCycle) => {
    router.push({
      pathname: '/crop-cycle-view',
      params: {
        cycle_id: cycle.id ? cycle.id.toString() : undefined,
        ulid: cycle.ulid,
        farm_name: farm?.name,
      },
    });
  };

  const handleOpenCycleEdit = (cycle: CropCycle) => {
    setSelectedCycle(cycle);
    setEditCropType(cycle.crop_type || '');
    setEditAllocatedArea(cycle.allocated_area?.toString() || '');
    setEditAllocatedAreaUnit(cycle.allocated_area_unit || 'ACRE');
    setEditSeasonName(cycle.season_name || '');
    setEditStartedOn(cycle.started_on ? cycle.started_on.split('T')[0] : '');
    setEditExpectedHarvestOn(cycle.expected_harvest_on ? cycle.expected_harvest_on.split('T')[0] : '');
    setEditActualHarvestOn(cycle.actual_harvest_on ? cycle.actual_harvest_on.split('T')[0] : '');
    setEditCycleStatus(cycle.status || 'active');
    setEditHarvestAmount(cycle.harvest_amount?.toString() || '');
    setEditHarvestUnit(cycle.harvest_unit || '');
    setEditCycleNotes(cycle.notes || '');
    setIsEditingCycle(true);
    setCycleDetailVisible(true);
  };

  const handleOpenExpenseView = (expense: FarmExpense) => {
    setSelectedExpense(expense);
    setEditSelectedCycleId(expense.crop_cycle_id?.toString() || '');
    setEditExpenseDate(expense.date ? expense.date.split('T')[0] : '');
    setEditExpenseCategory(expense.expense_category || 'Labor');
    setEditExpenseAmount(expense.amount?.toString() || '');
    setEditPaymentMethod(expense.payment_method || 'Cash');
    setEditPaymentStatus(expense.payment_status || 'PAID');
    setEditExpenseNotes(expense.notes || '');
    setIsEditingExpense(false);
    setExpenseDetailVisible(true);
  };

  const handleOpenExpenseEdit = (expense: FarmExpense) => {
    setSelectedExpense(expense);
    setEditSelectedCycleId(expense.crop_cycle_id?.toString() || '');
    setEditExpenseDate(expense.date ? expense.date.split('T')[0] : '');
    setEditExpenseCategory(expense.expense_category || 'Labor');
    setEditExpenseAmount(expense.amount?.toString() || '');
    setEditPaymentMethod(expense.payment_method || 'Cash');
    setEditPaymentStatus(expense.payment_status || 'PAID');
    setEditExpenseNotes(expense.notes || '');
    setIsEditingExpense(true);
    setExpenseDetailVisible(true);
  };

  // Calculate used allocated area dynamically for active cycles
  const totalAreaVal = farm ? parseFloat(farm.area as string) : 0;
  const allocatedUsedAreaVal = cycles
    .filter(c => c.status?.toLowerCase() === 'active')
    .reduce((sum, c) => sum + parseFloat(c.allocated_area as string || '0'), 0);
  const availableAreaVal = Math.max(totalAreaVal - allocatedUsedAreaVal, 0);

  const activeCycles = cycles.filter(c => c.status?.toLowerCase() === 'active');

  const editSelectedCycleName = (() => {
    const cy = cycles.find(c => (c.ulid === editSelectedCycleId || c.id?.toString() === editSelectedCycleId));
    return cy ? `Cycle: ${cy.crop_name || cy.crop_type || 'Unknown Crop'}` : 'None / General Expense';
  })();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#166534" />
        <Text style={styles.loadingText}>Loading Farm Center...</Text>
      </View>
    );
  }

  if (!farm) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.navbar}>
          <TouchableOpacity style={styles.navBackBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#475569" />
          </TouchableOpacity>
          <View style={styles.navTitleGroup}>
            <Text style={styles.navbarTitle}>Farm Hub</Text>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
          <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '600', color: '#1e293b' }}>Farm Not Found</Text>
          <TouchableOpacity
            style={{ marginTop: 16, backgroundColor: '#16a34a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
            onPress={() => router.back()}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const cleanDate = dateStr.split('T')[0];
      const parts = cleanDate.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return cleanDate;
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navBackBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#475569" />
        </TouchableOpacity>
        <View style={styles.navTitleGroup}>
          <Text style={styles.navbarTitle}>{farm.name}</Text>
          <Text style={styles.navbarSubtitle}>📍 {farm.location || 'Location not set'}</Text>
        </View>
        <View style={[styles.statusDot, !farm.is_active && styles.statusDotInactive]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#16a34a']} />}
      >
        {/* Stats Grid matching PWA */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TOTAL AREA</Text>
            <Text style={styles.statValue}>
              {totalAreaVal.toFixed(2)}
              <Text style={styles.statUnit}> {farm.area_unit.toLowerCase()}</Text>
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>ALLOCATED USED</Text>
            <Text style={[styles.statValue, { color: '#b45309' }]}>
              {allocatedUsedAreaVal.toFixed(2)}
              <Text style={styles.statUnit}> {farm.area_unit.toLowerCase()}</Text>
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>AVAILABLE</Text>
            <Text style={[styles.statValue, { color: '#16a34a' }]}>
              {availableAreaVal.toFixed(2)}
              <Text style={styles.statUnit}> {farm.area_unit.toLowerCase()}</Text>
            </Text>
          </View>
        </View>

        {/* Tab Segmented Control */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'cycles' && styles.tabButtonActive]}
            onPress={() => setActiveTab('cycles')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'cycles' && styles.tabTextActive]}>Crops</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'activities' && styles.tabButtonActive]}
            onPress={() => setActiveTab('activities')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'activities' && styles.tabTextActive]}>Activities</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'expenses' && styles.tabButtonActive]}
            onPress={() => setActiveTab('expenses')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>Expenses</Text>
          </TouchableOpacity>
        </View>

        {/* Crops / Cycles Tab */}
        {activeTab === 'cycles' && (
          <View style={styles.tabContent}>
            <View style={styles.tabHeaderRow}>
              <Text style={styles.tabTitle}>Farm Plots & Crops</Text>
              <TouchableOpacity style={styles.addInlineBtn} onPress={() => {
                setSelectedCropId('');
                setCropType('');
                setAllocatedArea('');
                setSeasonName('');
                setExpectedHarvestOn('');
                setNotes('');
                setCropError('');
                setAreaError('');
                setStartedOnError('');
                setSeasonNameError('');
                setCycleModalVisible(true);
              }}>
                <Text style={styles.addInlineBtnText}>+ Start Cycle</Text>
              </TouchableOpacity>
            </View>

            {cycles.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No crop cycles on this farm</Text>
                <Text style={styles.emptySubtext}>Tap "+ Start Cycle" to add a new cultivation plot.</Text>
              </View>
            ) : (
              cycles.map((item) => {
                const isActive = item.status?.toLowerCase() === 'active';
                const isCompleted = item.status?.toLowerCase() === 'harvested';
                return (
                  <TouchableOpacity
                    key={item.ulid || item.id}
                    style={[styles.plotCard, !isActive && styles.plotCardInactive]}
                    activeOpacity={0.9}
                    onPress={() => handleOpenCycleView(item)}
                  >
                    <View style={styles.plotHeader}>
                      {item.crop_details?.image_url ? (
                        <Image 
                          source={{ uri: getAbsoluteImageUrl(item.crop_details.image_url) }} 
                          style={styles.cropImage} 
                        />
                      ) : (
                        <View style={styles.cropIconContainer}>
                          <Ionicons name="leaf-outline" size={20} color={isActive ? '#166534' : '#64748b'} />
                        </View>
                      )}
                      <View style={styles.cropTitleContainer}>
                        <Text style={styles.cropTitleText}>
                          {item.crop_name || item.crop_type || 'Unknown Crop'}
                        </Text>
                        <Text style={styles.cropSubtitleText}>
                          {item.season_name || '2026'}
                        </Text>
                      </View>
                      <View style={styles.statusBadgeRow}>
                        <View style={[styles.miniStatusDot, isActive ? styles.statusDotActive : styles.statusDotInactive]} />
                        <Text style={styles.miniStatusText}>
                          {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase() : ''}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardDivider} />

                    <View style={styles.infoRow}>
                      <View style={styles.infoCol}>
                        <Text style={styles.infoLabel}>START</Text>
                        <Text style={styles.infoValue}>
                          {item.started_on ? formatDisplayDate(item.started_on) : 'N/A'}
                        </Text>
                      </View>
                      
                      <View style={styles.infoCol}>
                        <Text style={styles.infoLabel}>AREA</Text>
                        <Text style={styles.infoValue}>
                          {parseFloat(item.allocated_area as string).toFixed(2)} {item.allocated_area_unit.toLowerCase() === 'acre' ? 'Acre' : item.allocated_area_unit}
                        </Text>
                      </View>

                      {item.actual_harvest_on ? (
                        <View style={styles.infoCol}>
                          <Text style={styles.infoLabel}>HARVESTED</Text>
                          <Text style={styles.infoValue}>
                            {formatDisplayDate(item.actual_harvest_on)}
                          </Text>
                        </View>
                      ) : item.expected_harvest_on ? (
                        <View style={styles.infoCol}>
                          <Text style={styles.infoLabel}>EXPECTED</Text>
                          <Text style={styles.infoValue}>
                            {formatDisplayDate(item.expected_harvest_on)}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity 
                        style={styles.cardActionBtn} 
                        onPress={() => {
                          setSelectedActivityCycleId(item.id!.toString());
                          setActivityDate(new Date().toISOString().split('T')[0]);
                          setActivityNotes('');
                          setSelectedActivityMasterId('');
                          setActivityMasterError('');
                          setActivityModalVisible(true);
                        }}
                      >
                        <Ionicons name="document-text-outline" size={16} color="#64748b" style={styles.cardActionIcon} />
                        <Text style={styles.cardActionBtnText}>Activity</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.cardActionBtn} 
                        onPress={() => {
                          setSelectedCycleId(item.id!.toString());
                          setExpenseOpenedFromCard(true);
                          setExpenseModalVisible(true);
                        }}
                      >
                        <Text style={styles.rupeeIcon}>₹</Text>
                        <Text style={styles.cardActionBtnText}>Expense</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.cardActionIconBtn} 
                        onPress={() => handleOpenCycleView(item)}
                      >
                        <Ionicons name="eye-outline" size={18} color="#64748b" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* Activities Tab */}
        {activeTab === 'activities' && (
          <View style={styles.tabContent}>
            <View style={styles.tabHeaderRow}>
              <Text style={styles.tabTitle}>Farm Activities</Text>
              <TouchableOpacity
                style={styles.addInlineBtn}
                onPress={() => {
                  setSelectedActivityCycleId('');
                  setActivityDate(new Date().toISOString().split('T')[0]);
                  setActivityNotes('');
                  setSelectedActivityMasterId('');
                  setActivityMasterError('');
                  setActivityModalVisible(true);
                }}
              >
                <Text style={styles.addInlineBtnText}>+ Add Activity</Text>
              </TouchableOpacity>
            </View>

            {/* Search Input Bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 12, height: 42, marginBottom: 16 }}>
              <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, height: '100%', fontSize: 14, color: '#0f172a', padding: 0 }}
                placeholder="Search activities..."
                placeholderTextColor="#94a3b8"
                value={activitiesSearchQuery}
                onChangeText={setActivitiesSearchQuery}
              />
              {activitiesSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setActivitiesSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {(() => {
              const filtered = (activities || []).filter(act => {
                if (!activitiesSearchQuery) return true;
                const query = activitiesSearchQuery.toLowerCase();
                const name = (act.activity_type || act.farm_activity_master?.name || '').toLowerCase();
                const notes = (act.notes || '').toLowerCase();
                
                const cycleId = act.crop_cycle_id;
                const cy = cycles.find(c => c.id?.toString() === cycleId?.toString());
                const crop = (cy ? `${cy.crop_name || cy.crop_type} ${cy.season_name}` : '').toLowerCase();

                return name.includes(query) || notes.includes(query) || crop.includes(query);
              });

              if (filtered.length === 0) {
                return (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No matching activities found</Text>
                    <Text style={styles.emptySubtext}>Try searching with a different keyword.</Text>
                  </View>
                );
              }

              // Group by date
              const grouped: Record<string, typeof activities> = {};
              filtered.forEach(act => {
                const dateStr = act.date ? act.date.toString().split('T')[0] : 'No Date';
                if (!grouped[dateStr]) {
                  grouped[dateStr] = [];
                }
                grouped[dateStr].push(act);
              });

              const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

              return sortedDates.map(dateKey => {
                const dayActivities = grouped[dateKey];
                return (
                  <View key={dateKey} style={{ marginBottom: 20 }}>
                    {/* Group Date Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#eab308', marginRight: 8 }} />
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>
                          {formatDisplayDate(dateKey)}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569' }}>
                          {dayActivities.length} {dayActivities.length === 1 ? 'activity' : 'activities'}
                        </Text>
                      </View>
                    </View>

                    {/* Group Items grouped by Cycle (Matches PWA) */}
                    {(() => {
                      const cycleGroups: Record<string, { cropName: string | null; items: typeof activities }> = {};
                      dayActivities.forEach(act => {
                        const cycleId = act.crop_cycle_id;
                        const cy = cycleId ? cycles.find(c => c.id?.toString() === cycleId.toString()) : null;
                        const label = cy ? (cy.season_name || 'Active Cycle') : 'General Activity';
                        const crop = cy ? (cy.crop_name || cy.crop_type || null) : null;
                        
                        if (!cycleGroups[label]) {
                          cycleGroups[label] = { cropName: crop, items: [] };
                        }
                        cycleGroups[label].items.push(act);
                      });

                      return Object.keys(cycleGroups).map(cycleLabel => {
                        const { cropName, items } = cycleGroups[cycleLabel];
                        const isGeneral = cycleLabel === 'General Activity';
                        const hasScheduled = items.some(act => act.status === 'scheduled');

                        return (
                          <View 
                            key={cycleLabel} 
                            style={[
                              styles.activityCard, 
                              { marginBottom: 14, padding: 14, backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 12 },
                              hasScheduled ? { borderColor: '#fed7aa', backgroundColor: '#fff7ed' } : null,
                              isGeneral ? { borderColor: '#bae6fd', backgroundColor: '#f0f9ff' } : null
                            ]}
                          >
                            {!isGeneral && (
                              <View style={{ marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e293b' }}>{cycleLabel}</Text>
                                {cropName && (
                                  <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 2 }}>
                                    Crop: <Text style={{ color: '#475569', fontWeight: '700' }}>{cropName}</Text>
                                  </Text>
                                )}
                              </View>
                            )}

                            <View style={{ flexDirection: 'column' }}>
                              {items.map((act, actIdx) => {
                                const details = act.details_json;
                                const masterId = act.farm_activity_master_id || act.farm_activity_master?.id;
                                const master = activityMastersList.find(m => m.id.toString() === masterId?.toString());
                                let fields = master?.fields || [];
                                if (fields.length === 0 && master) {
                                  const fallback = findFallbackMaster(master.name);
                                  if (fallback) {
                                    fields = fallback.fields || [];
                                  }
                                }

                                const rows: { label: string; value: string }[] = [];
                                if (details && typeof details === 'object' && Object.keys(details).length > 0) {
                                  Object.keys(details).forEach(key => {
                                    const val = details[key];
                                    if (val !== undefined && val !== null && val !== '') {
                                      const fieldDef = fields.find(f => f.key === key);
                                      const label = fieldDef ? fieldDef.label : (key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' '));
                                      let displayVal = '';
                                      if (fieldDef?.type === 'boolean') {
                                        displayVal = val ? 'Yes' : 'No';
                                      } else if (fieldDef?.type === 'morph') {
                                        const prod = inputProductsList.find(p => p.id.toString() === val.toString());
                                        displayVal = prod ? prod.name : val;
                                      } else if (fieldDef?.type === 'enum') {
                                        const normalized = getNormalizedOptions(fieldDef.options);
                                        const found = normalized.find(o => o.key === val);
                                        displayVal = found ? found.label : val;
                                      } else {
                                        displayVal = `${val}${fieldDef?.unit ? ' ' + fieldDef.unit : ''}`;
                                      }
                                      rows.push({ label, value: displayVal });
                                    }
                                  });
                                }

                                const detailsLine = rows.map(r => `${r.label}: ${r.value}`).join('  •  ');

                                return (
                                  <View key={act.id || act.ulid} style={{ marginTop: actIdx > 0 ? 12 : 0, paddingTop: actIdx > 0 ? 12 : 0, borderTopWidth: actIdx > 0 ? 1 : 0, borderTopColor: '#e2e8f0' }}>
                                    {/* Activity title and status row */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155' }}>
                                        {act.activity_type || act.farm_activity_master?.name}
                                      </Text>
                                      <View style={[
                                        styles.statusPillActive, 
                                        act.status === 'completed' ? { backgroundColor: '#dcfce7' } :
                                        act.status === 'scheduled' ? { backgroundColor: '#fef9c3' } :
                                        act.status === 'cancelled' ? { backgroundColor: '#fee2e2' } :
                                        { backgroundColor: '#dbeafe' }
                                      ]}>
                                        <Text style={[
                                          styles.statusPillText, 
                                          act.status === 'completed' ? { color: '#15803d' } :
                                          act.status === 'scheduled' ? { color: '#a16207' } :
                                          act.status === 'cancelled' ? { color: '#b91c1c' } :
                                          { color: '#1d4ed8' }
                                        ]}>
                                          {act.status ? act.status.charAt(0).toUpperCase() + act.status.slice(1) : ''}
                                        </Text>
                                      </View>
                                    </View>

                                    {/* Inline parameters text (Matches PWA) */}
                                    {detailsLine.length > 0 && (
                                      <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 16 }}>
                                        {detailsLine}
                                      </Text>
                                    )}

                                    {/* Notes (Matches PWA) */}
                                    {act.notes ? (
                                      <Text style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 4 }}>
                                        Notes: {act.notes}
                                      </Text>
                                    ) : null}
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        );
                      });
                    })()}
                  </View>
                );
              });
            })()}
          </View>
        )}

        {/* Expenses Tab */}
        {activeTab === 'expenses' && (
          <View style={styles.tabContent}>
            <View style={styles.tabHeaderRow}>
              <Text style={styles.tabTitle}>Expenses ledger</Text>
              <TouchableOpacity style={styles.addInlineBtn} onPress={() => {
                setSelectedCycleId('');
                setExpenseOpenedFromCard(false);
                setExpenseModalVisible(true);
              }}>
                <Text style={styles.addInlineBtnText}>+ Log Expense</Text>
              </TouchableOpacity>
            </View>

            {/* Search Input Bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 12, height: 42, marginBottom: 16 }}>
              <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, height: '100%', fontSize: 14, color: '#0f172a', padding: 0 }}
                placeholder="Search expenses..."
                placeholderTextColor="#94a3b8"
                value={expensesSearchQuery}
                onChangeText={setExpensesSearchQuery}
              />
              {expensesSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setExpensesSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {(() => {
              const filtered = (expenses || []).filter(item => {
                if (!expensesSearchQuery) return true;
                const query = expensesSearchQuery.toLowerCase();
                const category = (item.expense_category || '').toLowerCase();
                const notes = (item.notes || '').toLowerCase();
                
                const cycleObj = cycles.find(c => (c.ulid === item.crop_cycle_id || c.id === item.crop_cycle_id));
                const cycleText = (cycleObj ? `${cycleObj.crop_name || cycleObj.crop_type} ${cycleObj.season_name}` : '').toLowerCase();

                return category.includes(query) || notes.includes(query) || cycleText.includes(query);
              });

              if (filtered.length === 0) {
                return (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No matching expenses found</Text>
                    <Text style={styles.emptySubtext}>Try searching with a different category or note.</Text>
                  </View>
                );
              }

              // Group by date
              const dateGroups: Record<string, typeof expenses> = {};
              filtered.forEach(item => {
                const dateStr = item.date ? item.date.toString().split('T')[0] : 'No Date';
                if (!dateGroups[dateStr]) {
                  dateGroups[dateStr] = [];
                }
                dateGroups[dateStr].push(item);
              });

              const sortedDates = Object.keys(dateGroups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

              return sortedDates.map(dateKey => {
                const dayExpenses = dateGroups[dateKey];
                
                // Group the day's expenses by crop_cycle_id
                const cycleGroups: Record<string, { cycleName: string | null; cropName: string | null; items: typeof expenses }> = {};
                dayExpenses.forEach(item => {
                  const cycleId = item.crop_cycle_id;
                  const cy = cycleId ? cycles.find(c => c.id?.toString() === cycleId.toString()) : null;
                  const label = cy ? (cy.season_name || 'Active Cycle') : 'General Expense';
                  const crop = cy ? (cy.crop_name || cy.crop_type || null) : null;
                  
                  if (!cycleGroups[label]) {
                    cycleGroups[label] = { cycleName: label, cropName: crop, items: [] };
                  }
                  cycleGroups[label].items.push(item);
                });

                return (
                  <View key={dateKey} style={{ marginBottom: 20 }}>
                    {/* Group Date Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#eab308', marginRight: 8 }} />
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>
                          {formatDisplayDate(dateKey)}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569' }}>
                          {dayExpenses.length} {dayExpenses.length === 1 ? 'transaction' : 'transactions'}
                        </Text>
                      </View>
                    </View>

                    {/* Cycle groups inside day */}
                    {Object.keys(cycleGroups).map(cycleLabel => {
                      const { cropName, items } = cycleGroups[cycleLabel];
                      const isGeneral = cycleLabel === 'General Expense';

                      return (
                        <View 
                          key={cycleLabel} 
                          style={{
                            backgroundColor: '#fff',
                            borderColor: '#e2e8f0',
                            borderWidth: 1,
                            borderRadius: 12,
                            padding: 12,
                            marginBottom: 12,
                          }}
                        >
                          {!isGeneral && (
                            <View style={{ marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>{cycleLabel}</Text>
                              {cropName && (
                                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600', marginTop: 1 }}>
                                  Crop: <Text style={{ color: '#475569', fontWeight: '700' }}>{cropName}</Text>
                                </Text>
                              )}
                            </View>
                          )}

                          {items.map((item, itemIdx) => {
                            const isCompleted = item.payment_status?.toLowerCase() === 'completed' || item.payment_status?.toLowerCase() === 'paid';
                            return (
                              <TouchableOpacity 
                                onPress={() => handleOpenExpenseView(item)}
                                key={item.id || item.ulid} 
                                style={{
                                  marginTop: itemIdx > 0 ? 12 : 0,
                                  paddingTop: itemIdx > 0 ? 12 : 0,
                                  borderTopWidth: itemIdx > 0 ? 1 : 0,
                                  borderTopColor: '#f1f5f9',
                                }}
                              >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <View style={{ flex: 1, marginRight: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155', marginRight: 6 }}>
                                        {item.expense_category}
                                      </Text>
                                      <View style={[
                                        styles.statusPillActive, 
                                        isCompleted ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#fee2e2' }
                                      ]}>
                                        <Text style={[
                                          styles.statusPillText, 
                                          isCompleted ? { color: '#15803d' } : { color: '#b91c1c' }
                                        ]}>
                                          {isCompleted ? 'Paid' : 'Pending'}
                                        </Text>
                                      </View>
                                    </View>
                                    {item.notes ? (
                                      <Text style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 4 }}>
                                        Note: {item.notes}
                                      </Text>
                                    ) : null}
                                  </View>

                                  <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 15, fontWeight: '700', color: isCompleted ? '#16a34a' : '#ef4444' }}>
                                      ₹{parseFloat(item.amount as string).toFixed(2)}
                                    </Text>
                                    {item.payment_method && (
                                      <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: '500' }}>
                                        Method: {item.payment_method.toUpperCase()}
                                      </Text>
                                    )}
                                  </View>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      );
                    })}
                  </View>
                );
              });
            })()}
          </View>
        )}
      </ScrollView>

      {/* Start Crop Cycle Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={cycleModalVisible}
        onRequestClose={() => setCycleModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <CalendarOverlay
              visible={calendarVisible && (calendarTarget === 'start' || calendarTarget === 'expected')}
              value={calendarTarget === 'start' ? startedOn : expectedHarvestOn}
              onClose={() => setCalendarVisible(false)}
              onSelect={handleSelectCalendarDate}
              title={calendarTitle}
            />
            {cropModalVisible && (
              <View style={styles.sheetOverlayContent}>
                <View style={styles.bottomSheetHeader}>
                  <Text style={styles.bottomSheetTitle}>Select Crop</Text>
                  <TouchableOpacity onPress={() => setCropModalVisible(false)} style={styles.closeBtnCircle}>
                    <Ionicons name="close" size={20} color="#475569" />
                  </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.sheetSearchContainer}>
                  <Ionicons name="search" size={18} color="#64748b" style={styles.sheetSearchIcon} />
                  <TextInput
                    style={styles.sheetSearchInput}
                    placeholder="Search crops..."
                    placeholderTextColor="#94a3b8"
                    value={cropSearchQuery}
                    onChangeText={setCropSearchQuery}
                  />
                  {cropSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setCropSearchQuery('')}>
                      <Ionicons name="close-circle" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Crops list */}
                <ScrollView 
                  style={styles.sheetList} 
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {crops
                    .filter(c => c.name.toLowerCase().includes(cropSearchQuery.toLowerCase()))
                    .map((c) => {
                      const isSelected = selectedCropId.toString() === c.id.toString();
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.sheetItem, isSelected && styles.sheetItemActive]}
                          onPress={() => {
                            setSelectedCropId(c.id.toString());
                            setCropModalVisible(false);
                            if (cropError) setCropError('');
                          }}
                          activeOpacity={0.6}
                        >
                          <Text style={[styles.sheetItemText, isSelected && styles.sheetItemTextActive]}>
                            {c.name}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              </View>
            )}
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>New Crop Cycle</Text>
                <TouchableOpacity onPress={() => setCycleModalVisible(false)}>
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>
                Crop <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <TouchableOpacity 
                style={[styles.selectorRow, cropError ? styles.inputErrorBorder : null]} 
                onPress={() => {
                  setCropSearchQuery('');
                  setCropModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.selectorText, selectedCropId ? styles.selectorTextSelected : null]}>
                  {selectedCropId ? crops.find(c => c.id.toString() === selectedCropId.toString())?.name : 'Select Crop'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#64748b" />
              </TouchableOpacity>
              {cropError ? <Text style={styles.inputErrorText}>{cropError}</Text> : null}

              <Text style={styles.inputLabel}>Crop Type (Variety)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Bhagwa, Kesar (Optional)"
                placeholderTextColor="#94a3b8"
                value={cropType}
                onChangeText={setCropType}
              />

              <Text style={styles.inputLabel}>
                Allocated Area <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <View style={[styles.areaInputContainer, areaError ? { marginBottom: 4 } : null, areaError ? styles.inputErrorBorder : null]}>
                <TextInput
                  style={styles.areaInputField}
                  placeholder="e.g. 10.5"
                  keyboardType="decimal-pad"
                  value={allocatedArea}
                  onChangeText={(text) => {
                    setAllocatedArea(text);
                    if (text.trim()) setAreaError('');
                  }}
                />
                <View style={styles.areaUnitDivider} />
                <View style={styles.areaUnitTextContainer}>
                  <Text style={styles.areaUnitText}>Acre</Text>
                </View>
              </View>
              {areaError ? <Text style={styles.inputErrorText}>{areaError}</Text> : null}

              <View style={styles.row}>
                <View style={[styles.column, { marginRight: 10 }]}>
                  <Text style={styles.inputLabel}>
                    Start Date <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <TouchableOpacity 
                    style={[styles.selectorRow, startedOnError ? styles.inputErrorBorder : null]} 
                    onPress={() => {
                      setCalendarTarget('start');
                      setCalendarTitle('Select Start Date');
                      setCalendarVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.selectorText, startedOn ? styles.selectorTextSelected : null]}>
                      {startedOn ? formatDisplayDate(startedOn) : 'Select Date'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color="#64748b" />
                  </TouchableOpacity>
                  {startedOnError ? <Text style={styles.inputErrorText}>{startedOnError}</Text> : null}
                </View>

                <View style={styles.column}>
                  <Text style={styles.inputLabel}>Expected Harvest Date</Text>
                  <TouchableOpacity 
                    style={styles.selectorRow} 
                    onPress={() => {
                      setCalendarTarget('expected');
                      setCalendarTitle('Select Expected Harvest Date');
                      setCalendarVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.selectorText, expectedHarvestOn ? styles.selectorTextSelected : null]}>
                      {expectedHarvestOn ? formatDisplayDate(expectedHarvestOn) : 'Select Date'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.inputLabel}>
                Season / Cycle Name <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, seasonNameError ? { marginBottom: 4 } : null, seasonNameError ? styles.inputErrorBorder : null]}
                placeholder="e.g. Rabi 2026"
                placeholderTextColor="#94a3b8"
                value={seasonName}
                onChangeText={(text) => {
                  setSeasonName(text);
                  if (text.trim()) setSeasonNameError('');
                }}
              />
              {seasonNameError ? <Text style={styles.inputErrorText}>{seasonNameError}</Text> : null}

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Remarks..."
                placeholderTextColor="#94a3b8"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setCycleModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleCreateCycle} disabled={savingCycle}>
                  {savingCycle ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Start Cycle</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Schedule Activity Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={activityModalVisible}
        onRequestClose={() => setActivityModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <CalendarOverlay
              visible={calendarVisible && (calendarTarget === 'activity' || calendarTarget.startsWith('field:'))}
              value={
                calendarTarget.startsWith('field:') 
                  ? (activityFieldsValues[calendarTarget.replace('field:', '')] || '')
                  : activityDate
              }
              onClose={() => setCalendarVisible(false)}
              onSelect={handleSelectCalendarDate}
              title={calendarTitle}
            />
            {activityMasterModalVisible && (
              <View style={styles.sheetOverlayContent}>
                <View style={styles.bottomSheetHeader}>
                  <Text style={styles.bottomSheetTitle}>Select Activity Type</Text>
                  <TouchableOpacity onPress={() => setActivityMasterModalVisible(false)} style={styles.closeBtnCircle}>
                    <Ionicons name="close" size={20} color="#475569" />
                  </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.sheetSearchContainer}>
                  <Ionicons name="search" size={18} color="#64748b" style={styles.sheetSearchIcon} />
                  <TextInput
                    style={styles.sheetSearchInput}
                    placeholder="Search activities..."
                    placeholderTextColor="#94a3b8"
                    value={activityMasterSearchQuery}
                    onChangeText={setActivityMasterSearchQuery}
                  />
                  {activityMasterSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setActivityMasterSearchQuery('')}>
                      <Ionicons name="close-circle" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Activities list */}
                <ScrollView 
                  style={styles.sheetList} 
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {activityMastersList
                    .filter(m => m.name.toLowerCase().includes(activityMasterSearchQuery.toLowerCase()))
                    .map((m) => {
                      const isSelected = selectedActivityMasterId.toString() === m.id.toString();
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[styles.sheetItem, isSelected && styles.sheetItemActive]}
                          onPress={() => {
                            setSelectedActivityMasterId(m.id.toString());
                            setActivityMasterModalVisible(false);
                            if (activityMasterError) setActivityMasterError('');
                            
                            // Populate default dynamic fields for the selected activity
                            const initialVals: Record<string, any> = {};
                            let fields = m.fields || [];
                            if (fields.length === 0) {
                              const fallback = findFallbackMaster(m.name);
                              if (fallback) {
                                fields = fallback.fields || [];
                              }
                            }
                            fields.forEach((f: any) => {
                              initialVals[f.key] = f.type === 'boolean' ? false : '';
                            });
                            setActivityFieldsValues(initialVals);
                            setActivityErrors({});
                            setShowFieldDropdowns({});
                          }}
                          activeOpacity={0.6}
                        >
                          <Text style={[styles.sheetItemText, isSelected && styles.sheetItemTextActive]}>
                            {m.name}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              </View>
            )}

            {activityCycleModalVisible && (
              <View style={styles.sheetOverlayContent}>
                <View style={styles.bottomSheetHeader}>
                  <Text style={styles.bottomSheetTitle}>Select Crop Cycle</Text>
                  <TouchableOpacity onPress={() => setActivityCycleModalVisible(false)} style={styles.closeBtnCircle}>
                    <Ionicons name="close" size={20} color="#475569" />
                  </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.sheetSearchContainer}>
                  <Ionicons name="search" size={18} color="#64748b" style={styles.sheetSearchIcon} />
                  <TextInput
                    style={styles.sheetSearchInput}
                    placeholder="Search crop cycles..."
                    placeholderTextColor="#94a3b8"
                    value={activityCycleSearchQuery}
                    onChangeText={setActivityCycleSearchQuery}
                  />
                  {activityCycleSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setActivityCycleSearchQuery('')}>
                      <Ionicons name="close-circle" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Cycles list */}
                <ScrollView 
                  style={styles.sheetList} 
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <TouchableOpacity
                    style={[styles.sheetItem, !selectedActivityCycleId && styles.sheetItemActive]}
                    onPress={() => {
                      setSelectedActivityCycleId('');
                      setActivityCycleModalVisible(false);
                    }}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.sheetItemText, !selectedActivityCycleId && styles.sheetItemTextActive, { color: '#94a3b8' }]}>
                      None (General Farm Activity)
                    </Text>
                    {!selectedActivityCycleId && (
                      <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                    )}
                  </TouchableOpacity>

                  {activeCycles
                    .filter(c => {
                      const text = (c.season_name || '').toLowerCase();
                      return text.includes(activityCycleSearchQuery.toLowerCase());
                    })
                    .map((c) => {
                      const isSelected = selectedActivityCycleId?.toString() === c.id?.toString();
                      return (
                        <TouchableOpacity
                          key={c.ulid || c.id}
                          style={[styles.sheetItem, isSelected && styles.sheetItemActive]}
                          onPress={() => {
                            setSelectedActivityCycleId(c.id!.toString());
                            setActivityCycleModalVisible(false);
                          }}
                          activeOpacity={0.6}
                        >
                          <Text style={[styles.sheetItemText, isSelected && styles.sheetItemTextActive]}>
                            {c.season_name}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Schedule Activity</Text>
                  <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>
                    {(() => {
                      const cy = cycles.find(c => (c.ulid === selectedActivityCycleId || c.id?.toString() === selectedActivityCycleId));
                      return cy ? (cy.season_name || 'Active Cycle') : 'General Activity';
                    })()}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setActivityModalVisible(false)}>
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Cycle Dropdown Selector */}
              <Text style={styles.inputLabel}>Crop Cycle (Optional)</Text>
              <TouchableOpacity 
                style={styles.selectorRow} 
                onPress={() => {
                  setActivityCycleSearchQuery('');
                  setActivityCycleModalVisible(true);
                }}
              >
                <Text style={[styles.selectorText, selectedActivityCycleId ? styles.selectorTextSelected : null]}>
                  {selectedActivityCycleId ? 
                    (() => {
                      const cy = cycles.find(c => (c.ulid === selectedActivityCycleId || c.id?.toString() === selectedActivityCycleId));
                      return cy ? cy.season_name : 'Select Cycle';
                    })() : 'None (General Farm Activity)'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Activity Type <Text style={{ color: '#ef4444' }}>*</Text></Text>
              <TouchableOpacity 
                style={[styles.selectorRow, activityMasterError ? styles.inputErrorBorder : null]} 
                onPress={() => {
                  setActivityMasterSearchQuery('');
                  setActivityMasterModalVisible(true);
                }}
              >
                <Text style={[styles.selectorText, selectedActivityMasterId ? styles.selectorTextSelected : null]}>
                  {selectedActivityMasterId ? activityMastersList.find(m => m.id.toString() === selectedActivityMasterId.toString())?.name : 'Select Activity Type'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>
              {activityMasterError ? <Text style={styles.inputErrorText}>{activityMasterError}</Text> : null}

              {/* Dynamic Fields Section rendered directly inline */}
              {selectedActivityMasterId && (() => {
                const selectedMaster = activityMastersList.find(m => m.id.toString() === selectedActivityMasterId.toString());
                if (!selectedMaster) return null;
                let fields = selectedMaster.fields || [];
                if (fields.length === 0) {
                  const fallback = findFallbackMaster(selectedMaster.name);
                  if (fallback) {
                    fields = fallback.fields || [];
                  }
                }
                if (fields.length === 0) return null;

                return (
                  <View style={{ marginTop: 20, backgroundColor: '#f1f5f9', padding: 14, borderRadius: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Ionicons name="options-outline" size={18} color="#0f172a" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>
                        Activity Details ({selectedMaster.name})
                      </Text>
                    </View>
                    {fields.map((f: any) => {
                      const val = activityFieldsValues[f.key];
                      const error = activityErrors[f.key];

                      // 1. Text field / String type
                      if (f.type === 'string') {
                        return (
                          <View key={f.key} style={{ marginBottom: 12 }}>
                            <Text style={styles.inputLabel}>
                              {f.label} {f.required && <Text style={{ color: '#ef4444' }}>*</Text>}
                            </Text>
                            <TextInput
                              style={[styles.input, { backgroundColor: '#fff' }, error ? styles.inputErrorBorder : null]}
                              value={val || ''}
                              onChangeText={(txt) => {
                                setActivityFieldsValues(prev => ({ ...prev, [f.key]: txt }));
                                if (activityErrors[f.key]) {
                                  setActivityErrors(prev => ({ ...prev, [f.key]: '' }));
                                }
                              }}
                              placeholder={`Enter ${f.label.toLowerCase()}`}
                              placeholderTextColor="#94a3b8"
                            />
                            {error ? <Text style={styles.inputErrorText}>{error}</Text> : null}
                          </View>
                        );
                      }

                      // 2. Numeric / Number / Decimal type
                      if (f.type === 'number' || f.type === 'decimal') {
                        return (
                          <View key={f.key} style={{ marginBottom: 12 }}>
                            <Text style={styles.inputLabel}>
                              {f.label} {f.required && <Text style={{ color: '#ef4444' }}>*</Text>}
                            </Text>
                            <View style={[styles.areaInputContainer, { backgroundColor: '#fff' }, error ? styles.inputErrorBorder : null]}>
                              <TextInput
                                style={styles.areaInputField}
                                value={val !== undefined && val !== null ? val.toString() : ''}
                                onChangeText={(txt) => {
                                  setActivityFieldsValues(prev => ({ ...prev, [f.key]: txt }));
                                  if (activityErrors[f.key]) {
                                    setActivityErrors(prev => ({ ...prev, [f.key]: '' }));
                                  }
                                }}
                                placeholder="e.g. 10"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                              />
                              {f.unit ? (
                                <>
                                  <View style={styles.areaUnitDivider} />
                                  <View style={styles.areaUnitTextContainer}>
                                    <Text style={styles.areaUnitText}>{f.unit}</Text>
                                  </View>
                                </>
                              ) : null}
                            </View>
                            {error ? <Text style={styles.inputErrorText}>{error}</Text> : null}
                          </View>
                        );
                      }

                      // 3. Boolean/Checkbox type
                      if (f.type === 'boolean') {
                        return (
                          <View key={f.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#334155' }}>{f.label}</Text>
                            <Switch
                              value={!!val}
                              onValueChange={(boolVal) => {
                                setActivityFieldsValues(prev => ({ ...prev, [f.key]: boolVal }));
                              }}
                              trackColor={{ false: '#cbd5e1', true: '#bbf7d0' }}
                              thumbColor={val ? '#16a34a' : '#94a3b8'}
                            />
                          </View>
                        );
                      }

                      // 4. Enum/Select type -> Show Segmented Pills!
                      if (f.type === 'enum') {
                        const normalizedOpts = getNormalizedOptions(f.options);

                        return (
                          <View key={f.key} style={{ marginBottom: 12 }}>
                            <Text style={styles.inputLabel}>
                              {f.label} {f.required && <Text style={{ color: '#ef4444' }}>*</Text>}
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                              {normalizedOpts.map((opt) => {
                                const isSelected = val === opt.key;
                                return (
                                  <TouchableOpacity
                                    key={opt.key}
                                    style={{
                                      backgroundColor: isSelected ? '#16a34a' : '#fff',
                                      paddingVertical: 8,
                                      paddingHorizontal: 12,
                                      borderRadius: 20,
                                      borderWidth: 1,
                                      borderColor: isSelected ? '#16a34a' : '#cbd5e1',
                                      marginRight: 8,
                                      marginBottom: 8,
                                    }}
                                    onPress={() => {
                                      setActivityFieldsValues(prev => ({ ...prev, [f.key]: opt.key }));
                                      if (activityErrors[f.key]) {
                                        setActivityErrors(prev => ({ ...prev, [f.key]: '' }));
                                      }
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? '#fff' : '#64748b' }}>
                                      {opt.label}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                            {error ? <Text style={styles.inputErrorText}>{error}</Text> : null}
                          </View>
                        );
                      }

                      // 5. Morph/Select type (Agro Input Products) -> Show Dropdown selector!
                      if (f.type === 'morph') {
                        const showDropdown = !!showFieldDropdowns[f.key];
                        const isCustom = val === 'new';
                        const selectedProduct = isCustom
                          ? { name: customProductNames[f.key] || '+ Add Custom Product...' }
                          : inputProductsList.find(p => p.id.toString() === val?.toString());

                        const dropdownItems = [
                          ...inputProductsList,
                          { id: 'new', name: '+ Add Custom Product...' }
                        ];

                        return (
                          <View key={f.key} style={{ marginBottom: 12 }}>
                            <Text style={styles.inputLabel}>
                              {f.label} {f.required && <Text style={{ color: '#ef4444' }}>*</Text>}
                            </Text>
                            <TouchableOpacity 
                              style={[styles.dropdownTrigger, { backgroundColor: '#fff' }, error ? styles.inputErrorBorder : null]} 
                              onPress={() => setShowFieldDropdowns(prev => ({ ...prev, [f.key]: !showDropdown }))}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.dropdownTriggerText, selectedProduct ? { color: '#0f172a' } : null]}>
                                {selectedProduct ? selectedProduct.name : `Select ${f.label}`}
                              </Text>
                              <Text style={styles.dropdownArrow}>▼</Text>
                            </TouchableOpacity>
                            {error ? <Text style={styles.inputErrorText}>{error}</Text> : null}

                            {showDropdown && (
                              <ScrollView style={[styles.dropdownList, { maxHeight: 150 }]} nestedScrollEnabled={true}>
                                {dropdownItems.map((prod) => (
                                  <TouchableOpacity
                                    key={prod.id}
                                    style={styles.dropdownItem}
                                    onPress={() => {
                                      setActivityFieldsValues(prev => ({ ...prev, [f.key]: prod.id }));
                                      setShowFieldDropdowns(prev => ({ ...prev, [f.key]: false }));
                                      if (activityErrors[f.key]) {
                                        setActivityErrors(prev => ({ ...prev, [f.key]: '' }));
                                      }
                                    }}
                                  >
                                    <Text style={[
                                      styles.dropdownItemText,
                                      prod.id === 'new' ? { color: '#16a34a', fontWeight: '700' } : null
                                    ]}>
                                      {prod.name}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            )}

                            {isCustom && (
                              <TextInput
                                style={[styles.input, { backgroundColor: '#fff', marginTop: 8 }]}
                                value={customProductNames[f.key] || ''}
                                onChangeText={(txt) => {
                                  setCustomProductNames(prev => ({ ...prev, [f.key]: txt }));
                                  if (activityErrors[f.key]) {
                                    setActivityErrors(prev => ({ ...prev, [f.key]: '' }));
                                  }
                                }}
                                placeholder={`Enter custom ${f.label.toLowerCase()} name`}
                                placeholderTextColor="#94a3b8"
                              />
                            )}
                          </View>
                        );
                      }

                      // 6. Date field type
                      if (f.type === 'date') {
                        return (
                          <View key={f.key} style={{ marginBottom: 12 }}>
                            <Text style={styles.inputLabel}>
                              {f.label} {f.required && <Text style={{ color: '#ef4444' }}>*</Text>}
                            </Text>
                            <TouchableOpacity 
                              style={[styles.selectorRow, { backgroundColor: '#fff' }, error ? styles.inputErrorBorder : null]} 
                              onPress={() => {
                                setCalendarTitle(`Select ${f.label}`);
                                setCalendarTarget(`field:${f.key}`);
                                setCalendarVisible(true);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.selectorText, val ? styles.selectorTextSelected : null]}>
                                {val ? formatDisplayDate(val) : 'Select Date'}
                              </Text>
                              <Ionicons name="calendar-outline" size={18} color="#64748b" />
                            </TouchableOpacity>
                            {error ? <Text style={styles.inputErrorText}>{error}</Text> : null}
                          </View>
                        );
                      }

                      return null;
                    })}
                  </View>
                );
              })()}

              <Text style={styles.inputLabel}>Scheduled Date <Text style={{ color: '#ef4444' }}>*</Text></Text>
              <TouchableOpacity 
                style={styles.selectorRow} 
                onPress={() => {
                  setCalendarTarget('activity');
                  setCalendarTitle('Select Scheduled Date');
                  setCalendarVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.selectorText, activityDate ? styles.selectorTextSelected : null]}>
                  {activityDate ? formatDisplayDate(activityDate) : 'Select Date'}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#64748b" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Remarks / Notes</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Details of operation..."
                placeholderTextColor="#94a3b8"
                value={activityNotes}
                onChangeText={setActivityNotes}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setActivityModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleCreateActivity} disabled={savingActivity}>
                  {savingActivity ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Schedule</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>





      {/* Log Expense Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={expenseModalVisible}
        onRequestClose={() => setExpenseModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <CalendarOverlay
              visible={calendarVisible && calendarTarget === 'expense'}
              value={expenseDate}
              onClose={() => setCalendarVisible(false)}
              onSelect={handleSelectCalendarDate}
              title={calendarTitle}
            />
            {expenseCategoryModalVisible && (
              <View style={styles.sheetOverlayContent}>
                <View style={styles.bottomSheetHeader}>
                  <Text style={styles.bottomSheetTitle}>Select Category</Text>
                  <TouchableOpacity onPress={() => setExpenseCategoryModalVisible(false)} style={styles.closeBtnCircle}>
                    <Ionicons name="close" size={20} color="#475569" />
                  </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.sheetSearchContainer}>
                  <Ionicons name="search" size={18} color="#64748b" style={styles.sheetSearchIcon} />
                  <TextInput
                    style={styles.sheetSearchInput}
                    placeholder="Search categories..."
                    placeholderTextColor="#94a3b8"
                    value={expenseCategorySearchQuery}
                    onChangeText={setExpenseCategorySearchQuery}
                  />
                  {expenseCategorySearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setExpenseCategorySearchQuery('')}>
                      <Ionicons name="close-circle" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Categories list */}
                <ScrollView 
                  style={styles.sheetList} 
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {categories
                    .filter(c => c.toLowerCase().includes(expenseCategorySearchQuery.toLowerCase()))
                    .map((c) => {
                      const isSelected = expenseCategory === c;
                      return (
                        <TouchableOpacity
                          key={c}
                          style={[styles.sheetItem, isSelected && styles.sheetItemActive]}
                          onPress={() => {
                            setExpenseCategory(c);
                            setExpenseCategoryModalVisible(false);
                            if (expenseErrors.category) {
                              setExpenseErrors(prev => ({ ...prev, category: '' }));
                            }
                          }}
                          activeOpacity={0.6}
                        >
                          <Text style={[styles.sheetItemText, isSelected && styles.sheetItemTextActive]}>
                            {c}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              </View>
            )}
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Log Expense</Text>
                  {selectedCycleId ? (
                    <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>
                      {(() => {
                        const cy = cycles.find(c => (c.ulid === selectedCycleId || c.id?.toString() === selectedCycleId));
                        return cy ? (cy.season_name || 'Active Cycle') : '';
                      })()}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>
                      General Farm Expense
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => setExpenseModalVisible(false)}>
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Crop Cycle selector (Dependent on farm) - Hide if preselected from card */}
              {!expenseOpenedFromCard && (
                <>
                  <Text style={styles.inputLabel}>Associate Crop Cycle (Optional)</Text>
                  <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setShowCycleDropdown(!showCycleDropdown)}>
                    <Text style={styles.dropdownTriggerText}>
                      {selectedCycleId ? `Cycle: ${cycles.find(c => c.ulid === selectedCycleId || c.id?.toString() === selectedCycleId)?.crop_name || cycles.find(c => c.ulid === selectedCycleId || c.id?.toString() === selectedCycleId)?.crop_type}` : 'None (General Expense)'}
                    </Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>

                  {showCycleDropdown && (
                    <View style={styles.dropdownList}>
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSelectedCycleId('');
                          setShowCycleDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: '#94a3b8' }]}>None (General Farm Expense)</Text>
                      </TouchableOpacity>
                      {activeCycles.length === 0 ? (
                        <Text style={styles.dropdownEmptyText}>No active crop cycles found.</Text>
                      ) : (
                        activeCycles.map((c) => (
                          <TouchableOpacity
                            key={c.ulid || c.id}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setSelectedCycleId(c.id!.toString());
                              setShowCycleDropdown(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>{c.crop_name || c.crop_type} ({c.season_name})</Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}
                </>
              )}

              {/* Category Selector Trigger */}
              <Text style={styles.inputLabel}>Expense Category <Text style={{ color: '#ef4444' }}>*</Text></Text>
              <TouchableOpacity 
                style={[styles.selectorRow, expenseErrors.category ? styles.inputErrorBorder : null]} 
                onPress={() => {
                  setExpenseCategorySearchQuery('');
                  setExpenseCategoryModalVisible(true);
                }}
              >
                <Text style={[styles.selectorText, expenseCategory ? styles.selectorTextSelected : null]}>
                  {expenseCategory || 'Select Category'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>
              {expenseErrors.category ? <Text style={styles.inputErrorText}>{expenseErrors.category}</Text> : null}

              {/* Row for Amount and Expense Date */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                {/* Amount Column */}
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.inputLabel, { marginTop: 0 }]}>Amount (₹) <Text style={{ color: '#ef4444' }}>*</Text></Text>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    height: 48,
                    borderWidth: 1,
                    borderColor: expenseErrors.amount ? '#ef4444' : '#e2e8f0',
                    borderRadius: 8,
                    backgroundColor: '#fff',
                    paddingHorizontal: 12,
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#64748b', marginRight: 6 }}>₹</Text>
                    <TextInput
                      style={{ flex: 1, height: '100%', fontSize: 15, color: '#0f172a', padding: 0 }}
                      placeholder="1500"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      value={expenseAmount}
                      onChangeText={(txt) => {
                        setExpenseAmount(txt);
                        if (expenseErrors.amount) {
                          setExpenseErrors(prev => ({ ...prev, amount: '' }));
                        }
                      }}
                    />
                  </View>
                  {expenseErrors.amount ? <Text style={styles.inputErrorText}>{expenseErrors.amount}</Text> : null}
                </View>

                {/* Expense Date Column */}
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.inputLabel, { marginTop: 0 }]}>Expense Date <Text style={{ color: '#ef4444' }}>*</Text></Text>
                  <TouchableOpacity 
                    style={[styles.selectorRow, expenseErrors.date ? styles.inputErrorBorder : null]} 
                    onPress={() => {
                      setCalendarTarget('expense');
                      setCalendarTitle('Select Expense Date');
                      setCalendarVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.selectorText, expenseDate ? styles.selectorTextSelected : null]}>
                      {expenseDate ? formatDisplayDate(expenseDate) : 'Select Date'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color="#64748b" />
                  </TouchableOpacity>
                  {expenseErrors.date ? <Text style={styles.inputErrorText}>{expenseErrors.date}</Text> : null}
                </View>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 22 }]}>Payment Details</Text>
              {/* Combined Payment Status & Method Card */}
              <View style={{ backgroundColor: '#f8fafc', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16, marginTop: 4 }}>
                {/* 1. Toggle Button row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#334155' }}>Mark as Paid</Text>
                  <Switch
                    value={paymentStatus === 'completed'}
                    onValueChange={(isPaid) => {
                      setPaymentStatus(isPaid ? 'completed' : 'pending');
                    }}
                    trackColor={{ false: '#cbd5e1', true: '#bbf7d0' }}
                    thumbColor={paymentStatus === 'completed' ? '#16a34a' : '#94a3b8'}
                  />
                </View>

                {/* 2. Payment Method selector (if toggle is on) */}
                {paymentStatus === 'completed' && (
                  <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 14 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                      {[
                        { key: 'cash', label: 'Cash' },
                        { key: 'upi', label: 'UPI' },
                        { key: 'bank_transfer', label: 'Bank Transfer' },
                        { key: 'cheque', label: 'Cheque' },
                        { key: 'other', label: 'Other' }
                      ].map((method) => {
                        const isSelected = paymentMethod === method.key;
                        return (
                          <TouchableOpacity
                            key={method.key}
                            style={{
                              backgroundColor: isSelected ? '#16a34a' : '#fff',
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: 20,
                              borderWidth: 1,
                              borderColor: isSelected ? '#16a34a' : '#cbd5e1',
                              marginRight: 8,
                              marginBottom: 8,
                            }}
                            onPress={() => setPaymentMethod(method.key)}
                            activeOpacity={0.7}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? '#fff' : '#64748b' }}>
                              {method.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Vendor, materials details..."
                placeholderTextColor="#94a3b8"
                value={expenseNotes}
                onChangeText={setExpenseNotes}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setExpenseModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleCreateExpense} disabled={savingExpense}>
                  {savingExpense ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Log Expense</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Crop Cycle Detail & Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={cycleDetailVisible}
        onRequestClose={() => setCycleDetailVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <CalendarOverlay
              visible={calendarVisible && (calendarTarget === 'editStart' || calendarTarget === 'editExpected' || calendarTarget === 'editActual')}
              value={
                calendarTarget === 'editStart' ? editStartedOn :
                calendarTarget === 'editExpected' ? editExpectedHarvestOn : editActualHarvestOn
              }
              onClose={() => setCalendarVisible(false)}
              onSelect={handleSelectCalendarDate}
              title={calendarTitle}
            />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {isEditingCycle ? 'Manage Crop Cycle' : 'Crop Cycle Details'}
                </Text>
                <TouchableOpacity onPress={() => setCycleDetailVisible(false)}>
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {isEditingCycle ? (
                <View>
                  <Text style={styles.inputLabel}>Crop Type / Name</Text>
                  <TextInput
                    style={styles.input}
                    value={editCropType}
                    onChangeText={setEditCropType}
                  />

                  <View style={styles.row}>
                    <View style={[styles.column, { marginRight: 10 }]}>
                      <Text style={styles.inputLabel}>Allocated Area</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={editAllocatedArea}
                        onChangeText={setEditAllocatedArea}
                      />
                    </View>

                    <View style={styles.column}>
                      <Text style={styles.inputLabel}>Area Unit</Text>
                      <View style={styles.unitSelector}>
                        {['ACRE', 'HECTARE', 'BIGHAS', 'GUNTHAS'].map((unit) => (
                          <TouchableOpacity
                            key={unit}
                            style={[
                              styles.unitBtn,
                              editAllocatedAreaUnit === unit && styles.unitBtnSelected,
                            ]}
                            onPress={() => setEditAllocatedAreaUnit(unit)}
                          >
                            <Text
                              style={[
                                styles.unitBtnText,
                                editAllocatedAreaUnit === unit && styles.unitBtnTextSelected,
                              ]}
                            >
                              {unit.substring(0, 4)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  <Text style={styles.inputLabel}>Season Name</Text>
                  <TextInput
                    style={styles.input}
                    value={editSeasonName}
                    onChangeText={setEditSeasonName}
                  />

                  <View style={styles.row}>
                    <View style={[styles.column, { marginRight: 10 }]}>
                      <Text style={styles.inputLabel}>Started On Date</Text>
                      <TouchableOpacity 
                        style={styles.selectorRow} 
                        onPress={() => {
                          setCalendarTarget('editStart');
                          setCalendarTitle('Select Started On Date');
                          setCalendarVisible(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.selectorText, editStartedOn ? styles.selectorTextSelected : null]}>
                          {editStartedOn ? formatDisplayDate(editStartedOn) : 'Select Date'}
                        </Text>
                        <Ionicons name="calendar-outline" size={18} color="#64748b" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.column}>
                      <Text style={styles.inputLabel}>Expected Harvest Date</Text>
                      <TouchableOpacity 
                        style={styles.selectorRow} 
                        onPress={() => {
                          setCalendarTarget('editExpected');
                          setCalendarTitle('Select Expected Harvest Date');
                          setCalendarVisible(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.selectorText, editExpectedHarvestOn ? styles.selectorTextSelected : null]}>
                          {editExpectedHarvestOn ? formatDisplayDate(editExpectedHarvestOn) : 'Select Date'}
                        </Text>
                        <Ionicons name="calendar-outline" size={18} color="#64748b" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.inputLabel}>Status</Text>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setShowEditCycleStatusDropdown(!showEditCycleStatusDropdown)}
                  >
                    <Text style={styles.dropdownTriggerText}>
                      {editCycleStatus === 'active' ? 'Active' : editCycleStatus === 'harvested' ? 'Harvested' : editCycleStatus}
                    </Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>

                  {showEditCycleStatusDropdown && (
                    <View style={styles.dropdownList}>
                      {['active', 'harvested'].map((st) => (
                        <TouchableOpacity
                          key={st}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setEditCycleStatus(st);
                            setShowEditCycleStatusDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>
                            {st === 'active' ? 'Active' : 'Harvested'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Harvest Yield */}
                  {editCycleStatus === 'harvested' && (
                    <>
                      <Text style={styles.inputLabel}>Actual Harvest Date</Text>
                      <TouchableOpacity 
                        style={styles.selectorRow} 
                        onPress={() => {
                          setCalendarTarget('editActual');
                          setCalendarTitle('Select Actual Harvest Date');
                          setCalendarVisible(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.selectorText, editActualHarvestOn ? styles.selectorTextSelected : null]}>
                          {editActualHarvestOn ? formatDisplayDate(editActualHarvestOn) : 'Select Actual Harvest Date'}
                        </Text>
                        <Ionicons name="calendar-outline" size={18} color="#64748b" />
                      </TouchableOpacity>

                      <View style={styles.row}>
                        <View style={[styles.column, { marginRight: 10 }]}>
                          <Text style={styles.inputLabel}>Harvest Yield Amount</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="e.g. 450"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            value={editHarvestAmount}
                            onChangeText={setEditHarvestAmount}
                          />
                        </View>
                        <View style={styles.column}>
                          <Text style={styles.inputLabel}>Harvest Unit</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="e.g. KG, TONNES"
                            placeholderTextColor="#94a3b8"
                            value={editHarvestUnit}
                            onChangeText={setEditHarvestUnit}
                          />
                        </View>
                      </View>
                    </>
                  )}

                  <Text style={styles.inputLabel}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={editCycleNotes}
                    onChangeText={setEditCycleNotes}
                    multiline
                    numberOfLines={3}
                  />

                  <View style={styles.modalActions}>
                    <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsEditingCycle(false)} disabled={updatingCycle}>
                      <Text style={styles.cancelBtnText}>Back to View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleUpdateCycle} disabled={updatingCycle}>
                      {updatingCycle ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.detailsView}>
                  <View style={styles.detailCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Crop Name:</Text>
                      <Text style={styles.detailValue}>{selectedCycle?.crop_name || selectedCycle?.crop_type || 'Unknown Crop'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Allocated Area:</Text>
                      <Text style={styles.detailValue}>{selectedCycle?.allocated_area} {selectedCycle?.allocated_area_unit}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status:</Text>
                      <Text style={[styles.detailValue, {
                        color: selectedCycle?.status?.toLowerCase() === 'active' ? '#16a34a' : selectedCycle?.status?.toLowerCase() === 'harvested' ? '#0284c7' : '#dc2626',
                        fontWeight: 'bold',
                      }]}>
                        {selectedCycle?.status ? selectedCycle.status.charAt(0).toUpperCase() + selectedCycle.status.slice(1).toLowerCase() : ''}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Season:</Text>
                      <Text style={styles.detailValue}>{selectedCycle?.season_name || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Started On:</Text>
                      <Text style={styles.detailValue}>{selectedCycle?.started_on ? selectedCycle.started_on.split('T')[0] : 'N/A'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Expected Harvest:</Text>
                      <Text style={styles.detailValue}>{selectedCycle?.expected_harvest_on ? selectedCycle.expected_harvest_on.split('T')[0] : 'N/A'}</Text>
                    </View>

                    {selectedCycle?.status?.toLowerCase() === 'harvested' && (
                      <>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Actual Harvest Date:</Text>
                          <Text style={styles.detailValue}>{selectedCycle?.actual_harvest_on ? selectedCycle.actual_harvest_on.split('T')[0] : 'N/A'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Harvest Yield:</Text>
                          <Text style={styles.detailValue}>{selectedCycle?.harvest_amount} {selectedCycle?.harvest_unit || ''}</Text>
                        </View>
                      </>
                    )}

                    {selectedCycle?.notes ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.detailLabel, { marginBottom: 4 }]}>Notes:</Text>
                        <Text style={[styles.detailValue, { fontWeight: 'normal', color: '#475569' }]}>{selectedCycle.notes}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={[styles.modalActions, { gap: 10 }]}>
                    <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn, { backgroundColor: '#fee2e2' }]} onPress={() => selectedCycle && handleDeleteCycle(selectedCycle)}>
                      <Text style={[styles.cancelBtnText, { color: '#dc2626' }]}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={() => setIsEditingCycle(true)}>
                      <Text style={styles.saveBtnText}>Edit Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Expense Detail & Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={expenseDetailVisible}
        onRequestClose={() => setExpenseDetailVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <CalendarOverlay
              visible={calendarVisible && calendarTarget === 'editExpense'}
              value={editExpenseDate}
              onClose={() => setCalendarVisible(false)}
              onSelect={handleSelectCalendarDate}
              title={calendarTitle}
            />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {isEditingExpense ? 'Manage Expense' : 'Expense Details'}
                </Text>
                <TouchableOpacity onPress={() => setExpenseDetailVisible(false)}>
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {isEditingExpense ? (
                <View>
                  <Text style={styles.inputLabel}>Associate Crop Cycle (Optional)</Text>
                  <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setShowEditCycleDropdown(!showEditCycleDropdown)}>
                    <Text style={styles.dropdownTriggerText}>{editSelectedCycleName}</Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>

                  {showEditCycleDropdown && (
                    <View style={styles.dropdownList}>
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setEditSelectedCycleId('');
                          setShowEditCycleDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: '#94a3b8' }]}>None (General Farm Expense)</Text>
                      </TouchableOpacity>
                      {cycles.map((c) => (
                        <TouchableOpacity
                          key={c.ulid || c.id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setEditSelectedCycleId((c.ulid || c.id!).toString());
                            setShowEditCycleDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{c.crop_name || c.crop_type} ({c.season_name})</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.inputLabel}>Expense Category</Text>
                  <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setShowEditCategoryDropdown(!showEditCategoryDropdown)}>
                    <Text style={styles.dropdownTriggerText}>{editExpenseCategory}</Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>

                  {showEditCategoryDropdown && (
                    <View style={styles.dropdownList}>
                      {categories.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setEditExpenseCategory(cat);
                            setShowEditCategoryDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{cat}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.inputLabel}>Amount (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={editExpenseAmount}
                    onChangeText={setEditExpenseAmount}
                    keyboardType="numeric"
                  />

                  <Text style={styles.inputLabel}>Payment Method</Text>
                  <View style={styles.tabSelector}>
                    {['Cash', 'Bank', 'Card'].map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[styles.tabBtn, editPaymentMethod === method && styles.tabBtnSelected]}
                        onPress={() => setEditPaymentMethod(method)}
                      >
                        <Text style={[styles.tabBtnText, editPaymentMethod === method && styles.tabBtnTextSelected]}>{method}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Payment Status</Text>
                  <View style={styles.tabSelector}>
                    {['PAID', 'UNPAID'].map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[styles.tabBtn, editPaymentStatus === status && (status === 'PAID' ? styles.tabPaidSelected : styles.tabUnpaidSelected)]}
                        onPress={() => setEditPaymentStatus(status)}
                      >
                        <Text style={[styles.tabBtnText, editPaymentStatus === status && styles.tabBtnTextSelected]}>{status}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Expense Date</Text>
                  <TouchableOpacity 
                    style={styles.selectorRow} 
                    onPress={() => {
                      setCalendarTarget('editExpense');
                      setCalendarTitle('Select Expense Date');
                      setCalendarVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.selectorText, editExpenseDate ? styles.selectorTextSelected : null]}>
                      {editExpenseDate ? formatDisplayDate(editExpenseDate) : 'Select Expense Date'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color="#64748b" />
                  </TouchableOpacity>

                  <Text style={styles.inputLabel}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={editExpenseNotes}
                    onChangeText={setEditExpenseNotes}
                    multiline
                    numberOfLines={3}
                  />

                  <View style={styles.modalActions}>
                    <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsEditingExpense(false)} disabled={updatingExpense}>
                      <Text style={styles.cancelBtnText}>Back to View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleUpdateExpense} disabled={updatingExpense}>
                      {updatingExpense ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.detailsView}>
                  <View style={styles.detailCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Category:</Text>
                      <Text style={styles.detailValue}>{selectedExpense?.expense_category}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Amount:</Text>
                      <Text style={[styles.detailValue, { color: selectedExpense?.payment_status === 'PAID' ? '#16a34a' : '#dc2626' }]}>
                        ₹{parseFloat(selectedExpense?.amount as string || '0').toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Crop Cycle:</Text>
                      <Text style={styles.detailValue}>
                        {(() => {
                          const c = cycles.find(cy => (cy.ulid === selectedExpense?.crop_cycle_id || cy.id === selectedExpense?.crop_cycle_id));
                          return c ? (c.crop_name || c.crop_type || 'Unknown Crop') : 'General Expense';
                        })()}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Payment Method:</Text>
                      <Text style={styles.detailValue}>{selectedExpense?.payment_method}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Payment Status:</Text>
                      <Text style={[
                        styles.detailValue,
                        {
                          color: selectedExpense?.payment_status === 'PAID' ? '#16a34a' : '#dc2626',
                          fontWeight: 'bold',
                        }
                      ]}>
                        {selectedExpense?.payment_status}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Expense Date:</Text>
                      <Text style={styles.detailValue}>
                        {selectedExpense?.date ? selectedExpense.date.split('T')[0] : 'N/A'}
                      </Text>
                    </View>

                    {selectedExpense?.notes ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.detailLabel, { marginBottom: 4 }]}>Notes:</Text>
                        <Text style={[styles.detailValue, { fontWeight: 'normal', color: '#475569' }]}>
                          {selectedExpense.notes}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={[styles.modalActions, { gap: 10 }]}>
                    <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn, { backgroundColor: '#fee2e2' }]} onPress={() => selectedExpense && handleDeleteExpense(selectedExpense)}>
                      <Text style={[styles.cancelBtnText, { color: '#dc2626' }]}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={() => setIsEditingExpense(true)}>
                      <Text style={styles.saveBtnText}>Edit Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748b',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 20,
  },
  inputErrorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 10,
    fontWeight: '500',
  },
  backBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#16a34a',
  },
  backBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  navBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  navTitleGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  navbarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  navbarSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  statusDotInactive: {
    backgroundColor: '#dc2626',
  },
  scrollContent: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d9e6d8',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 6,
  },
  statUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#0f766e', // Matches teal active color from PWA
  },
  tabContent: {
    paddingBottom: 40,
  },
  tabHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  tabTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  addInlineBtn: {
    backgroundColor: '#edf3e7',
    borderWidth: 1,
    borderColor: '#d9e6d8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addInlineBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2f8b43',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  plotCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981', // green vertical bar
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  plotCardInactive: {
    borderColor: '#e2e8f0',
    borderLeftColor: '#94a3b8',
    opacity: 0.85,
  },
  plotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cropIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cropImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
  },
  cropTitleContainer: {
    flex: 1,
  },
  cropTitleText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  cropSubtitleText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  screenshotStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#94a3b8',
    backgroundColor: '#f1f5f9',
  },
  screenshotStatusBadgeActive: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  screenshotStatusBadgeCompleted: {
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
  },
  screenshotStatusBadgeCancelled: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  screenshotStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  screenshotStatusTextActive: {
    color: '#166534',
  },
  screenshotStatusTextCompleted: {
    color: '#0369a1',
  },
  screenshotStatusTextCancelled: {
    color: '#b91c1c',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  infoBadgeContainer: {
    gap: 8,
    marginBottom: 16,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  infoBadgeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginRight: 8,
  },
  infoBadgeValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillActive: {
    backgroundColor: '#e8f5e9',
  },
  statusPillCompleted: {
    backgroundColor: '#e0f2fe',
  },
  statusPillCancelled: {
    backgroundColor: '#fee2e2',
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  statusTextActive: {
    color: '#16a34a',
  },
  statusTextCompleted: {
    color: '#0369a1',
  },
  statusTextCancelled: {
    color: '#b91c1c',
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  pill: {
    backgroundColor: '#f4f7ef',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  pillValue: {
    fontSize: 10,
    fontWeight: '800',
    color: '#27352d',
  },
  notesBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#16a34a',
  },
  notesText: {
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
  },
  cardActionIcon: {
    marginRight: 6,
  },
  rupeeIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    marginRight: 6,
  },
  cardActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardActionIconBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardMeta: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 4,
  },
  expenseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d9e6d8',
  },
  expenseCardUnpaid: {
    borderColor: '#fecaca',
    backgroundColor: '#fffdfd',
  },
  expenseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  expenseTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  expenseSubtext: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  expenseAmountText: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  amountPaid: {
    color: '#0f172a',
  },
  amountUnpaid: {
    color: '#dc2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  multilineInput: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
  },
  unitSelector: {
    flexDirection: 'row',
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  unitBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  unitBtnSelected: {
    backgroundColor: '#16a34a',
  },
  unitBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  unitBtnTextSelected: {
    color: '#ffffff',
  },
  dropdownTrigger: {
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownTriggerText: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '600',
  },
  dropdownArrow: {
    fontSize: 11,
    color: '#64748b',
  },
  dropdownList: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginTop: 5,
    maxHeight: 150,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  dropdownEmptyText: {
    padding: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
    fontSize: 14,
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  tabSelector: {
    flexDirection: 'row',
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  tabBtnSelected: {
    backgroundColor: '#16a34a',
  },
  tabPaidSelected: {
    backgroundColor: '#16a34a',
  },
  tabUnpaidSelected: {
    backgroundColor: '#dc2626',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  tabBtnTextSelected: {
    color: '#ffffff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f1f5f9',
    marginRight: 12,
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#16a34a',
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  detailsView: {
    width: '100%',
  },
  detailCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  areaInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    height: 48,
    marginBottom: 14,
    overflow: 'hidden',
  },
  areaInputField: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  areaUnitDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#cbd5e1',
  },
  areaUnitTextContainer: {
    paddingHorizontal: 16,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  areaUnitText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  inputErrorBorder: {
    borderColor: '#ef4444',
    borderWidth: 1.5,
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheetContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    minHeight: '50%',
    padding: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  closeBtnCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  sheetSearchIcon: {
    marginRight: 8,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    height: '100%',
  },
  sheetList: {
    flex: 1,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sheetItemActive: {
    borderBottomColor: '#bbf7d0',
  },
  sheetItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  sheetItemTextActive: {
    color: '#16a34a',
    fontWeight: '800',
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    height: 48,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  selectorText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  selectorTextSelected: {
    color: '#0f172a',
    fontWeight: '600',
  },
  sheetOverlayContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    zIndex: 999,
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarModalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  calendarCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: '#f4f7ef',
    borderRadius: 12,
    padding: 8,
  },
  navBtn: {
    padding: 6,
  },
  monthText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#27352d',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 6,
  },
  weekdayLabel: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  daysGrid: {
    gap: 4,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: '#16a34a',
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  dayCellTextSelected: {
    color: '#ffffff',
  },
  dayCellToday: {
    backgroundColor: '#eef7f2',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  dayCellTextToday: {
    color: '#16a34a',
    fontWeight: '800',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#16a34a',
    position: 'absolute',
    bottom: 3,
  },
  emptyDayCell: {
    width: 36,
    height: 36,
  },
  headerDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerDropdownActive: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  pickerOverlayList: {
    flex: 1,
    marginTop: 8,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  pickerGridItem: {
    width: '30%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pickerGridItemActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  pickerGridItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  pickerGridItemTextActive: {
    color: '#ffffff',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  miniStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: '#16a34a',
  },
  miniStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 16,
    gap: 8,
  },
  infoCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
});
