// Parses WaSender webhook payloads into simple inbound items.
export type InboundKind = "text" | "audio" | "image" | "document" | "call";
export type InboundItem = {
  providerMessageId: string;
  contactKey: string; // stable per-patient key: "+92300..." or "<id>@lid"
  replyTo: string; // what we pass to WaSender send-message "to"
  pushName?: string;
  kind: InboundKind;
  text: string;
  raw: Record<string, unknown>;
};

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Real phone number when available, otherwise the private @lid id (WaSender can reply to it). */
export function senderFromJids(...jids: Array<unknown>): {contactKey: string; replyTo: string} | null {
  let lid: string | null = null;
  for (const value of jids) {
    const jid = str(value);
    if (!jid) continue;
    if (/@(g\.us|broadcast|newsletter)$/.test(jid)) return null;
    if (jid.endsWith("@lid")) { lid ??= jid; continue; }
    const digits = jid.split("@")[0].split(":")[0].replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) {
      const phone = digits.startsWith("03") && digits.length === 11 ? "+92" + digits.slice(1) : "+" + digits;
      return {contactKey: phone, replyTo: phone};
    }
  }
  return lid ? {contactKey: lid, replyTo: lid} : null;
}

function isEmojiOnly(value: string) {
  if (!/\p{Extended_Pictographic}/u.test(value)) return false;
  return value.replace(/\p{Extended_Pictographic}|[︎️‍\u{1F3FB}-\u{1F3FF}\s.!?,]/gu, "").length === 0;
}

export function parseWebhook(payload: unknown): {event: string; items: InboundItem[]} {
  const body = rec(payload) || {};
  const event = String(body.event || "");
  const data = rec(body.data);
  if (event === "call") {
    const call = rec(data?.call);
    const id = str(call?.id);
    const sender = senderFromJids(call?.callerPn, call?.from, call?.chatId);
    if (!id || !sender) return {event, items: []};
    return {event, items: [{providerMessageId: `call:${id}`, ...sender, kind: "call", text: "[Missed WhatsApp call]", raw: call || {}}]};
  }
  if (!["messages.received", "messages.upsert", "messages-personal.received"].includes(event)) return {event, items: []};
  const rawMessages = data?.messages;
  const list = Array.isArray(rawMessages) ? rawMessages : [rawMessages];
  const items: InboundItem[] = [];
  for (const candidate of list) {
    const m = rec(candidate);
    const key = rec(m?.key);
    if (!m || !key || key.fromMe === true) continue;
    const id = str(key.id);
    const sender = senderFromJids(key.cleanedSenderPn, key.senderPn, key.cleanedParticipantPn, key.remoteJid);
    if (!id || !sender) continue;
    const content = rec(m.message);
    const audio = rec(content?.audioMessage), image = rec(content?.imageMessage), document = rec(content?.documentMessage);
    const caption = str(rec(content?.extendedTextMessage)?.text) ?? str(image?.caption) ?? str(rec(content?.videoMessage)?.caption) ?? str(document?.caption) ?? str(content?.conversation);
    const text = str(m.messageBody) ?? caption ?? "";
    const kind: InboundKind = audio ? "audio" : image ? "image" : document ? "document" : "text";
    if (kind === "text" && (!text || isEmojiOnly(text))) continue;
    items.push({providerMessageId: id, ...sender, pushName: str(m.pushName) ?? undefined, kind, text: text || (kind === "audio" ? "[Voice note]" : kind === "image" ? "[Image]" : "[Document]"), raw: m});
  }
  return {event, items};
}
