# SplitTrack: Use Cases

This document details the specific Use Cases for the SplitTrack application, categorized by the primary actors: **Standard User**, **Expense Host**, and **Administrator**.

---

## Actor: Standard User
Any registered and active user on the platform.

### UC-01: View Dashboard & Balances
*   **Description:** The user logs in to see an overview of their financial standing.
*   **Preconditions:** User is authenticated and `Active`.
*   **Main Flow:**
    1. User navigates to the Dashboard.
    2. System calculates and displays the total amount the user owes and the total amount owed to them.
    3. System renders an interactive Pie Chart summarizing confirmed and pending balances.
    4. System displays a list of recent expenses the user is a part of.

### UC-02: Log a New Expense
*   **Description:** The user creates a new shared expense record.
*   **Main Flow:**
    1. User clicks "New Expense".
    2. User enters Title, Amount, Date, and selects a Category.
    3. User selects participants from the user directory.
    4. User selects "Equally" or "Custom Amounts".
    5. System validates the inputs (e.g., custom splits must equal total amount).
    6. User submits. The expense is created as `Pending`.

### UC-03: Submit a Payment
*   **Description:** The user logs that they have paid back another user.
*   **Main Flow:**
    1. User clicks "Submit Payment".
    2. User inputs the payment amount, selects the payee, and the date.
    3. User selects which specific expense(s) this payment applies to.
    4. User submits the form. The payment is logged as `Pending`.

### UC-04: Manage Profile & Settings
*   **Description:** The user updates their personal information.
*   **Main Flow:**
    1. User navigates to the Profile view.
    2. User views their Name, Username, Role, and "Member Since" date.
    3. User edits their Name (Username and Role are locked).
    4. User navigates to Settings to reset their password by providing the old password, new password, and confirming the new password.

---

## Actor: Expense Host (Creator)
A Standard User acting within the context of an expense they specifically created.

### UC-05: Edit Expense Details
*   **Description:** The host updates an expense that hasn't been finalized.
*   **Preconditions:** The expense is in `Pending` status, and the current user is the `creatorId`.
*   **Main Flow:**
    1. Host navigates to Expense Details.
    2. Host clicks the "Edit details" button.
    3. System opens the edit form populated with current data.
    4. Host modifies amounts, participants, or split logic.
    5. Host clicks "Review Changes" to see a confirmation breakdown.
    6. Host clicks "Save Changes" to apply updates.

---

## Actor: Administrator
An active user with the `Admin` role. Inherits all Standard User capabilities.

### UC-06: Approve / Reject Expenses
*   **Description:** The admin reviews pending expenses to ensure validity.
*   **Main Flow:**
    1. Admin navigates to Management > Approvals > Expense Approvals.
    2. Admin clicks on a pending expense card to view its details.
    3. Admin clicks "Approve". System changes status to `Confirmed` and applies the debts.
    4. *Alternate Flow:* Admin clicks "Reject". System discards or flags the expense.

### UC-07: Confirm / Reject Payments
*   **Description:** The admin verifies that funds were successfully transferred.
*   **Main Flow:**
    1. Admin navigates to Management > Approvals > Payment Approvals.
    2. Admin views the payment details.
    3. Admin clicks "Confirm Payment". System changes status to `Confirmed` and updates user balances.
    4. *Alternate Flow:* Admin clicks "Reject" if the payee confirms no money was received.

### UC-08: Manage User Registrations & Roles
*   **Description:** The admin governs who has access to the platform and their permission levels.
*   **Main Flow:**
    1. Admin navigates to Management > User Management.
    2. Admin views the data table of all users.
    3. To approve a user: Admin clicks the "Approve Registration" checkmark next to a `Pending` user.
    4. To change a role: Admin uses the inline dropdown to switch a user between "Standard User" and "Admin".
    5. To reset password: Admin clicks the "Key" icon to trigger a password reset email for that user.
