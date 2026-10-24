# MyFarms Mobile App — Development & Architecture Guidelines

## 1. Project Overview & Workspace Context

The **MyFarms** agricultural management platform consists of two closely interrelated projects located under the workspace directory `/Users/alphaobsllp/Projects/myfarms/`:

1. **`myfarmsapp/` (Adjacent Repository — `../myfarmsapp`)**:
   - The central **Laravel 12 + Filament 3** backend and Web/PWA system.
   - Houses the database, Eloquent models, migrations, business logic, multi-tenant scoping (`farm_group_id`), role-based permissions (`Spatie Permission`), and Sanctum token authentication.
   - **Central API Provider**: Exposes all RESTful endpoints under `/api/*` used by this mobile app.
2. **`myfarmsapp-mobile/` (This Repository)**:
   - Cross-platform native mobile application for **iOS** and **Android**.
   - Built with **React Native (0.85)**, **Expo SDK 56**, **Expo Router (File-based Routing)**, and **TypeScript**.
   - Built specifically for on-site farm managers and operational staff.

---

## 2. Core Development Rules: Interrelation with `myfarmsapp`

> [!IMPORTANT]
> **`myfarmsapp-mobile` and `myfarmsapp` are deeply interrelated twin systems.**
> Follow these two fundamental development rules at all times:

### Rule 1: Get Reference from `myfarmsapp` for Mobile Development
- **`myfarmsapp` is the single source of truth** for all business rules, workflows, validation rules, field definitions, permissions, and calculations.
- **Before and during development of any screen or feature in `myfarmsapp-mobile`, always reference `myfarmsapp`**:
  - **PWA UI & Workflows**: Inspect the corresponding Filament resource or page in `../myfarmsapp/app/Filament/FarmStaff/` (forms, tables, actions, filters, modals).
  - **Data Models & Relationships**: Inspect `../myfarmsapp/app/Models/` to understand foreign keys, ULID identifiers, casts, and relations.
  - **Database Schema**: Check `../myfarmsapp/database/migrations/` for exact column types, default values, and nullable constraints.
  - **Permissions & Roles**: Check Spatie role/permission requirements in `../myfarmsapp/database/seeders/` and policies.
- Every feature must maintain **100% functional parity** with the Farm Staff PWA. Never invent alternate business rules or omit fields present in the PWA.

### Rule 2: Add and Maintain APIs in `myfarmsapp`
- **To add new APIs or update existing endpoints for this mobile app, always use `myfarmsapp`**:
  - Routes: `../myfarmsapp/routes/api.php`
  - Controllers: `../myfarmsapp/app/Http/Controllers/Api/*`
  - Resources / Transformations: `../myfarmsapp/app/Http/Resources/*`
  - Validation: `../myfarmsapp/app/Http/Requests/*` or controller validation
- **Backend API Standards Required**:
  - **Multi-Tenant Isolation**: Every query must scope to `$actor->farm_group_id` (zero IDOR vulnerabilities).
  - **Sanctum Authentication**: Protected under `auth:sanctum` middleware with token ability checks.
  - **Standard Pagination**: All listing endpoints must return standardized `data` + `links` + `meta` envelopes (`LengthAwarePaginator`).
  - **Atomic Transactions**: Multi-record mutations (purchases, payments, sales) must run inside `DB::transaction`.
- Once an API is added or updated in `myfarmsapp`, mirror the contract in `src/types/index.ts` and add API calls in `src/api/*`.

---

## 3. Functional Parity Matrix (Mobile Screen ➔ PWA Reference ➔ API)

When developing or updating any screen in this mobile app, use this matrix to locate the corresponding PWA reference and backend API in `myfarmsapp`:

| Mobile Screen (`app/`) | PWA Reference in `myfarmsapp` (`../myfarmsapp/app/Filament/FarmStaff/`) | Backend API in `myfarmsapp` (`../myfarmsapp/routes/api.php`) | Description / Parity Scope |
| :--- | :--- | :--- | :--- |
| `(auth)/login.tsx` | `app/Filament/Auth/FarmStaffLogin.php` | `POST /api/login`, `GET /api/me`, `POST /api/logout` | Mobile/email login with password, Sanctum token issue, account active check |
| `(tabs)/index.tsx` | `Pages/Dashboard.php`, `Widgets/*` | `GET /api/dashboard`, `/api/note-reminders`, `/api/daily-crop-prices` | Dashboard summary cards, active tasks, reminders, and mandi crop price tickers |
| `(tabs)/farm.tsx`, `farm-hub.tsx`, `farm-view.tsx` | `Pages/FarmList.php`, `FarmHub.php`, `ViewFarm.php` | `apiResource('farms', FarmController)` | Farm list, farm hub navigation, plot details, active crop cycle overview |
| `crop-cycles.tsx` | `Resources/CropCycles/*` | `apiResource('crop-cycles', CropCycleController)` | Sowing, growth stages, harvest tracking, plot cycle transitions |
| `(tabs)/staff.tsx`, `staff-view.tsx` | `Pages/ManageStaff.php`, `ViewStaff.php` | `apiResource('farm-staff', FarmStaffController)`, `/assign-farm`, `/unassign-farm` | Staff directory, daily wages, assigned farms, worker profiles |
| `(tabs)/staff.tsx` (Attendance tab) | `ManageStaff.php` (Attendance Panel), `StaffAttendanceExporter` | `apiResource('staff-attendances', StaffAttendanceController)`, `POST /bulk` | Daily worker attendance marking (present/half-day/absent), date filtering, bulk submit |
| `(tabs)/staff.tsx` (Payments tab), `staff-payment-view.tsx` | `Pages/ViewStaffPayment.php`, `ManageStaff.php` (Payments Panel) | `apiResource('staff-payments', FarmStaffPaymentController)`, `POST /settle-payments` | Wage calculation, advance payments, balance tracking, payment settlement |
| `(tabs)/expenses.tsx` | `Pages/ViewFarmExpense.php` | `apiResource('expenses', FarmExpenseController)` | Farm expense recording, category masters, receipt photo attachments |
| `activities.tsx` | `Pages/ViewFarmActivity.php`, `Resources/FarmActivityMasters` | `apiResource('farm-activities', FarmActivityController)`, `GET /api/activities` | Daily field activities (irrigation, spraying, weeding), status workflow, cycle link |
| `agro-shop.tsx` | `Pages/AgroShopPurchases.php`, `ViewAgroShopPayment.php` | `/api/agro-shops`, `/purchases`, `/payments` | Agro store purchases, itemized inputs (seeds/fertilizers/pesticides), vendor ledgers |
| `sales.tsx` | `Resources/Sales/*` | `apiResource('sales', SaleController)` | Harvest sales, weighment details, rate, deductions, buyer selection, receipt photo |
| `consultant-visits.tsx` | `Resources/ConsultantVisits/*` | `apiResource('consultant-visits', ConsultantVisitController)` | Agronomist / expert visit notes, observations, crop prescriptions, follow-up dates |
| `(tabs)/notes.tsx` | `Resources/NoteReminders/*` | `apiResource('note-reminders', NoteReminderController)`, `PATCH /toggle-status` | Field notes, priority reminders, completion toggle, overdue flags |
| `mandi-prices.tsx` | `Widgets/CropPriceWidget.php` | `GET /api/daily-crop-prices` | Mandi APMC market rates, trends, price comparisons across crops |
| `reports.tsx` | `Pages/Reports.php`, Attendance/Payment/Expense/Activity reports | `GET /api/reports/filters`, `/attendance`, `/payment`, `/activity`, `/expense` | Comprehensive operational analytics, date filters, printable/exportable summaries |
| `crops.tsx`, `agro-input-products.tsx`, `buyers.tsx` | Master Resources in `myfarmsapp` | `GET /api/crops`, `/api/input-products`, `/api/buyers`, `/api/activities` | Master data lookups and management for crops, inputs, and registered buyers |
| `(tabs)/more.tsx` | `components/bottom-nav.blade.php` | Direct navigation | Navigation hub for master data, reports, app settings, and profile logout |

---

## 4. Mobile Architecture & Code Structure

```
myfarmsapp-mobile/
├── app/                      # Expo Router (file-based routing)
│   ├── (auth)/login.tsx      # Authentication screen
│   ├── (tabs)/               # Bottom tab navigation
│   │   ├── index.tsx         # Dashboard / Home
│   │   ├── farm.tsx          # Farm List
│   │   ├── staff.tsx         # Staff, Attendance & Payments hub
│   │   ├── expenses.tsx      # Farm Expenses
│   │   ├── notes.tsx         # Notes & Reminders
│   │   └── more.tsx          # Navigation menu for reports & masters
│   ├── farm-hub.tsx          # Interactive farm management hub
│   ├── farm-view.tsx         # Individual farm details
│   ├── crop-cycles.tsx       # Crop cycle lifecycle
│   ├── staff-view.tsx        # Staff profile & history
│   ├── staff-payment-view.tsx# Staff payment detail & settle modal
│   ├── activities.tsx        # Farm field activities
│   ├── agro-shop.tsx         # Agro shop purchases & payments
│   ├── sales.tsx             # Harvest produce sales
│   ├── consultant-visits.tsx # Agronomist visit observations
│   ├── mandi-prices.tsx      # Market price trends
│   ├── reports.tsx           # Operational reports suite
│   ├── crops.tsx             # Crops master
│   ├── agro-input-products.tsx # Agro inputs master
│   └── buyers.tsx            # Buyers master
├── src/
│   ├── api/                  # API client & domain service modules
│   │   ├── client.ts         # Axios instance, interceptors, error extraction
│   │   ├── auth.ts           # Login, logout, profile
│   │   ├── farm.ts           # Farm & plot endpoints
│   │   ├── staff.ts          # Staff, attendance & payments
│   │   ├── ...               # Other modular API callers
│   ├── components/           # Reusable UI components
│   ├── context/              # React context (AuthContext, etc.)
│   ├── theme/                # Design tokens (Emerald/Amber palette)
│   ├── types/                # TypeScript interfaces & API contracts
│   └── utils/                # Date formatters, currency, image helpers
├── ios/                      # Generated iOS native project
├── app.json                  # Expo project configuration
├── eas.json                  # EAS build configurations
├── package.json              # Dependencies and scripts
└── tsconfig.json             # TypeScript compiler settings
```

---

## 5. Technology Stack & Native Build Requirements

### 5.1 Technology Stack
- **Framework**: React Native `0.85.3` + Expo SDK `~56.0.12` (versioned docs: `https://docs.expo.dev/versions/v56.0.0/`).
- **Routing**: Expo Router `~56.2.11` (Typed Routes enabled).
- **Language**: TypeScript with strict mode.
- **HTTP Client**: Axios with Bearer token interceptor and centralized error parsing.
- **Storage**: `expo-secure-store` for auth tokens and user session.

### 5.2 Native iOS Build & Toolchain Compatibility
- **Xcode & Swift Compatibility**:
  - When building with Apple Swift 6.4+, precompiled binary XCFrameworks from Expo can produce toolchain version mismatch errors (`failed to build module ExpoModulesCore; SDK built with Swift 6.3.1`).
  - **Required setting in `ios/Podfile.properties.json`**:
    ```json
    "EXPO_USE_PRECOMPILED_MODULES": "false"
    ```
    This forces native Expo modules to build from source using the local Xcode Swift toolchain.
- **Swift Macro Plugin**:
  - The bundled binary `node_modules/@expo/expo-modules-macros-plugin/apple/ExpoModulesMacros-tool` must exist with executable permissions (`chmod +x`).
- **Configuration Hygiene**:
  - **Do NOT** add `newArchEnabled` to `app.json` (New Architecture is enabled by default in SDK 56).
  - Use `npm` as the package manager (`package-lock.json`).

### 5.3 Build & Diagnostic Commands
```bash
# Run on iOS simulator
npm run ios
# or
npx expo run:ios

# Start Metro dev server
npm run start

# Validate Expo dependencies and configuration
npx expo-doctor

# Type check TypeScript files
npx tsc --noEmit
```

---

## 6. Networking & API Integration Guidelines

1. **API URL Configuration**:
   - Stored in `.env`: `EXPO_PUBLIC_API_URL` (e.g. `https://myfarms.horizoncode.in/api` or local `http://<IP>:8000/api`).
2. **Centralized Axios Client (`src/api/client.ts`)**:
   - Request Interceptor: Automatically retrieves token from `expo-secure-store` and sets `Authorization: Bearer <token>`.
   - Response Interceptor: Catches `401 Unauthorized`, clears secure store, and triggers clean redirect to `/(auth)/login`.
3. **Standard Pagination Handling**:
   - Backend APIs respond with:
     ```json
     {
       "data": [ ... ],
       "links": { "first": "...", "last": "...", "prev": null, "next": "..." },
       "meta": { "current_page": 1, "last_page": 5, "per_page": 15, "total": 72 }
     }
     ```
   - Always type lists using `PaginatedResponse<T>` from `src/types/index.ts`.
   - Support pull-to-refresh (`page: 1`) and infinite scroll loading (`page + 1` until `current_page >= last_page`).

---

## 7. UI/UX & Ergonomics Standards

- **Theme Palette**: Match the PWA brand colors:
  - Primary Green: Emerald (`#15803d`, `#166534`, `#22c55e`)
  - Accent / Warnings: Amber (`#d97706`, `#f59e0b`, `#fbbf24`)
  - Background & Cards: Slate neutrals (`#f8fafc`, `#ffffff`, `#0f172a`, `#334155`)
- **Safe Area**: Wrap top-level screens in `SafeAreaView` from `react-native-safe-area-context` to safely accommodate Dynamic Island and notches.
- **Keyboard Handling**: Use `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` on all modals and form screens.
- **Mandatory Screen States**:
  1. **Loading**: Render skeleton loaders or centered `ActivityIndicator` spinners.
  2. **Empty State**: Show an illustrative icon, friendly message, and actionable button (e.g. "No crop cycles found. Tap + to create one.").
  3. **Pull-to-Refresh**: Attach `RefreshControl` to every scrollable list and dashboard.
  4. **Error Feedback**: Show clear banners for network failures and inline field validation messages for 422 responses.
