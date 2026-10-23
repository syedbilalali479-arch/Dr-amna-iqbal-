# Skinuvia Hybrid AI Architecture

## Separation of responsibilities

- **Language Brain** understands Roman Urdu, Urdu/English phrasing, spelling variants, and clinic-approved learned phrases. It may classify intent and propose a learning candidate, but it cannot write appointments, patients, payments, or prescriptions.
- **Deterministic Engine** extracts and validates booking fields, checks availability, calculates verified prices, and performs database actions. It is the only execution authority.
- **Hybrid Orchestrator** chooses one route per message, preserves conversation state during interruptions, enforces confidence thresholds, and records an audit/learning event.

## Loop prevention

Each patient conversation has one persisted state with the last question, message hash, known fields, missing fields, and loop counter. Repeated unresolved replies do not restart both engines. The orchestrator asks one stable question at a time and hands the conversation to staff after the loop limit.

## Controlled learning

New successful patient wording is saved as a Pending phrase profile. Pending phrases cannot affect routing. Repeated successful evidence can promote a phrase to Approved; staff can also edit, approve, disable, or delete it from the AI Brain tab. Failed or corrected interpretations are retained for review instead of silently retraining the live router.

## Safety boundaries

- AI interpretation never directly commits a booking or other clinical/business action.
- Treatment, date, time, and identity fields are deterministically validated before a booking is confirmed.
- Learned phrases do not create medical diagnoses or prescriptions.
- Every decision records the deterministic intent, brain intent, final intent, confidence, route, and outcome.

## Recommended operating policy

Review Pending phrases weekly, label staff corrections, and keep medical-advice and payment actions behind explicit deterministic rules. Increase the auto-approval evidence threshold after enough real conversations are available to measure false matches.
