# SplitTrack REST API Specification

This document outlines the RESTful API specification for the SplitTrack application. The API follows standard REST conventions, using JSON for payloads (`application/json`) and standard HTTP status codes.

## 1. Authentication & User Management

### Register a New User
Registers a new user in the system. New users are created with a `Pending` status and require admin approval before accessing the platform.
* **Method & URL:** `POST /users/register`
* **Authorization:** None (Public)
* **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "securepassword123"
  }
  ```
* **Expected Response (201 Created):**
  ```json
  {
    "id": "u101",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "status": "Pending",
    "role": "Standard User"
  }
  ```
* **Status Codes:** `201 Created`, `400 Bad Request`, `409 Conflict` (Email already exists)

### User Login
Authenticates a user and returns a Bearer token. The user's status must be `Active`.
* **Method & URL:** `POST /users/login`
* **Authorization:** None (Public)
* **Request Body:**
  ```json
  {
    "email": "jane@example.com",
    "password": "securepassword123"
  }
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5c...",
    "user": {
      "id": "u101",
      "name": "Jane Doe",
      "role": "Standard User",
      "status": "Active"
    }
  }
  ```
* **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden` (Status is Pending)

### List Users
Retrieves a list of all users. Can be filtered by status or role.
* **Method & URL:** `GET /users?status=pending`
* **Authorization:** Bearer Token (Admin only)
* **Request Body:** None
* **Expected Response (200 OK):**
  ```json
  [
    {
      "id": "u101",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "status": "Pending",
      "role": "Standard User"
    }
  ]
  ```
* **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden`

### Approve User Registration
Updates a pending user's status to `Active`.
* **Method & URL:** `PATCH /users/{id}/approve`
* **Authorization:** Bearer Token (Admin only)
* **Request Body:** None
* **Expected Response (200 OK):**
  ```json
  {
    "id": "u101",
    "status": "Active",
    "message": "User registration approved."
  }
  ```
* **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

### Update User Role
Changes a user's role between `Standard User` and `Admin`.
* **Method & URL:** `PATCH /users/{id}/role`
* **Authorization:** Bearer Token (Admin only)
* **Request Body:**
  ```json
  {
    "role": "Admin"
  }
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "id": "u101",
    "role": "Admin",
    "message": "User role updated successfully."
  }
  ```
* **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

### Trigger Password Reset
Initiates a password reset flow for a specific user.
* **Method & URL:** `POST /users/{id}/password-reset`
* **Authorization:** Bearer Token (Admin only)
* **Request Body:** None
* **Expected Response (200 OK):**
  ```json
  {
    "message": "Password reset email sent to user."
  }
  ```
* **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

## 2. Categories

### List Categories
Retrieves a list of available expense categories.
* **Method & URL:** `GET /categories`
* **Authorization:** Bearer Token
* **Request Body:** None
* **Expected Response (200 OK):**
  ```json
  [
    {
      "id": "cat1",
      "name": "Food & Dining",
      "icon": "utensils",
      "color": "bg-blue-500"
    },
    {
      "id": "cat2",
      "name": "Transport",
      "icon": "car",
      "color": "bg-green-500"
    }
  ]
  ```
* **Status Codes:** `200 OK`, `401 Unauthorized`

## 3. Expenses

### Create a New Expense
Creates a new shared expense. Includes an array of participants and their specific `amountOwed` to support Equal or Custom splits via the `EXPENSE_PARTICIPANT` bridge table.
* **Method & URL:** `POST /expenses`
* **Authorization:** Bearer Token
* **Request Body:**
  ```json
  {
    "title": "Weekend Groceries",
    "totalAmount": 120.00,
    "categoryId": "cat1",
    "participants": [
      {
        "userId": "u101",
        "amountOwed": 40.00
      },
      {
        "userId": "u102",
        "amountOwed": 80.00
      }
    ]
  }
  ```
* **Expected Response (201 Created):**
  ```json
  {
    "id": "exp101",
    "title": "Weekend Groceries",
    "totalAmount": 120.00,
    "date": "2026-08-30T10:00:00Z",
    "categoryId": "cat1",
    "creatorId": "u101",
    "status": "Pending",
    "participants": [
      {
        "userId": "u101",
        "amountOwed": 40.00
      },
      {
        "userId": "u102",
        "amountOwed": 80.00
      }
    ]
  }
  ```
* **Status Codes:** `201 Created`, `400 Bad Request`, `401 Unauthorized`

### List Expenses
Retrieves a list of expenses. Supports query parameters for filtering.
* **Method & URL:** `GET /expenses?status=pending&creatorId=u101`
* **Authorization:** Bearer Token
* **Request Body:** None
* **Expected Response (200 OK):**
  ```json
  [
    {
      "id": "exp101",
      "title": "Weekend Groceries",
      "totalAmount": 120.00,
      "date": "2026-08-30T10:00:00Z",
      "status": "Pending"
    }
  ]
  ```
* **Status Codes:** `200 OK`, `401 Unauthorized`

### Get Expense Details
Retrieves detailed information for a specific expense, including all participants and their split amounts.
* **Method & URL:** `GET /expenses/{id}`
* **Authorization:** Bearer Token
* **Request Body:** None
* **Expected Response (200 OK):**
  ```json
  {
    "id": "exp101",
    "title": "Weekend Groceries",
    "totalAmount": 120.00,
    "date": "2026-08-30T10:00:00Z",
    "status": "Pending",
    "categoryId": "cat1",
    "creatorId": "u101",
    "participants": [
      {
        "userId": "u101",
        "amountOwed": 40.00
      },
      {
        "userId": "u102",
        "amountOwed": 80.00
      }
    ]
  }
  ```
* **Status Codes:** `200 OK`, `401 Unauthorized`, `404 Not Found`

### Update Expense Status (Approve/Reject)
Allows an admin to approve or reject a pending expense.
* **Method & URL:** `PATCH /expenses/{id}/status`
* **Authorization:** Bearer Token (Admin only)
* **Request Body:**
  ```json
  {
    "status": "Confirmed"
  }
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "id": "exp101",
    "status": "Confirmed",
    "message": "Expense status updated."
  }
  ```
* **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

## 4. Payments

### Submit a New Payment
Submits a payment to settle an expense. Uses the `EXPENSE_PAYMENT` bridge table mapping to allow for partial payments or paying off multiple expenses in one transaction.
* **Method & URL:** `POST /payments`
* **Authorization:** Bearer Token
* **Request Body:**
  ```json
  {
    "amount": 40.00,
    "payeeId": "u101",
    "expensesApplied": [
      {
        "expenseId": "exp101",
        "amountApplied": 40.00
      }
    ]
  }
  ```
* **Expected Response (201 Created):**
  ```json
  {
    "id": "pay101",
    "date": "2026-08-30T14:00:00Z",
    "amount": 40.00,
    "payerId": "u102",
    "payeeId": "u101",
    "status": "Pending",
    "expensesApplied": [
      {
        "expenseId": "exp101",
        "amountApplied": 40.00
      }
    ]
  }
  ```
* **Status Codes:** `201 Created`, `400 Bad Request`, `401 Unauthorized`

### List Payments
Retrieves a list of payments. Supports query parameters for filtering.
* **Method & URL:** `GET /payments?status=pending`
* **Authorization:** Bearer Token
* **Request Body:** None
* **Expected Response (200 OK):**
  ```json
  [
    {
      "id": "pay101",
      "date": "2026-08-30T14:00:00Z",
      "amount": 40.00,
      "payerId": "u102",
      "payeeId": "u101",
      "status": "Pending"
    }
  ]
  ```
* **Status Codes:** `200 OK`, `401 Unauthorized`

### Update Payment Status (Approve/Reject)
Allows an admin to confirm or reject a pending payment submission.
* **Method & URL:** `PATCH /payments/{id}/status`
* **Authorization:** Bearer Token (Admin only)
* **Request Body:**
  ```json
  {
    "status": "Confirmed"
  }
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "id": "pay101",
    "status": "Confirmed",
    "confirmedDate": "2026-08-30T15:00:00Z",
    "message": "Payment confirmed successfully."
  }
  ```
* **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`
