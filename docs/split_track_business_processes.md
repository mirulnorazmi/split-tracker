# SplitTrack: Business Processes

This document outlines the core business workflows and lifecycle processes that govern the SplitTrack (Shared Expense Tracker) application. The system operates on a strict approval-based workflow to ensure data integrity and financial accuracy.

## 1. User Registration & Onboarding Process
To ensure that only authorized individuals can access the financial data of the group, user registration is moderated.

*   **Step 1: Registration Submission**
    *   A new user submits their registration details (Name, Email, Password).
    *   The system creates the user account with a `Pending` status.
*   **Step 2: Admin Review**
    *   An Administrator receives the request in the **User Management** dashboard.
    *   The Admin reviews the user's identity.
*   **Step 3: Approval and Activation**
    *   The Admin approves the registration.
    *   The user's status changes to `Active`.
    *   The user is now granted access to log in and view/participate in shared expenses.

## 2. Shared Expense Lifecycle Process
When a cost is incurred by a group, it must be logged and verified before it affects everyone's balances.

*   **Step 1: Expense Logging (Creation)**
    *   A user (the "Creator" or "Host") logs a new expense via the **New Expense** form.
    *   They define the total amount, category, and select the participants.
    *   They choose the split method: **Equal** (divided evenly) or **Custom** (specific amounts per person).
    *   The expense is saved with a `Pending` status.
*   **Step 2: Host Editing (Optional)**
    *   Before approval, the Host can edit the expense details, modify participants, or adjust custom split amounts.
*   **Step 3: Admin Approval**
    *   An Administrator reviews the pending expense in the **Approvals** dashboard.
    *   If details are incorrect, the Admin rejects it (soft delete or sent back for edits).
    *   If correct, the Admin clicks **Approve**.
*   **Step 4: Balance Application**
    *   The expense status changes to `Confirmed`.
    *   The system calculates the debts based on the bridge table (`EXPENSE_PARTICIPANT`) and updates the **Dashboard Balances** for all involved users.

## 3. Debt Settlement (Payment) Process
Users must periodically settle their negative balances by paying back the individuals who covered the expenses.

*   **Step 1: Payment Submission**
    *   A user (the "Payer") physically pays another user (the "Payee") via external means (Cash, Bank Transfer, PayPal).
    *   The Payer logs into SplitTrack and creates a **New Payment**.
    *   They specify the amount, the Payee, and which specific expenses this payment is meant to cover (mapped via `EXPENSE_PAYMENT`).
    *   The payment is saved with a `Pending` status.
*   **Step 2: Verification**
    *   An Administrator (often checking with the Payee to ensure funds were actually received) reviews the payment in the **Approvals** dashboard.
*   **Step 3: Confirmation**
    *   The Admin approves the payment.
    *   The payment status changes to `Confirmed`, and a `confirmedDate` is stamped.
    *   The system deducts the payment amount from the Payer's total debt and the Payee's total owed.

## 4. System Governance & Administration Process
Administrators are responsible for maintaining the health and security of the platform.

*   **Role Management:** Admins can promote Standard Users to `Admin` to share administrative duties, or demote them to revoke privileges.
*   **Password Reset:** If a user is locked out, an Admin can trigger a secure password reset flow from the User Management dashboard.
*   **Audit & Oversight:** Admins have full visibility into the Approvals queue to ensure no expenses or payments are left perpetually unverified.
