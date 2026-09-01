# SplitTrack: Modules & Architecture Documentation

SplitTrack (Shared Expense Tracker) is a modular React application built with Vite and Tailwind CSS. It is designed to help groups track, split, and settle shared expenses smoothly. 

Below is a breakdown of the current modules, submodules, and their primary responsibilities.

---

## 1. Workspace Modules
The **Workspace** is the primary functional area where users manage their day-to-day shared expenses and settlements.

### 1.1 Dashboard (`/src/pages/Dashboard.tsx`)
* **Purpose:** Provides a high-level, at-a-glance overview of the user's financial standing.
* **Core Features:**
  * **Interactive Balance Chart:** A Recharts-powered pie chart summarizing Confirmed Payments, Pending Payments, and Current Balance Due.
  * **Quick Actions:** Shortcuts to log new expenses or submit payments.
  * **Recent Activity:** A summary list of the most recent shared expenses.

### 1.2 Expenses (`/src/pages/Expenses.tsx`, `NewExpense.tsx`, `ExpenseDetails.tsx`)
* **Purpose:** The core engine for creating, viewing, and managing shared costs.
* **Submodules:**
  * **Expense List:** A searchable, filterable repository of all shared sessions (e.g., filter by "Hide fully paid", "Created by me", or specific statuses).
  * **New Expense Form:** A streamlined form to create expenses. Features implicit decimal formatting for currency inputs and supports calculating splits either **Equally** or with **Custom Amounts** dynamically.
  * **Expense Details:** Displays the granular split of an expense.
    * *Host Controls:* If the current user created the expense, they can access an integrated "Edit" flow.
    * *Admin Controls:* If the expense is marked as 'Pending', administrators will see action blocks here to Approve or Reject it.

### 1.3 Payments (`/src/pages/Payments.tsx`, `NewPayment.tsx`, `PaymentDetails.tsx`)
* **Purpose:** Tracking settlements, debts, and transaction histories between users.
* **Submodules:**
  * **Payments Dashboard:** Displays aggregate metrics (Total Owed vs. Confirmed vs. Pending) alongside a history of settlement records.
  * **Submit Payment:** An interface allowing users to log that they have paid someone back, tying the payment to specific expenses.
  * **Payment Details:** Detailed view of a transaction. Admins use this view to verify and confirm pending payments.

---

## 2. Management Modules (Admin)
Restricted features available only to users with the `Admin` role to moderate and govern the platform.

### 2.1 Approvals (`/src/pages/Approvals.tsx`)
* **Purpose:** A centralized inbox for all pending platform requests.
* **Submodules:**
  * **Expense Approvals Tab:** Lists newly created expenses awaiting review. 
  * **Payment Approvals Tab:** Lists submitted payment settlements awaiting verification.
  * *Workflow:* Clicking any row redirects the admin directly to the specific detail view to securely review and approve/reject the item.

### 2.2 User Management (`/src/pages/UserManagement.tsx`)
* **Purpose:** Directory for overseeing platform access and user governance.
* **Core Features:**
  * **Data Table:** View all registered users, their emails, roles, and statuses.
  * **Role Management:** Inline dropdowns to instantly toggle users between `Standard User` and `Admin`.
  * **Security Actions:** Single-click buttons to approve pending user registrations and trigger password resets.

---

## 3. Account Modules
User-specific preferences and profile configurations.

### 3.1 Profile (`/src/pages/Profile.tsx`)
* **Purpose:** Manage personal identity variables (Name, Avatar initials, Email, Password management).

### 3.2 Settings (`/src/pages/Settings.tsx`)
* **Purpose:** Application-wide user preferences (e.g., Currency formatting, Notification toggles, Dark Mode settings).

---

## 4. Core Data & Utilities (State Management)
Under-the-hood modules powering the application logic.

### 4.1 Global Types (`/src/types.ts`)
* Defines strict TypeScript interfaces ensuring data safety across the app (`User`, `Category`, `Expense`, `Payment`).

### 4.2 Mock Data Engine (`/src/data.ts`)
* Acts as the temporary local database. 
* Exports standard arrays for users, categories, expenses, and payments to simulate relational data linking (e.g., `creatorId`, `expenseIds`).
* Defines the `currentUser` context, allowing the UI to adapt based on who is logged in (e.g., showing Admin links if the user role is Admin).

### 4.3 Utilities (`/src/utils.ts`)
* Contains helper functions, most notably the `cn()` class-merging utility used extensively with Tailwind CSS for dynamic styling and conditional rendering.
