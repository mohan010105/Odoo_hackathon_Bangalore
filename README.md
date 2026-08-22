# ⚡ DAYFLOW HRMS

### Enterprise Workforce Management • Payroll • Attendance • Time Off • Odoo Integration

<p align="center">

**A modern, secure, and scalable Human Resource Management System designed to unify workforce operations with enterprise-grade Odoo integration.**

</p>

---

## 🚀 Overview

**Dayflow HRMS** is a full-stack Human Resource Management System designed to centralize and streamline employee lifecycle management.

From employee onboarding and attendance to leave management, salary structures, payroll, payslips, notifications, and Odoo synchronization, Dayflow provides a unified platform for managing workforce operations.

The platform combines:

- 🧑‍💼 Employee Management
- ⏱️ Attendance Tracking
- 🌴 Time-Off Management
- 💰 Salary Management
- 🧾 Payroll Processing
- 📄 Payslip Management
- 🔔 Notifications
- 🔗 Odoo Integration
- 🔐 Role-Based Access Control
- 🛡️ Supabase Row-Level Security
- 📊 Workforce Analytics

---

# 🎯 Problem

Modern organizations often operate HR processes across disconnected systems.

Employee information, attendance, leave requests, payroll, and external ERP systems can become fragmented, resulting in:

- Duplicate data
- Manual HR operations
- Inconsistent employee records
- Delayed payroll processing
- Poor workforce visibility
- Difficult ERP synchronization
- Increased administrative workload

Dayflow addresses these challenges through a **centralized HR operations platform** with integrated Odoo synchronization.

---

# 💡 Solution

Dayflow creates a unified HR ecosystem:

```text
                    ┌──────────────────────┐
                    │      DAYFLOW HRMS    │
                    └──────────┬───────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
   EMPLOYEES              ATTENDANCE              TIME OFF
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               │
                               ▼
                         COMPENSATION
                               │
                               ▼
                            PAYROLL
                               │
                               ▼
                           PAYSLIPS
                               │
                               ▼
                    ┌─────────────────────┐
                    │   ODOO INTEGRATION  │
                    └─────────────────────┘
                               │
                               ▼
                         ODOO ERP SYSTEM
✨ Core Capabilities
👥 Employee Management

Centralized employee directory with structured workforce information.

Features include:

Employee profiles
Employee IDs
Departments
Job positions
Employment status
Profile information
Employee documents
Search and filtering
Role-based access
⏱️ Attendance Management

Track employee attendance through a centralized interface.

Capabilities
Check-in
Check-out
Attendance history
Daily attendance status
Workforce attendance visibility
Attendance records linked to employees
Employee
   │
   ├── Check In
   │
   ├── Active Attendance
   │
   └── Check Out
          │
          ▼
      Attendance Record
🌴 Time-Off Management

Employees can submit leave requests while HR/Admin users can review and manage them.

Workflow
Employee
    │
    ▼
Create Leave Request
    │
    ▼
Pending Approval
    │
    ├───────────────┐
    ▼               ▼
 Approved         Rejected
    │
    ▼
Leave Recorded

Supports:

Leave requests
Leave types
Leave balances
Approval workflows
Rejection workflows
Leave history
HR visibility
💰 Salary Management

Dayflow provides structured compensation management.

Salary information can include:

Base salary
Allowances
Deductions
Net compensation
Salary structures
Compensation history

Sensitive salary information is protected using authorization and database-level security.

🧾 Payroll Management

Payroll processing is integrated into the employee lifecycle.

Employee
    │
    ▼
Salary Structure
    │
    ▼
Payroll Run
    │
    ▼
Payroll Processing
    │
    ▼
Payslip

Capabilities include:

Payroll runs
Employee payroll records
Earnings
Deductions
Net pay
Payroll status
Payslip generation
📄 Payslip Management

Employees can access their payroll information through structured payslips.

Payslips provide:

Employee information
Earnings
Allowances
Deductions
Net pay
Payroll period
Payslip history
🔔 Notifications

Dayflow provides centralized notifications for important workforce events.

Examples:

Leave approvals
Leave rejections
Payroll updates
HR actions
System notifications
🔗 ODOO INTEGRATION
Enterprise ERP Synchronization

One of Dayflow's core capabilities is its integration with Odoo.

The integration allows Dayflow to synchronize relevant HR data with an external Odoo environment.

Integration Architecture
                 DAYFLOW HRMS
                       │
                       ▼
              Odoo Integration Layer
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
      Connection                Synchronization
       Testing                     Engine
          │                         │
          └────────────┬────────────┘
                       │
                       ▼
                  ODOO ERP
Integration Features
Odoo connection testing
Connection status
Data synchronization
Sync summaries
Sync history
Created record tracking
Updated record tracking
Skipped record tracking
Failed record tracking
External reference tracking
Duplicate synchronization prevention
🔄 Synchronization Strategy

Dayflow maintains external references to prevent duplicate records.

Dayflow Record
      │
      ▼
Check External Reference
      │
      ├───────────────┐
      │               │
      ▼               ▼
   Exists          Not Found
      │               │
      ▼               ▼
   Update           Create
      │               │
      └───────┬───────┘
              ▼
        Sync Result
              │
              ▼
        Sync History

This approach enables safer synchronization between Dayflow and Odoo.

🧠 System Architecture
                         ┌──────────────────┐
                         │     FRONTEND     │
                         │                  │
                         │ React + Vite     │
                         │ TypeScript       │
                         │ Tailwind CSS     │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │   APPLICATION    │
                         │     SERVICES     │
                         └────────┬─────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
        SUPABASE AUTH         DATABASE            STORAGE
              │                   │                   │
              │                   ▼                   │
              │              PostgreSQL              │
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  │
                                  ▼
                         ODOO INTEGRATION
                                  │
                                  ▼
                             ODOO ERP
🛠️ Technology Stack
Frontend
Technology	Purpose
React	UI framework
TypeScript	Type-safe development
Vite	Development & build tooling
Tailwind CSS	Styling
React Router	Application routing
Backend & Infrastructure
Technology	Purpose
Supabase	Backend platform
PostgreSQL	Relational database
Supabase Auth	Authentication
Supabase Storage	File management
Row-Level Security	Database authorization
Enterprise Integration
Technology	Purpose
Odoo	ERP / enterprise integration
Odoo Sync Layer	Data synchronization
External References	Duplicate prevention
🔐 Security Architecture

Security is implemented across multiple layers.

Authentication

Supabase Auth manages:

User authentication
Sessions
Password verification
Logout
Authentication state
Authorization

Dayflow uses role-aware access control.

                 USER
                   │
                   ▼
             AUTHENTICATED
                   │
                   ▼
                  ROLE
          ┌────────┼────────┐
          ▼        ▼        ▼
        ADMIN      HR     EMPLOYEE

Different roles receive different levels of access.

🛡️ Row-Level Security

Supabase PostgreSQL Row-Level Security protects sensitive workforce information.

Protected areas include:

Employee records
Attendance
Leave requests
Salary
Payroll
Payslips
Notifications
Odoo integration data

The application does not rely solely on frontend visibility for security.

📁 Storage Architecture

Dayflow supports dedicated storage areas for workforce assets.

Supabase Storage
│
├── company-logos
├── employee-avatars
├── employee-documents
├── leave-attachments
└── payslips

Sensitive employee documents and payslips are handled through controlled access.

🧩 Application Modules
DAYFLOW
│
├── Dashboard
│
├── People
│   └── Employees
│
├── Workforce
│   ├── Attendance
│   └── Time Off
│
├── Compensation
│   ├── Salary
│   ├── Payroll
│   └── Payslips
│
├── Communication
│   └── Notifications
│
└── Administration
    ├── Odoo Integration
    └── Settings
⚙️ Installation
1. Clone the Repository
git clone <YOUR_REPOSITORY_URL>
cd dayflow-hrms
2. Install Dependencies
npm install
🔐 Environment Configuration

Create a .env file based on .env.example.

Example:

VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

Additional server-side variables required by the Odoo integration should remain server-side and must never be exposed through frontend code.

⚠️ Never commit:
.env
.env.local
service-role keys
Odoo passwords
private API credentials
▶️ Development

Start the development server:

npm run dev

The application will be available through the local Vite development server.

🏗️ Production Build

Build the application:

npm run build

Preview the production build:

npm run preview

Expected build output:

dist/
🔑 Demo Account
Employee Demo
Login ID: MORA20260002
Password: Mohan@007

These credentials are intended for the hackathon demonstration environment. Do not use demo credentials in a production deployment.

🧪 Demo Workflow

A recommended hackathon demonstration flow:

LOGIN
  │
  ▼
DASHBOARD
  │
  ├──────────────► EMPLOYEE MANAGEMENT
  │
  ├──────────────► ATTENDANCE
  │
  ├──────────────► TIME OFF
  │
  ├──────────────► SALARY
  │
  ├──────────────► PAYROLL
  │
  ├──────────────► PAYSLIPS
  │
  └──────────────► ODOO INTEGRATION
                         │
                         ▼
                    TEST CONNECTION
                         │
                         ▼
                     SYNC DATA
                         │
                         ▼
                    SYNC SUMMARY
                         │
                         ▼
                    SYNC HISTORY
📊 HRMS Data Lifecycle
Employee
   │
   ├── Profile
   │
   ├── Attendance
   │
   ├── Time Off
   │
   └── Compensation
           │
           ▼
        Payroll
           │
           ▼
        Payslip
           │
           ▼
     Odoo Synchronization
🌐 Deployment

Dayflow can be deployed using modern frontend hosting platforms.

Recommended production flow:

GitHub
   │
   ▼
Build Pipeline
   │
   ▼
npm run build
   │
   ▼
dist/
   │
   ▼
Production Hosting
   │
   ▼
DAYFLOW HRMS

Before deployment verify:

Environment variables
Supabase configuration
Authentication
Database policies
Storage policies
Odoo credentials
Production API URLs
Build configuration
🔒 Production Security Checklist

Before production deployment:

[ ] No secrets committed
[ ] No service-role key in frontend
[ ] RLS enabled
[ ] Authentication enabled
[ ] Role permissions verified
[ ] Private storage protected
[ ] Odoo credentials protected
[ ] HTTPS enabled
[ ] Environment variables configured
[ ] Demo credentials removed/rotated
📈 Future Roadmap

Potential future extensions include:

AI-Powered HR Assistant

Natural-language HR queries such as:

"How many employees are on leave today?"
"Show attendance trends this month."
"Which departments have the highest absenteeism?"
Workforce Analytics
Attrition analytics
Attendance trends
Leave patterns
Payroll analytics
Department performance
Advanced Odoo Synchronization
Bi-directional synchronization
Conflict resolution
Scheduled synchronization
Sync retry mechanisms
Detailed audit trails
Enterprise Expansion
Multi-company support
Advanced RBAC
Approval hierarchies
Automated payroll workflows
HR document lifecycle management
🏆 Hackathon Value Proposition

Dayflow is designed around three core principles:

01 — Centralization

Bring critical HR workflows into a unified platform.

02 — Automation

Reduce repetitive HR operations through structured workflows.

03 — Integration

Connect workforce management with enterprise ERP infrastructure through Odoo.

⚡ Why Dayflow?
             ┌────────────────────────────┐
             │         DAYFLOW HRMS       │
             ├────────────────────────────┤
             │                            │
             │  👥 Workforce              │
             │  ⏱️ Attendance             │
             │  🌴 Time Off               │
             │  💰 Compensation           │
             │  🧾 Payroll                │
             │  📄 Payslips              │
             │  🔔 Notifications          │
             │  🔗 Odoo Integration       │
             │  🔐 Secure Access          │
             │                            │
             └────────────────────────────┘

One platform. One workforce. One operational view.

🤝 Team

Built for the Odoo Hackathon.

Project

Dayflow HRMS

Category

Human Resource Management / Enterprise Software

Core Focus

Workforce Management + Odoo Integration

📜 License

This project is developed for hackathon and educational purposes.
<p align="center">
⚡ DAYFLOW HRMS

Modern Workforce Management. Connected to Enterprise Operations.

</p> ```
