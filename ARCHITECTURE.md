# Skinuvia ClinicOS — architecture and implementation roadmap

## Product identity

- Clinic: **Skinuvia by Dr. Amna Iqbal**
- Authoritative timezone: `Asia/Karachi`
- Initial tenancy: one clinic, multiple doctors; every domain record carries `clinic_id` for future branches and multi-clinic isolation.

## Target production architecture

The full platform should use a TypeScript monorepo with a Next.js admin client, a structured NestJS REST API, PostgreSQL through Prisma, Redis/BullMQ workers, private object storage for documents, and a separately permissioned WhatsApp gateway. The current Phase 1 artifact is a browser-persistent vertical slice for validating workflows and visual language before infrastructure credentials are connected.

### Service boundaries

1. **Web app** — authenticated role-aware clinic interface, form validation, printable views.
2. **Clinic API** — patients, appointments, schedules, tokens, prescriptions, billing, pharmacy, CRM, follow-ups and promotions.
3. **Identity & policy** — sessions, MFA, clinic-scoped RBAC and field-level authorization.
4. **Worker** — reminders, PDF generation, stock alerts, campaign delivery and retry-safe jobs.
5. **WhatsApp gateway** — signature verification, message deduplication and outbound delivery status.
6. **AI orchestration** — deterministic intent/workflow state first; LLM understanding only when needed; validated tools with idempotency keys.

## Core relationship map

`Clinic → Branches → Users/Doctors/Schedules`

`Clinic → Contacts ↔ ContactPatientRelationships ↔ Patients → Appointments → StatusHistory`

`Appointments → Tokens | Prescriptions → PrescriptionItems/Versions | Invoices → Payments/Refunds`

`Patients → FollowUps | TreatmentPlans → PlanSessions`

`MedicineCatalog → MedicineBatches → StockTransactions ← Purchases/Sales`

`Contacts → CRMLeads → CRMActivities` and `Contacts → WhatsAppConversations → Messages/AIState/ToolExecutions`

All tenant-owned tables include `clinic_id`, timestamps, creator/updater IDs and soft-delete metadata where appropriate. Booking conflicts, queue token uniqueness, payment idempotency and stock consistency need database constraints plus transactions—not UI-only checks.

## Page structure

- Overview: live operational KPIs, schedule, queue, alerts and revenue
- Appointments: calendar/table, walk-ins, atomic token assignment, reschedule/status workflows
- Patients: contact/family graph, medical timeline and privacy-aware records
- Digital Prescriptions: authoring, approval, versioning, branded print/PDF
- Pharmacy: catalog, batches, vendors, purchases, sales, stock ledger and alerts
- Payments & Billing: invoices, partial payments, refunds, receipts and reconciliation
- CRM & Leads: pipeline, activities, sources, campaigns and conversion attribution
- Follow-ups / Treatment Plans: care continuity, sessions and appointment conversion
- Promotions: eligibility, channel placement, templates and consent-aware campaigns
- WhatsApp AI Inbox: unified conversations, AI/human assignment and handoff
- Analytics: appointment, finance, inventory, CRM and AI performance
- Settings: clinic, schedule, treatments, users, roles, templates and security

## Reusable component plan

- Application shell, responsive sidebar, command search and notification centre
- Metric card, filter bar, data table, pagination and empty/error/loading states
- Validated form drawer/modal, confirmation dialog and toast
- Patient picker with family disambiguation
- Appointment editor, status timeline, slot picker and queue/token card
- Money input, invoice editor, payment/refund dialog and printable document frame
- Medicine line editor, batch selector and stock movement table
- Prescription composer, approval panel and version history
- Conversation thread, pending-intent card and human-handoff controls
- Role guard, permission-aware action menu and audit event viewer

## Delivery roadmap

### Phase 1 — foundation (current milestone)

- Branded responsive dashboard shell
- Pakistan live clock rendered with `Asia/Karachi`
- Role-oriented navigation and reusable UI primitives
- Spacious validated appointment/walk-in form
- Working search, queue action, dark mode, export and browser persistence
- Architecture, relationship, page and component plan

Production authentication, API/database persistence and RBAC enforcement remain the next infrastructure step; browser storage in this milestone is for workflow validation only and must not hold real patient data.

### Phase 2 — core operations

Implement PostgreSQL/Prisma migrations, authenticated REST APIs, patients/family contacts, appointments, doctor schedules, walk-ins, serializable token assignment, status history and thermal/A4 token printing. Add automated conflict, token and authorization tests.

### Phase 3 — clinical workflows

Implement doctor-only prescription authoring/approval, versioned PDFs, patient history, follow-ups and treatment plans. Add recipient verification before WhatsApp delivery.

### Phase 4 — business operations

Add double-checked invoices/payments/refunds, transaction-ledger inventory, batch/expiry logic, vendors, CRM, promotions, analytics and exports.

### Phase 5 — WhatsApp AI

Add the official webhook gateway, replay protection, Roman Urdu/Urdu/English routing, deterministic Pakistan date parsing, interruption-safe state, tool authorization and staff handoff. Never confirm before a committed booking.

### Phase 6 — production readiness

Threat model, security review, encrypted backups/restore drills, observability, rate limiting, retention policies, integration tests, performance work and deployment runbooks.

## Acceptance strategy

Each phase ships vertical workflows with migrations, API validation, permission tests and end-to-end checks. External services use environment variables and sandbox adapters until real credentials are available. Features remain labelled pending until their integrations and tests pass.
