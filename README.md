# 📊 Punto Gestión — Cloud Business Management & Inventory SaaS

> **Punto Gestión** is a multi-tenant SaaS platform built to automate, monitor, and streamline daily operations for small and medium-sized businesses. It enables real-time inventory tracking, seamless sales/expense logging, automated stock health alerts, and instant financial reporting without the hassle of manual spreadsheets or legacy software.

---

## 🚀 Key Features

- **⚡ Zero-Friction Onboarding:** Instant trial and interactive app exploration with just two clicks.
- **📦 Smart Inventory Control:**
  - Automated alerts for **low stock** and **out-of-stock** items.
  - Tracking for **expiring products** (ideal for food, beverages, and retail).
  - Detection of **slow-moving inventory** (products with no movement in over 60 days).
- **📈 Real-Time Financial Reports:**
  - Automated calculation of monthly revenue, Cost of Goods Sold (COGS), gross margin, and net profit.
  - Visual financial breakdown comparing **Profits vs. Expenses**.
- **👥 Multi-Tenancy & Granular Permissions:**
  - Support for multiple businesses per user account.
  - Team member invitations with customizable role-based permissions (`Permission` enum).
- **🔍 Complete Audit Trail:** Comprehensive tracking of all inventory adjustments (`MovementHistory`) tied to the responsible team member.

---

## 🛠️ Tech Stack

### Backend
- **Framework:** [NestJS](https://nestjs.com/) (Node.js)
- **ORM:** [Prisma](https://www.prisma.io/)
- **Database:** PostgreSQL
- **Authentication:** JWT, session Cookies, AuthProviders (Local / Google OAuth)
- **Language:** TypeScript

### Frontend
- **Library:** React
- **Styling:** Tailwind CSS / UI Components
- **Data Visualization:** Recharts / Chart.js

---

## 🗄️ Core Domain Architecture

- **`User` / `Business` / `BusinessEmployee`:** Multi-tenant hierarchy enforcing role-based access control (RBAC).
- **`Inventory` / `Product` / `Supplier`:** Catalog management, pricing models, product costs, reorder thresholds, and expiration dates.
- **`Sale` / `SaleItem`:** Transactional records storing historical price/cost snapshots for accurate profit margin analysis.
- **`Expense` / `Purchase`:** Operational expenditure and supplier purchase tracking.
- **`MovementHistory`:** Comprehensive log for stock entries, exits, adjustments, and inventory activity.

---

## ⚙️ Project Setup

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL instance running locally or hosted

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Fernando2025A/punto-gestion-backend.git](https://github.com/Fernando2025A/punto-gestion-backend.git)
   cd punto-gestion-backend
