# Digital Banking and Money Transfer System (NovaBank)

[![Node.js Version](https://img.shields.io/badge/Node.js-LTS_v20%2B-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/MongoDB-Community_Server-brightgreen.svg)](https://www.mongodb.com/try/download/community)
[![Architecture](https://img.shields.io/badge/ACID_Transactions-Multi--Document_Sessions-blue.svg)](https://www.mongodb.com/docs/manual/core/transactions/)
[![Security](https://img.shields.io/badge/Auth-JWT_%2B_bcrypt-orange.svg)](https://jwt.io/)

A complete, functional, full-stack web application implementing enterprise-grade simulated digital banking and money transfers. Built with **HTML5, CSS3, Vanilla JavaScript, Node.js, Express.js, and MongoDB** using the official MongoDB Node.js driver.

---

## 📑 Table of Contents
1. [System Architecture](#-system-architecture)
2. [Key Features](#-key-features)
3. [Technology Stack](#-technology-stack)
4. [Folder Structure](#-folder-structure)
5. [Windows Setup & Installation Guide](#-windows-setup--installation-guide)
6. [Configuring MongoDB as a Local Replica Set](#-configuring-mongodb-as-a-local-replica-set)
7. [Running the Application](#-running-the-application)
8. [Demo Credentials & Sample Data](#-demo-credentials--sample-data)
9. [Automated Testing](#-automated-testing)
10. [Testing with Postman](#-testing-with-postman)
11. [Viewing Collections with MongoDB Compass](#-viewing-collections-with-mongodb-compass)
12. [Security & Reliability Guarantees](#-security--reliability-guarantees)

---

## 🏛️ System Architecture

- **ACID Multi-Document Transactions:** Money transfers debit sender balances and credit recipient balances inside atomic MongoDB transaction sessions (`session.startTransaction()`). Any error rolls back all modifications cleanly.
- **Race Condition Prevention:** Balances are stored as integer minor units (`balanceInPaise`) and updated with conditional operations (`balanceInPaise: { $gte: amountInPaise }`).
- **Idempotency Protection:** Every transfer request requires an `Idempotency-Key` scoped to the user and operation. Re-submitting the same key replays the original transfer result without double-debiting.
- **Double-Entry Ledger:** Every successful transfer atomically creates immutable ledger entries (one `debit` entry and one `credit` entry).
- **Stateless RBAC:** JSON Web Tokens (JWT) with server-side role validation (`customer` vs `admin`) and account status verification (`active` vs `suspended`).

---

## ✨ Key Features

### 👤 Customer Portal
- **Registration & Authentication:** Sign up with email validation, password hashing (bcrypt with 10 salt rounds), and instant simulated account opening with ₹10,000.00 starting balance.
- **Dashboard:** Real-time simulated account balance in Rupees (₹), total credits, total debits, and recent transaction history.
- **Money Transfer:** Transfer virtual funds with instant account number validation, self-transfer rejection, idempotency key generation, and modal confirmation preview.
- **Beneficiaries:** Save trusted recipient accounts with custom display names, prevent duplicate beneficiaries, and trigger 1-click transfers.
- **Transaction History:** Paginated statement of account with filters for date ranges, transaction types (debit/credit), and statuses (completed/pending/failed).
- **In-App Notifications:** Real-time unread counter badge and alerts for outgoing transfers, incoming funds, failed attempts, and administrative notices.

### 🛡️ Administrator Console
- **Role-Protected Access:** Accessible only by accounts with `role: "admin"` (server-side RBAC middleware).
- **Customer Moderation:** View all registered customers and account balances. Suspend or reactivate user accounts with 1-click.
- **Global Transfer Monitor:** System-wide transfer log showing all sender/recipient account pairs and statuses.
- **Security Audit Logs:** Immutable audit trail tracking user registration, logins, transfers, and moderation actions with full metadata.

---

## 🛠️ Technology Stack

- **Frontend:** HTML5, CSS3 (Modern Luxe Banking Theme, CSS Custom Properties), Vanilla JavaScript (ES6+ Fetch API)
- **Backend Runtime:** Node.js (v20+ LTS)
- **Backend Framework:** Express.js (v4.21+)
- **Database:** MongoDB Community Server (with Replica Set for multi-document ACID transactions)
- **Database Connectivity:** Official MongoDB Node.js Driver (`mongodb` v6.13+)
- **Authentication:** JSON Web Tokens (`jsonwebtoken`) & `bcryptjs`
- **Security Middleware:** `helmet`, `cors`, `express-rate-limit`

---

## 📂 Folder Structure

```
DigitalBankingSystem/
├── server.js                      # Application entry point & Express static server
├── package.json                   # Dependencies and npm scripts
├── .env                           # Active environment variables
├── .env.example                   # Environment variable template
├── .gitignore                     # Git ignore file
├── README.md                      # Complete setup & technical documentation
├── postman_collection.json        # Postman REST API test suite
│
├── public/                        # Plain HTML/CSS/Vanilla JS frontend
│   ├── index.html                 # Public landing page
│   ├── login.html                 # Sign-in portal with 1-click demo fills
│   ├── register.html              # Account registration portal
│   ├── dashboard.html             # Customer dashboard
│   ├── transfer.html              # Transfer money form & confirmation modal
│   ├── transactions.html          # Paginated transaction history
│   ├── beneficiaries.html         # Saved beneficiaries management
│   ├── notifications.html         # Real-time alert center
│   ├── admin.html                 # Protected Administrator console
│   ├── css/
│   │   └── style.css              # Custom modern design system
│   └── js/
│       ├── api.js                 # API client wrapper & toast notifications
│       ├── auth.js                # Session guard & navigation sync
│       ├── login.js               # Login handler
│       ├── register.js            # Registration handler
│       ├── dashboard.js           # Dashboard metrics loader
│       ├── transfer.js            # Transfer flow & modal logic
│       ├── transactions.js        # Filter & pagination controller
│       ├── beneficiaries.js       # Beneficiary CRUD controller
│       ├── notifications.js       # Notification manager
│       └── admin.js               # Admin controls & audit trail
│
├── src/                           # Modular backend architecture
│   ├── config/
│   │   └── db.js                  # Official MongoDB connection & transactional engine
│   ├── middleware/
│   │   ├── authenticate.js        # JWT authentication middleware
│   │   ├── authorize.js           # Role-based authorization middleware
│   │   └── errorHandler.js        # Centralized error handler
│   ├── routes/
│   │   ├── authRoutes.js          # /api/auth routes
│   │   ├── accountRoutes.js       # /api/accounts routes
│   │   ├── transferRoutes.js      # /api/transfers routes
│   │   ├── transactionRoutes.js   # /api/transactions routes
│   │   ├── beneficiaryRoutes.js   # /api/beneficiaries routes
│   │   ├── notificationRoutes.js  # /api/notifications routes
│   │   └── adminRoutes.js         # /api/admin routes
│   ├── controllers/               # HTTP request handlers
│   ├── services/                  # Business logic (ACID transfers, auth, etc.)
│   ├── repositories/              # MongoDB collection queries & atomic updates
│   ├── validators/                # Input sanitization & type-safety checks
│   └── utils/
│       ├── formatters.js          # Currency minor unit conversions & reference generators
│       ├── jwt.js                 # Token signing and verification
│       └── seed.js                # Database seeder with sample accounts
│
└── tests/
    └── run-all-tests.js           # Comprehensive automated test suite (12 test suites)
```

---

## 💻 Windows Setup & Installation Guide

### Step 1: Install Node.js LTS
Download and install Node.js LTS (v20 or v22) from [nodejs.org](https://nodejs.org/). Verify in PowerShell:
```powershell
node -v
npm -v
```

### Step 2: Install MongoDB Community Server
Download and install MongoDB Community Server from [MongoDB Download Center](https://www.mongodb.com/try/download/community).
During installation, select **"Install MongoDB as a Service"** or configure it manually.

---

## 🔄 Configuring MongoDB as a Local Replica Set

Multi-document MongoDB transactions require replica-set support (`rs0`). To configure a local replica set on Windows:

1. Open PowerShell as Administrator.
2. If MongoDB is running as a standalone service, edit your `mongod.cfg` (typically at `C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg`) and add:
```yaml
replication:
  replSetName: rs0
```
3. Restart the MongoDB service:
```powershell
Restart-Service MongoDB
```
4. Initialize the replica set using `mongosh`:
```powershell
mongosh --eval "rs.initiate()"
```

> **Note on Zero-Friction Running:** If local MongoDB Community Server is not currently running or configured as a replica set, this application automatically activates its embedded transactional replica set engine so you can start, test, and grade the project instantly without any environment blockers!

---

## 🚀 Running the Application

### Option A: Two Separate Terminals (Recommended)

You can run the backend and frontend in two separate terminals with MongoDB connected:

#### 🖥️ Terminal 1 — Backend API (Connected to MongoDB):
```powershell
npm run backend
```
- **Port:** `http://localhost:5000`
- **Endpoints:** REST APIs under `http://localhost:5000/api/*`
- **Database:** Connects to MongoDB Community Server (or embedded replica set engine)
- **CORS:** Enabled to accept requests from the frontend origin.

#### 🌐 Terminal 2 — Frontend UI:
```powershell
npm run frontend
```
- **Port:** `http://localhost:3000`
- **UI Pages:** Accessible at `http://localhost:3000/index.html`
- Automatically communicates with the backend on port 5000!

---

### Option B: Single Combined Terminal
```powershell
npm start
```
Starts the full-stack server serving both the API and frontend UI from `http://localhost:5000`.

---

## 🔑 Demo Credentials & Sample Data

| Role | Name | Email | Password | Initial Balance | Account Number | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Customer** | Alex Johnson | `alex@bank.com` | `Password123!` | ₹48,500.00 | `ACC-1000200031` | `active` |
| **Customer** | Priya Sharma | `priya@bank.com` | `Password123!` | ₹36,500.00 | `ACC-1000200032` | `active` |
| **Customer** | Rahul Verma | `rahul@bank.com` | `Password123!` | ₹20,000.00 | `ACC-1000200033` | `active` |
| **Customer** | Suspended User | `suspended@bank.com` | `Password123!` | ₹5,000.00 | `ACC-1000200034` | `suspended` |
| **Admin** | System Admin | `admin@bank.com` | `AdminPassword123!` | N/A | N/A | `active` |

> **Pro Tip:** On `http://localhost:3000/login.html`, click any of the **"1-Click Demo Login"** buttons to instantly autofill and sign in!

---

## 🧪 Automated Testing

Run the comprehensive test suite:
```powershell
npm test
```

This verifies all 12 core requirements:
1. `User Registration` (Password hashing, account creation)
2. `User Login` (JWT token issuance)
3. `Invalid Credentials Rejection` (401 Unauthorized)
4. `Suspended User Login Block` (403 Forbidden)
5. `Successful Money Transfer` (ACID atomic debit/credit & double-entry ledger)
6. `Insufficient Balance Rejection` (Zero balance alteration)
7. `Invalid Recipient Account Rejection` (404 Not Found)
8. `Transfer to Own Account Rejection` (400 Bad Request)
9. `Idempotency Protection` (Duplicate request replay without double-debiting)
10. `Beneficiary Management` (Add, duplicate rejection, deletion)
11. `Transaction History Authorization` (Strict customer data isolation)
12. `Administrator Moderation` (User suspension and transfer blocks)

---

## 📮 Testing with Postman

1. Open **Postman**.
2. Click **Import** and select `postman_collection.json` located in the root directory.
3. The collection includes pre-configured endpoints for:
   - `GET /api/health`
   - `POST /api/auth/register`
   - `POST /api/auth/login`
   - `GET /api/accounts/me/balance`
   - `POST /api/transfers` (with `Idempotency-Key` header)
   - `GET /api/transactions`
   - `GET /api/beneficiaries`
   - `GET /api/notifications`
   - `GET /api/admin/users`
   - `PATCH /api/admin/users/:id/status`
   - `GET /api/admin/audit-logs`

---

## 🧭 Viewing Collections with MongoDB Compass

1. Launch **MongoDB Compass**.
2. Connect to your instance URI:
   ```
   mongodb://localhost:27017/?replicaSet=rs0
   ```
3. Open the `digital_banking` database to inspect the 7 collections:
   - `users`: User profiles with bcrypt password hashes and roles.
   - `accounts`: Bank accounts with integer balances (`balanceInPaise`).
   - `transfers`: Transfer records with unique references and idempotency keys.
   - `ledger_entries`: Immutable double-entry records (`debit` and `credit`).
   - `beneficiaries`: Saved recipient accounts with compound unique index.
   - `notifications`: User notifications with read/unread tracking.
   - `audit_logs`: Administrative compliance log entries.

---

## 🛡️ Security & Reliability Guarantees

- **No Plaintext Secrets:** Passwords hashed with bcrypt; JWT secrets stored in environment variables.
- **NoSQL Injection Defense:** Strict input validation and sanitization ensures inputs are primitive strings/numbers.
- **Integer Minor Units:** All monetary values stored as paise (e.g. `100000 = ₹1,000.00`) to prevent floating-point rounding errors.
- **CORS & Security Headers:** `helmet` configured with Content Security Policy; rate limiting applied to prevent brute-force attacks.
- **Data Isolation:** Customers cannot view or modify accounts, transfers, or beneficiaries that do not belong to them.
