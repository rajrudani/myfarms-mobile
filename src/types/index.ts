export interface PaginationMeta {
  current_page: number;
  from: number | null;
  last_page: number;
  path?: string;
  per_page: number;
  to: number | null;
  total: number;
}

export interface PaginationLinks {
  first?: string | null;
  last?: string | null;
  prev?: string | null;
  next?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  links?: PaginationLinks;
  meta?: PaginationMeta;
}

export interface User {
  id: number | string;
  ulid?: string;
  name: string;
  email: string;
  username?: string | null;
  user_type?: 'admin' | 'farm_group' | 'farm_staff' | string;
  roles?: string[];
  farm_group_id?: string | number;
  farm_group_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Farm {
  id?: string | number; // Local ID if database ID is numeric, or ULID
  ulid?: string;
  farm_group_id?: string | number;
  name: string;
  area: number | string;
  area_unit: 'ACRE' | 'HECTARE' | 'BIGHAS' | 'GUNTHAS' | string;
  location?: string;
  is_active: boolean;
  active_cycles_count?: number;
  assigned_staff_count?: number;
  staff?: any[];
  activities?: any[];
  expenses?: any[];
  created_at?: string;
  updated_at?: string;
}

export interface CropCycle {
  id?: string | number;
  ulid?: string;
  farm_id: string | number;
  crop_id?: string | number;
  crop_type?: string;
  crop_name?: string;
  allocated_area: number | string;
  allocated_area_unit: 'ACRE' | 'HECTARE' | 'BIGHAS' | 'GUNTHAS' | string;
  season_name?: string;
  started_on: string; // ISO date string
  expected_harvest_on?: string; // ISO date string
  actual_harvest_on?: string; // ISO date string
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | string;
  harvest_amount?: number | string;
  harvest_unit?: string;
  notes?: string;
  crop_details?: {
    image_url?: string | null;
    [key: string]: any;
  } | null;
  created_at?: string;
  updated_at?: string;
  farm?: Farm;
}

export interface FarmExpense {
  id?: string | number;
  ulid?: string;
  farm_id: string | number;
  farm_name?: string;
  crop_cycle_id?: string | number | null;
  crop_cycle_name?: string | null;
  expense_master_id?: string | number;
  expense_name?: string;
  date: string; // ISO date string
  expense_category: string;
  amount: number | string;
  payment_method: string;
  payment_status: 'PAID' | 'UNPAID' | 'PARTIALLY_PAID' | 'completed' | 'pending' | 'partial' | string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  farm?: Farm;
  crop_cycle?: CropCycle;
  activities?: any[];
}

export interface LoginResponse {
  token: string;
  user: User;
}

// Staff Management Types

export type StaffRoleValue = 'Owner' | 'Manager' | 'Worker' | 'Consultant';
export type StaffRoleColor = 'primary' | 'info' | 'danger' | 'success' | 'secondary';

export interface StaffRole {
  value: StaffRoleValue;
  label: string;
  color: StaffRoleColor;
}

export interface StaffMember {
  id: number;
  ulid: string;
  name: string;
  phone?: string;
  username?: string;
  email?: string;
  profile_photo_url?: string;
  is_active: boolean;
  roles: StaffRole[];
  farms: {
    id: number;
    ulid?: string;
    name: string;
    location?: string;
    area_label?: string;
    is_active: boolean;
  }[];
  family_head?: {
    id: number;
    ulid: string;
    name: string;
  } | null;
  family_members?: {
    id: number;
    ulid: string;
    name: string;
    photo_url?: string;
    is_head: boolean;
  }[];
  attendance_stats?: {
    present_count: number;
    half_day_count: number;
    absent_count: number;
  };
  payment_stats?: {
    current_paid: number;
    month_paid: number;
    lifetime_paid: number;
    last_payment_date?: string | null;
  };
  created_at?: string;
  updated_at?: string;
}

export interface StaffAttendance {
  id: number;
  ulid: string;
  farm_staff_id: number;
  farm_id?: number | null;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'half_day';
  check_in?: string | null;
  check_out?: string | null;
  notes?: string | null;
  staff?: {
    id: number;
    ulid: string;
    name: string;
  } | null;
  farm?: {
    id: number;
    ulid: string;
    name: string;
  } | null;
}

export interface StaffPayment {
  id: number;
  ulid: string;
  farm_staff_id: number;
  amount: number;
  date: string; // YYYY-MM-DD
  payment_method: 'cash' | 'google_pay' | 'phonepe' | 'other_upi' | 'bank_transfer';
  payment_type?: 'daily_expense' | 'other' | string;
  notes?: string | null;
  is_settled: boolean;
  settlement_id?: number | string | null;
  given_by?: {
    id: number;
    name: string;
  } | null;
  staff?: {
    id: number;
    ulid: string;
    name: string;
    role_label?: string | null;
    email?: string | null;
    farm_name?: string | null;
    profile_photo_url?: string | null;
  } | null;
  created_at?: string;
  updated_at?: string;
}

// Note & Reminder Types
export type NoteReminderStatus = 'active' | 'inactive' | 'overdue' | 'completed';

export interface NoteReminder {
  id: number | string;
  ulid: string;
  title: string;
  details?: string | null;
  attachment_path?: string | null;
  attachment_url?: string | null;
  notify_enabled: boolean;
  notify_at?: string | null; // ISO Date String
  status: NoteReminderStatus;
  is_overdue?: boolean;
  completed_at?: string | null; // ISO Date String
  creator_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateNoteReminderPayload {
  title: string;
  details?: string;
  notify_enabled: boolean;
  notify_at?: string | null;
  status?: NoteReminderStatus;
  attachment_path?: string | null;
}

export interface UpdateNoteReminderPayload {
  title?: string;
  details?: string;
  notify_enabled?: boolean;
  notify_at?: string | null;
  status?: NoteReminderStatus;
  attachment_path?: string | null;
}

// Consultant Visit Types
export interface ConsultantVisit {
  id: number | string;
  ulid: string;
  farm_id: number | string;
  consultant_id: number | string;
  visit_date: string; // YYYY-MM-DD
  notes?: string | null;
  is_active: boolean;
  attachment_file_path?: string | null;
  attachment_file_url?: string | null;
  created_at?: string;
  updated_at?: string;
  farm?: {
    id: number | string;
    name: string;
  } | null;
  consultant?: {
    id: number | string;
    name: string;
  } | null;
  crop_cycles?: {
    id: number | string;
    crop_name: string;
    season_name?: string | null;
  }[];
}

export interface CreateConsultantVisitPayload {
  farm_id: number | string;
  consultant_id: number | string;
  visit_date: string;
  notes?: string;
  is_active: boolean;
  attachment_file_path?: string | null;
  crop_cycle_ids?: (number | string)[];
}

export interface UpdateConsultantVisitPayload {
  farm_id?: number | string;
  consultant_id?: number | string;
  visit_date?: string;
  notes?: string;
  is_active?: boolean;
  attachment_file_path?: string | null;
  crop_cycle_ids?: (number | string)[];
}

// Agro Shop Types
export interface AgroShop {
  id: number | string;
  ulid: string;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active: boolean;
  summary?: {
    total_purchase: number;
    total_paid: number;
    balance: number;
  };
  created_at?: string;
  updated_at?: string;
}

export interface AgroInputProduct {
  id: number | string;
  ulid: string;
  name: string;
  name_gu?: string | null;
  name_hi?: string | null;
  type: string;
  brand?: string | null;
  category?: string | null;
  formulation?: string | null;
  notes?: string | null;
  is_active: boolean;
}

export interface AgroShopPurchaseItem {
  id: number | string;
  agro_input_product_id: number | string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
}

export interface AgroShopPurchase {
  id: number | string;
  ulid: string;
  agro_shop_id: number | string;
  date: string; // YYYY-MM-DD
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: 'completed' | 'partial' | 'pending';
  bill_photo_path?: string | null;
  bill_photo_url?: string | null;
  notes?: string | null;
  items: AgroShopPurchaseItem[];
  created_at?: string;
  updated_at?: string;
}

export interface AgroShopPayment {
  id: number | string;
  ulid: string;
  agro_shop_id: number | string;
  agro_shop_purchase_id?: number | string | null;
  date: string; // YYYY-MM-DD
  amount: number;
  payment_method: 'cash' | 'google_pay' | 'phonepe' | 'other_upi' | 'bank_transfer' | string;
  notes?: string | null;
  purchase_ulid?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Sale Types
export interface SaleChargeItem {
  id?: number | string;
  charge_name: string;
  type: 'flat' | 'percentage' | string;
  value: number;
  applies_on: 'gross' | 'final' | string;
}

export interface Sale {
  id: number | string;
  ulid: string;
  farm_id: number | string;
  crop_cycle_id: number | string;
  crop_id: number | string;
  buyer_id?: number | string | null;
  buyer_name: string;
  date: string; // YYYY-MM-DD
  has_grades: boolean;
  total_quantity: number;
  quantity_unit: string;
  rate: number;
  gross_total: number;
  charges_total: number;
  final_amount: number;
  notes?: string | null;
  bill_photo_path?: string | null;
  bill_photo_url?: string | null;
  created_at?: string;
  updated_at?: string;
  farm?: {
    id: number | string;
    name: string;
  } | null;
  crop?: {
    id: number | string;
    name: string;
  } | null;
  crop_cycle?: {
    id: number | string;
    crop_name: string;
    season_name?: string | null;
  } | null;
  charges?: SaleChargeItem[];
}

export interface CreateSalePayload {
  farm_id: number | string;
  crop_cycle_id: number | string;
  crop_id?: number | string;
  buyer_id?: number | string | null;
  buyer_name?: string;
  date: string;
  total_quantity: number;
  quantity_unit: string;
  rate: number;
  notes?: string;
  bill_photo_path?: string | null;
  charges?: SaleChargeItem[];
}

// Masters Types
export interface Crop {
  id: number | string;
  ulid: string;
  name: string;
  name_gu?: string | null;
  name_hi?: string | null;
  category: string;
  unit: string;
  is_perennial: boolean;
  is_active: boolean;
  image_url?: string | null;
}

export interface Buyer {
  id: number | string;
  ulid: string;
  name: string;
  phone?: string | null;
  company_name?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active: boolean;
}

export interface FarmActivityMaster {
  id: number | string;
  ulid: string;
  farm_group_id?: number | string | null;
  name: string;
  name_gu?: string | null;
  name_hi?: string | null;
  is_active: boolean;
  notes?: string | null;
  fields?: any[];
}

export interface FarmActivity {
  id?: string | number;
  ulid?: string;
  farm_id: string | number;
  farm_name?: string;
  crop_cycle_id?: string | number | null;
  crop_cycle_name?: string | null;
  farm_activity_master_id: string | number;
  date: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | string;
  notes?: string;
  activity_type?: string;
  details_json?: any;
  farm_activity_master?: FarmActivityMaster;
  farm?: Farm;
  crop_cycle?: CropCycle;
  expenses?: any[];
  created_at?: string;
  updated_at?: string;
}

// Reports Types
export interface ReportFiltersData {
  farms: { id: number | string; name: string }[];
  workers: { id: number | string; ulid: string; name: string }[];
  crop_cycles: { id: number | string; ulid: string; farm_id: number | string; label: string }[];
}

export interface AttendanceReportRow {
  id: number | string;
  date: string;
  staff_name: string;
  farm_name: string;
  status: string;
  notes?: string | null;
}

export interface AttendanceReportResponse {
  rows: AttendanceReportRow[];
  summary: {
    present: number;
    half_day: number;
    absent: number;
    total_attendance: number;
  };
}

export interface PaymentReportRow {
  id: number | string;
  date: string;
  amount: number;
  payment_method: string;
  given_by: string;
  notes?: string | null;
}

export interface PaymentReportResponse {
  rows: PaymentReportRow[];
  summary: {
    total_amount: number;
  };
}

export interface ActivityReportRow {
  id: number | string;
  date: string;
  activity: string;
  cycle: string;
  status: string;
  notes?: string | null;
}

export interface ActivityReportResponse {
  rows: ActivityReportRow[];
  summary: {
    total: number;
    completed: number;
    open: number;
  };
}

export interface ExpenseReportRow {
  id: number | string;
  date: string;
  category: string;
  cycle: string;
  amount: number;
  payment_status: string;
  payment_method: string;
  notes?: string | null;
}

export interface ExpenseReportResponse {
  rows: ExpenseReportRow[];
  summary: {
    total_spend: number;
    entries_count: number;
    completed_amount: number;
  };
}

// Dashboard Summary Types
export interface DashboardReminderItem {
  id: number | string;
  ulid: string;
  title: string;
  time: string;
  notify_at?: string | null;
  status: string;
  is_overdue?: boolean;
}

export interface DashboardActivityItem {
  id: number | string;
  ulid: string;
  name: string;
  farm_name: string;
  crop_name?: string | null;
  date: string;
  status: string;
}

export interface DashboardCounts {
  farms_count: number;
  active_crop_cycles_count: number;
  active_staff_count: number;
  pending_reminders_count: number;
}

export interface DashboardSummary {
  today_date: string;
  today_reminders: DashboardReminderItem[];
  today_activities: DashboardActivityItem[];
  counts: DashboardCounts;
  needs_farm_reminder: boolean;
  needs_staff_reminder: boolean;
  user?: {
    id: number | string;
    name: string;
    email?: string | null;
    role: string;
  };
}

// Daily Crop Price Types
export interface DailyCropPrice {
  id: number | string;
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety?: string | null;
  grade?: string | null;
  arrival_date: string;
  min_price: number;
  max_price: number;
  modal_price: number;
}

export interface DailyCropPriceMeta {
  states: string[];
  districts: string[];
  default_state: string;
}

// Upload Types
export interface UploadResponse {
  data: {
    path: string;
    url: string;
    name?: string;
    size?: number;
    mime_type?: string;
  };
  message: string;
}

// Global Dashboard Search Types
export interface DashboardSearchResultItem {
  id: number | string;
  ulid: string;
  title: string;
  meta: string;
  type: 'farm' | 'sale' | 'purchase' | 'payment' | 'staff' | 'note' | 'visit' | 'shop';
  status_label?: string;
  status_color?: 'success' | 'danger' | 'warning' | 'info';
  shop_ulid?: string;
}

export interface DashboardSearchCategory {
  label: string;
  type: string;
  icon: string;
  items: DashboardSearchResultItem[];
}

export interface DashboardSearchResponse {
  query: string;
  results: DashboardSearchCategory[];
}

