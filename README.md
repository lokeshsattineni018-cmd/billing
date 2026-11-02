# SRSF Billing & Operations Management System
### *Vijaya Durga Agencies — Commercial Fish & Feed Wholesale Billing Portal*

A production-grade, offline-first billing, operations, and financial management application purpose-built for **Vijaya Durga Agencies**. Engineered for high-speed counter billing, field shed operations, staff wage settlement, and real-time Profit & Loss (P&L) tracking.

---

## 🚀 Key Highlights & Architecture

- **Frontend**: React 18, Vite, React Router v6, Canvas-free SVG Analytics, PWA (Progressive Web App).
- **Backend**: Node.js, Express, MongoDB Atlas, Mongoose, Serverless Architecture on Vercel.
- **Offline-First (Shed Mode)**: IndexedDB caching via local Master Cache with background two-way sync (`syncManager.js`) for operating in remote fish ponds and sheds without network coverage.
- **Document Engines**: High-speed PDF generation with Thermal (3-inch / 80mm) and Standard A4/A5 Laser receipt formats with auto-print capability.
- **Financial Controls**: Automatic P&L calculation incorporating fish sales, wastage recovery, ice block overhead, and worker piece-rate/daily wages.

---

## 🌟 Feature Overview

### 1. High-Speed Invoice Engine (`NewBill.jsx`)
- Instant customer lookup with outstanding balance indicator and credit warning.
- Dynamic crate/bag tare weight calculations with gross, tare, and net breakdown.
- Multi-mode settlements: Cash, Online (UPI/NEFT/RTGS), Cheque, or Credit Ledger.
- Direct WhatsApp invoice delivery and one-click thermal printing.

### 2. Operational Overhead Trackers
- **Ice Management (`IceTracker.jsx`)**: Tracks daily ice block purchases, rate per block, vehicle delivery, and costs apportioned into P&L.
- **Fish Wastage Tracker (`WastageTracker.jsx`)**: Records sorting wastage, mortality, and secondary salvage sales.
- **Worker Wage & Advance Ledger (`Staff.jsx`)**: Attendance calendar, piece-rate weighing wages, cash advances, and automated weekly voucher generation.

### 3. Customer Ledger & Payment Recovery (`CustomerLedger.jsx`)
- Live aged debt tracking per wholesale buyer.
- Pre-composed WhatsApp payment reminders with Karur Vysya Bank account and IFSC details.
- Lump-sum payment allocation across oldest unpaid bills.

### 4. Executive Dashboard & Live P&L (`Dashboard.jsx`, `ProfitLossWidget.jsx`)
- Real-time revenue graphs (7-day spline & 6-month trends).
- Real-time net margin % calculation, collection health donut, and day-wise drilldowns.
- End-of-day business summary generation for partner WhatsApp sharing.

---

## 🛠️ Project Structure

```
srsf/
├── backend/
│   ├── src/
│   │   ├── config/          # MongoDB connection and security settings
│   │   ├── middleware/      # JWT auth and role-based permissions
│   │   ├── models/          # Mongoose models (Bill, Staff, Settings, DailyIce, etc.)
│   │   ├── routes/          # REST API endpoints (/bills, /staff, /dashboard, etc.)
│   │   ├── services/        # PDF generation, backup, email services
│   │   └── app.js           # Express app bootstrap
│   └── tests/               # Security and integration test suites
├── website/
│   ├── public/              # Icons, manifest.json, service worker (sw.js)
│   ├── src/
│   │   ├── components/      # UI widgets (ProfitLossWidget, AnalyticsCharts, etc.)
│   │   ├── context/         # AuthContext, LanguageContext (Telugu & English)
│   │   ├── pages/           # Dashboard, NewBill, Staff, Reports, CustomerLedger
│   │   ├── services/        # api.js (Axios with offline interceptors), syncManager.js
│   │   └── utils/           # Number formatting, notifications, printer utilities
└── vercel.json              # Serverless rewrites, headers, and keep-alive cron jobs
```

---

## ⚙️ Environment Configuration

Create a `.env` file in `backend/` and `website/` (or configure via Vercel Dashboard):

### Backend (`backend/.env`)
```env
PORT=5001
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/srsf_billing?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key_here
NODE_ENV=production
```

### Frontend (`website/.env`)
```env
VITE_API_URL=/api
```

---

## 💻 Local Development Setup

### 1. Prerequisites
- Node.js (v18.x or v20.x recommended)
- MongoDB instance or MongoDB Atlas cluster connection

### 2. Backend Setup
```bash
cd backend
npm install
npm run dev
# Backend server runs on http://localhost:5001
```

### 3. Frontend Setup
```bash
cd website
npm install
npm run dev
# Vite dev server runs on http://localhost:5173
```

---

## 🔒 Security Best Practices

1. **Role-Based Access Control**: Strict tiering (`admin`, `owner`, `staff`) on sensitive endpoints (deleting invoices, updating master rates, resetting counters).
2. **Offline Data Isolation**: Sensitive customer lists stored encrypted/hashed in client IndexedDB only during active session.
3. **Database Access**: Always use least-privilege MongoDB Atlas users with restricted network IPs and rotate passwords periodically.

---

## 📜 Maintenance & Backup

- **Keep-Alive (Optional)**: Can be pinged via any free external uptime monitor (e.g. Cron-job.org or UptimeRobot) pointing to `/api/health` to keep serverless functions warm during business hours.
- **Automated Daily Summaries**: Nightly cron triggered at 18:30 UTC via `vercel.json` for daily backup aggregation and audit logging.
- **Manual Backups**: Administrators can export full system data as JSON/CSV via the Settings page.

---
*Developed for Vijaya Durga Agencies.*
