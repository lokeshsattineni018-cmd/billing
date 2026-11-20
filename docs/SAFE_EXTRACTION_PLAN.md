# Safe Frontend Modularization & Extraction Plan
**Project:** VIJAYA DURGA AGENCIES (SRSF Billing System)  
**Branch:** `ui-polish`  
**Scope:** Architectural blueprint for safe, zero-regression modularization of monolithic pages: `Staff.jsx` (2,715 lines), `Reports.jsx` (1,946 lines), and `Settings.jsx` (1,555 lines).

---

## 1. Executive Summary & Policy

### Why Deferred (Do NOT Split Now)
1. **Critical Business Invariants:** These three monolithic components handle direct payroll calculations, tax compliance (GSTR-1 HSN-0306), and credential encryption. Prematurely moving internal state across multiple files without dedicated component harness tests introduces high regression risk.
2. **Bundle Optimization Already Solved:** In Batch 2 (Commit `764cd08`), `Staff.jsx` was already split into on-demand chunks via React `Suspense` and `lazyWithRetry` (`IceTracker`, `WastageTracker`, `DailyNetSummary`, and `StaffAttendanceCalendar`), reducing the active bundle by **80.07 kB (-40.3%)**.
3. **Execution Safety Policy:** Code health extractions must proceed sequentially with automated unit tests for each sub-component *before* extraction, verified against the local test database with zero side effects.

---

## 2. Component Decomposition & Safe Extraction Order

### Part A: `Staff.jsx` (2,715 lines)

#### Current Responsibilities
- Worker Directory (Add, edit, deactivate workers, advance balances)
- Daily Work Tracker (Cutting, grading, packing entries, rates, quantities)
- Bulk Work Entry Modal (Fast grid input, tab navigation, local draft persistence)
- Worker Advance & Loan Management (Issue advance, record wage deduction)
- Printable Payment Slips & Vouchers (`VoucherBillModal`, `WorkerPaymentModal`)

#### Target Modular Structure
```
website/src/
  pages/
    Staff.jsx                          (~180 lines: Tab routing, auth guard)
  components/staff/
    StaffDirectory.jsx                 (~350 lines: Worker cards, search, status)
    WorkerProfileModal.jsx             (~220 lines: Worker edit/create form)
    DailyWorkTracker.jsx               (~400 lines: Work log, filters, pay status)
    BulkWorkEntryModal.jsx             (~450 lines: Grid entry + draft persistence)
    WorkerAdvanceLedger.jsx            (~300 lines: Advance payment & deduction history)
    WorkerStatementModal.jsx           (~280 lines: Thermal/A4 voucher print slip)
  hooks/
    useStaffState.js                   (Shared state: active worker, date range, refresh triggers)
```

#### Safe Extraction Sequence
1. **Phase 1: Extract `useStaffState` Hook**
   - Centralize `selectedDate`, `filterStatus`, `workersList`, `refreshKey`, and offline caching logic into a single custom hook.
   - Verify: zero JSX changes, test with existing monolithic `Staff.jsx`.
2. **Phase 2: Extract `BulkWorkEntryModal`**
   - Self-contained modal with its own `localStorage` draft key (`srsf_bulk_worker_draft`).
   - Add Vitest tests for row addition, calculations, and draft serialization.
3. **Phase 3: Extract `WorkerAdvanceLedger`**
   - Independent ledger tab showing loan payments and balance offsets.
4. **Phase 4: Extract `StaffDirectory` & `WorkerProfileModal`**
   - Worker CRUD operations and status toggles.
5. **Phase 5: Finalize Shell `Staff.jsx`**
   - Reduce root page to a lightweight coordinator mounting tabs inside `<Suspense>` wrappers.

---

### Part B: `Reports.jsx` (1,946 lines)

#### Current Responsibilities
- Period Sales Summary (Gross sales, taxable, CGST, SGST, IGST, net received, balance due)
- Customer Sales Analysis (Per-buyer invoice count, tonnage, revenue, outstanding)
- Count/Grade Prawn Matrix (Breakdown by count: 20, 30, 40, etc., rates, average price)
- GSTR-1 Tax Return Table (B2B, B2C, HSN-0306, export format)
- Document Generation (Period summary PDF, GSTR-1 statement, CSV export triggers)

#### Target Modular Structure
```
website/src/
  pages/
    Reports.jsx                        (~150 lines: Date picker header, active tab switch)
  components/reports/
    PeriodSummaryCard.jsx              (~250 lines: Metric tiles & financial cards)
    CustomerSalesReport.jsx            (~320 lines: Buyer breakdown table + search)
    PrawnGradeMatrix.jsx               (~280 lines: Count/size analysis, volume, rates)
    Gstr1StatementTable.jsx            (~420 lines: B2B/B2C GST breakdown, tax split)
    ReportExportActions.jsx            (~180 lines: Download PDF/CSV with Bearer auth)
  hooks/
    useReportsData.js                  (Fetches period analytics, handles caching & error state)
```

#### Safe Extraction Sequence
1. **Phase 1: Extract `ReportExportActions`**
   - Isolate authenticated blob download handlers for PDF and CSV.
   - Zero UI impact; purely functional export bar.
2. **Phase 2: Extract `PrawnGradeMatrix`**
   - Pure presentation table rendering grouped item statistics.
3. **Phase 3: Extract `CustomerSalesReport`**
   - Customer aggregation table with client-side sort and search.
4. **Phase 4: Extract `Gstr1StatementTable`**
   - Statutory tax table; verify against `backend/tests/unit/gstrFinancialYear.test.js`.
5. **Phase 5: Extract `PeriodSummaryCard` & `useReportsData`**
   - Core KPI tiles and date range state.

---

### Part C: `Settings.jsx` (1,555 lines)

#### Current Responsibilities
- Business & Trade Profile (Legal name, GSTIN, trade address, bank account, UPI QR)
- Invoice Numbering Preferences (Prefixes, padding, starting sequence, terms)
- SMTP Email Dispatch Settings (AES-256-GCM encrypted password, host, test trigger)
- User Account & Role Administration (Operator accounts, password reset)
- Disaster Recovery & Database Backups (JSON export, restore dry-run, sync triggers)

#### Target Modular Structure
```
website/src/
  pages/
    Settings.jsx                       (~120 lines: Vertical/horizontal tab coordinator)
  components/settings/
    BusinessProfileTab.jsx             (~300 lines: Shop identity, GSTIN, bank details)
    InvoiceSequenceTab.jsx             (~240 lines: Numbering format, terms, disclaimer)
    SmtpEmailTab.jsx                   (~260 lines: Mail server, encryption status, test send)
    UserAdminTab.jsx                   (~310 lines: User list, credential creation)
    DisasterRecoveryTab.jsx            (~250 lines: Backup export, restore dry-run, reset guard)
```

#### Safe Extraction Sequence
1. **Phase 1: Extract `DisasterRecoveryTab`**
   - Backup download, snapshot validation, and restore modal.
2. **Phase 2: Extract `SmtpEmailTab`**
   - Safe integration with encrypted backend settings; verify password is never leaked.
3. **Phase 3: Extract `UserAdminTab`**
   - Role management with admin restrictions.
4. **Phase 4: Extract `InvoiceSequenceTab`**
   - Guarded sequence settings with audit logs.
5. **Phase 5: Extract `BusinessProfileTab`**
   - Primary shop settings and bank details.

---

## 3. Strict Pre-Extraction Testing Requirements

Before executing any extraction above in a future release:
1. **Pre-requisite Test Harness:** Write Vitest unit tests covering form serialization, input validation, and state preservation.
2. **Regression Gate:** Run full backend integration suite (`npm --prefix backend test`) and frontend suite (`npm --prefix website test`).
3. **Atomic Commits:** One commit per extracted sub-component. Never bundle multiple tab extractions into a single commit.
4. **Local DB Verification:** All smoke tests run strictly against `127.0.0.1:27017/srsf_test_suite`.
