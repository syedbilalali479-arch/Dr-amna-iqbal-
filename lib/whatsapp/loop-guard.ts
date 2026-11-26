// Loop protection and output guards for one engine-V3 turn (ported from the Dr. Alvi engine).
//  - hard cap on model calls per turn; the last permitted call must answer in plain text
//  - hard cap on tool calls; duplicate calls are not re-run; a mutating tool runs at most once a turn
//  - near-identical replies are caught; repeated clarification questions escalate to staff
//  - the model may not claim a booking/cancellation/change the backend did not commit, nor quote an unverified price

export const MAX_MODEL_CALLS = 4;
export const MAX_TOOL_CALLS = 6;
const MUTATING = new Set(["propose_booking", "propose_cancellation", "propose_reschedule", "confirm_pending_action", "discard_pending_action", "handover_to_human", "forward_to_doctor"]);

export function canonical(raw: unknown) {
  try {
    const value = (typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {}) as Record<string, unknown>;
    return JSON.stringify(Object.keys(value).sort().reduce<Record<string, unknown>>((acc, key) => { acc[key] = value[key]; return acc; }, {}));
  } catch { return String(raw); }
}

export function createTurnGuard() {
  const seen = new Map<string, unknown>();
  const mutated = new Set<string>();
  let modelCalls = 0, toolCalls = 0;
  return {
    beforeModelCall() {
      if (modelCalls >= MAX_MODEL_CALLS) return {allowed: false, forceText: true};
      modelCalls += 1;
      return {allowed: true, forceText: modelCalls >= MAX_MODEL_CALLS};
    },
    beforeToolCall(name: string, raw: unknown): {run: true; key: string} | {run: false; result: Record<string, unknown>} {
      const key = `${name}:${canonical(raw)}`;
      if (seen.has(key)) return {run: false, result: {...(seen.get(key) as object), note_for_assistant: "Duplicate call: this exact tool call already ran this turn. Use this result; do not call it again."}};
      if (toolCalls >= MAX_TOOL_CALLS) return {run: false, result: {status: "tool_limit_reached", note_for_assistant: "No more tool calls this turn. Answer the patient now with what you know, or ask one clarifying question."}};
      if (MUTATING.has(name) && mutated.has(name)) return {run: false, result: {status: "already_done_this_turn", note_for_assistant: `${name} already ran this turn. Do not call it again.`}};
      toolCalls += 1;
      return {run: true, key};
    },
    afterToolCall(name: string, key: string, result: unknown) { seen.set(key, result); if (MUTATING.has(name)) mutated.add(name); },
    stats: () => ({modelCalls, toolCalls}),
  };
}

// ---------- repetition ----------
export const evidence = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const tokens = (value: string) => new Set(evidence(value).split(" ").filter((w) => w.length > 1));
export function similarity(a: string, b: string) {
  const x = tokens(a), y = tokens(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / Math.max(x.size, y.size);
}
export function isRepeat(reply: string, recent: string[] = []) {
  const r = evidence(reply);
  if (!r) return false;
  return recent.some((previous) => { const p = evidence(previous); return p === r || (r.length > 25 && similarity(r, p) >= 0.88); });
}

const isQuestion = (reply: string) => /\?|؟/.test(String(reply || ""));
export type Clarifications = {key: string | null; count: number};
/** Counts identical short questions across turns; returns the new streak length. A patient who asks something new is engaged, not stuck. */
export function trackClarification(state: {clarifications?: Clarifications}, reply: string, patientMessage = "") {
  const patientAsks = /\?|؟|\b(?:kya|kia|kaise|kaisay|kitna|kitni|kitne|kab|kahan|kyun|kaun|what|how|when|where|why|which)\b/i.test(patientMessage);
  if (!isQuestion(reply) || reply.length > 180 || patientAsks) { state.clarifications = {key: null, count: 0}; return 0; }
  const key = evidence(reply).split(" ").slice(-8).join(" ");
  const previous = state.clarifications || {key: null, count: 0};
  const same = Boolean(previous.key) && similarity(previous.key!, key) >= 0.6;
  const count = same ? previous.count + 1 : 1;
  state.clarifications = {key: same ? previous.key : key, count};
  return count;
}

// ---------- output guards ----------
const CLAIM = /\b(?:(?:appointment|booking|apointment)\b.{0,40}\b(?:confirm(?:ed)?\s*(?:ho\s*gayi|ho\s*gai|hai|kar\s*di)|book\s*(?:ho\s*gayi|ho\s*gai|kar\s*di)|cancel\s*(?:ho\s*gayi|ho\s*gai|kar\s*di)|shift\s*(?:ho\s*gayi|kar\s*di)|has\s+been\s+(?:confirmed|booked|cancelled|canceled|moved|rescheduled)|is\s+(?:confirmed|booked|cancelled|canceled))|(?:i(?:'ve| have)|maine|main\s+ne)\s+(?:booked|cancelled|canceled|rescheduled|book\s+kar\s+di|cancel\s+kar\s+di))/iu;
const PRICE = /(?:PKR|Rs\.?|rupees?|rupay|rupaye)\s*[\d,]{3,}|[\d,]{3,}\s*(?:PKR|Rs\.?|rupees?|rupay|rupaye)/giu;
// Asking the patient to confirm something the backend never prepared: their "yes" would have nothing to run and the chat loops.
const CONFIRM_ASK = /\b(?:confirm|tasdeeq|kar\s*(?:doon|dun|du|dein\?)|shall\s+i|should\s+i|theek\s+hai\?|sahi\s+hai\?)/iu;
const OPERATION_WORD = /\b(?:appointment|booking|book|cancel\w*|shift|reschedul\w*|slot)\b/iu;
const digitsOf = (value: string) => value.replace(/\D/g, "");

export function outputIssues(reply: string, o: {committed: boolean; verifiedText?: string; recentReplies?: string[]; pendingOperation?: boolean}) {
  const issues: string[] = [];
  if (!o.committed && !o.pendingOperation && CONFIRM_ASK.test(reply) && OPERATION_WORD.test(reply)) issues.push("asked the patient to confirm a booking/cancellation/change that was never prepared; call the matching propose_ tool first, then ask them to confirm its summary");
  if (!reply.trim()) issues.push("empty reply");
  if (reply.length > 900) issues.push("too long for WhatsApp; keep it to a few short sentences");
  if (!o.committed && CLAIM.test(reply)) issues.push("claimed that an appointment was booked, cancelled or changed, but the backend has not done that; say you will confirm once the patient agrees");
  const verified = new Set((String(o.verifiedText || "").match(PRICE) || []).map(digitsOf));
  for (const quoted of reply.match(PRICE) || []) if (!verified.has(digitsOf(quoted))) { issues.push(`mentioned a price (${quoted.trim()}) that no tool or clinic fact provided; remove it`); break; }
  if (isRepeat(reply, o.recentReplies || [])) issues.push("repeated a message already sent in this chat; respond differently and move the conversation forward");
  return issues;
}

/** WhatsApp formatting: **bold** becomes *bold*, markdown headings are dropped. */
export const toWhatsApp = (reply: string) => String(reply || "").replace(/\*\*(.+?)\*\*/g, "*$1*").replace(/^#{1,6}\s+/gm, "").replace(/\n{3,}/g, "\n\n").trim();
