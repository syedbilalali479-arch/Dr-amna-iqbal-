# Appointment invoices and pharmacy operations

The local clinic console now separates clinical invoices from medicine sales.

- **Appointments:** Actions supports editing, completion, cancellation, no-show, linked follow-up appointments, invoice creation/viewing and deletion. A follow-up also appears in Follow-ups, and its appointment date/status updates that reminder. Appointments with invoices retain their financial history and can be cancelled rather than deleted.
- **Clinical Invoices:** Patient-linked, itemized consultation/treatment/procedure invoices. One invoice per appointment is enforced by the database. Finalizing or voiding a linked invoice updates the appointment's payment status independently of its attendance status. Existing invoices remain available.
- **Medicine Inventory:** Create a medicine batch with its strength, expiry, selling price and reorder threshold. Start new purchase batches at zero quantity. Existing opening stock can be recorded here. Quantity corrections require a reason and produce a stock movement. Low-stock, 90-day near-expiry and expired-batch alerts appear above the inventory; movements appear below it.
- **Vendors:** Contact details, dated opening payable/advance credit, account balance and account ledger. Opening balance dates cannot move past existing transactions. Vendors with history cannot be deleted.
- **Medicine Purchases:** Choose a vendor and one or more existing medicine batches, enter quantities, costs, supplier reference, discount and payment. New batches are created in Medicine Inventory first. Finalizing adds stock and the unpaid amount to the vendor account.
- **Pharmacy Sales:** Choose a patient and medicine batches, enter quantities, selling prices, discount and payment. Finalizing deducts stock. Expired stock and overselling are rejected.
- **Vendor Payments:** Record and edit additional supplier payments. These reduce vendor balances. A negative vendor balance represents advance credit.

Documents have Draft, Finalized and Voided states. Drafts have no stock/account impact. Edits to finalized purchases/sales post only the quantity difference. Voiding reverses the impact; a purchase cannot be reversed if doing so would make stock negative. Finalized documents must be voided before deletion. Stock changes, document writes and their before/after audit events commit together in a D1 batch. Revision checks reject stale finance edits.

Invoices and sales receipts offer **Print / PDF**. The browser print dialog supports paper printing and Save as PDF. Printed documents include clinic identity, patient/vendor, document number/date, itemized charges, discount, paid amount and balance. Draft and voided documents are marked. Patient files include clinical invoices and pharmacy purchase history; collection reports exclude draft and voided documents.

## Local schema

Migration `drizzle/0003_pharmacy_operations.sql` adds finance documents, stock movements, concurrency guards, non-negative-stock triggers, invoice uniqueness and appointment follow-up links. It has been applied to the current local `.wrangler/state` database. Apply it once to other databases before running this version; do not replay it on this local database.

The existing local authentication and hosting configuration are preserved. This update does not publish the local site.

## Reception forms and letterhead prescriptions

Invoice and sales forms include **Save & Print / PDF** before the first save. The button validates, saves and prints the saved document. Patient names can be typed, and new patients are added in the same database batch as their document. Typed names reuse an existing unambiguous patient; ambiguous names require selecting the phone-number suggestion. New vendor names and new purchase batches can also be entered directly. Medicine sales still require an existing batch so stock remains traceable. Choice fields support keyboard entry and suggestions; operational status fields accept their defined values to preserve stock and payment behavior.

Digital Prescriptions recreates the supplied bilingual clinic letterhead with patient name, age, date, watermark and clinic footer. Clinicians can type or draw with mouse/touch/pen, undo strokes, save versions, and print/download a PDF. Longer typed prescriptions continue on additional letterhead pages. Drafts and amendments are visibly marked; clinic WhatsApp sending requires Approved status. The PDF retains the letterhead, Urdu text and handwriting.

Migration `0004_prescription_letterhead.sql` adds patient age, phone, date and handwriting to prescriptions and has been applied locally. The new prescription endpoint checks versions and records edits in the audit history.

**Save & Send** opens recipient review and PDF delivery options. Connected clinic WhatsApp uses Wasender's documented [media upload](https://api.wasenderapi.com/api-docs/messages/upload-media-file) and [document-message](https://api.wasenderapi.com/api-docs/messages/send-document-message) endpoints; send attempts are audit logged and repeated request IDs are rejected. The UI reports provider acceptance rather than claiming delivery. Without configured clinic WhatsApp, PDF download/device share remains available. No external patient message was sent during verification.

## Verification

`node --experimental-strip-types --test tests/commerce.test.ts` covers payment calculations, validation, draft/finalized stock effects, edit/void reversals, batch changes and vendor balances. TypeScript, API workflow checks, Chrome desktop/mobile checks and the production build are used for this update. Temporary QA fixtures are removed after the workflow checks.
