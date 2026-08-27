# VIJAYA DURGA AGENCIES — Seafood Invoicing & Billing System

A modern, full-stack Seafood Trade Billing and Invoicing Web Application with Progressive Web App (PWA) capabilities, GST compliance, WhatsApp sharing, customer ledger tracking, and traditional receipt PDF generation.

---

## 🌟 Key Features

- **🌸 Traditional Indian Tax Invoice**: High-resolution monochrome divine emblems (Lord Vinayaka, Maa Durga, Ram Darbar), Karur Vysya Bank details, GSTIN (`37KATPS1500Q1ZR`), and clean receipt typography.
- **📝 Interactive Table Entry Pad**: Create bills with live quantity × rate calculations, auto-summed totals, tax breakdowns, and customer auto-complete.
- **📱 WhatsApp Sharing**: Native PDF file attachment sharing on mobile & WhatsApp Web direct message sharing with invoice links.
- **📒 Customer Ledger & Outstanding Tracking**: Real-time receivables dashboard with 1-click WhatsApp payment reminders including bank details.
- **📊 1-Click Excel / CSV Export**: Instant export of all invoices formatted for CA & GST offline filing.
- **📱 Progressive Web App (PWA)**: Installable directly on mobile and desktop home screens with offline caching.
- **🔒 Role-Based Access Control**:
  - **Proprietor / Owner**: Full sales visibility, receivables, status updates, settings.
  - **Staff / Billing Operator**: Invoice creation, receipt printing, and customer sharing.

---

## 🚀 Local Development Setup

### 1. Backend Setup
```bash
cd backend
npm install
npm run dev
# Running on http://localhost:5001
```

### 2. Frontend Setup
```bash
cd website
npm install
npm run dev
# Running on http://localhost:5173
```

---

## 🌐 Cloud Deployment Guide

### Deploying Frontend on Vercel
1. Push this repository to GitHub.
2. Go to [Vercel Dashboard](https://vercel.com/new).
3. Import your GitHub repository.
4. **Root Directory**: Select `website`.
5. **Framework Preset**: `Vite`.
6. **Environment Variables**:
   - `VITE_API_URL`: `https://your-backend-url.onrender.com/api` (URL of your deployed backend).
7. Click **Deploy**!

### Deploying Backend (e.g. Render / Railway)
1. In Render / Railway, create a new **Web Service**.
2. **Root Directory**: `backend`.
3. **Build Command**: `npm install`.
4. **Start Command**: `node src/server.js`.
5. **Environment Variables**:
   - `PORT`: `5001`
   - `MONGODB_URI`: `mongodb+srv://...` (MongoDB Atlas URI)
   - `JWT_SECRET`: `your-secure-jwt-secret`
   - `JWT_EXPIRES_IN`: `7d`
