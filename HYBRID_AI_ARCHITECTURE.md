# Skinuvia Hybrid AI Architecture

## Separation of responsibilities

- **Language Brain** first uses the free local phrase classifier for Roman Urdu, Urdu/English phrasing, spelling variants, and clinic-approved learned phrases. Only unresolved messages may use Gemini as a short structured intent-classification fallback. Neither brain can write appointments, patients, payments, or prescriptions.
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

## Gemini cost controls

- Deterministic rules, active booking state, and approved local phrases run before Gemini and cost no model tokens.
- Repeated identical messages do not trigger another Gemini request.
- Gemini receives only the current message (maximum 500 characters), returns a tiny JSON intent, uses temperature 0, and has an 80-token output cap.
- The request times out after 2.5 seconds and fails open to the normal clarification flow.
- `GEMINI_DAILY_CALL_LIMIT` defaults to 150 calls per clinic day; `GEMINI_MODEL` defaults to `gemini-2.5-flash-lite`.
- The API key is a server-side `GEMINI_API_KEY` runtime secret and is never returned to the browser or stored in clinic records.

## Recommended operating policy

Review Pending phrases weekly, label staff corrections, and keep medical-advice and payment actions behind explicit deterministic rules. Increase the auto-approval evidence threshold after enough real conversations are available to measure false matches.
