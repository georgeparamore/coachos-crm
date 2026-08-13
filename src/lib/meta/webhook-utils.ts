import { createHmac, timingSafeEqual } from "crypto";

export function signatureIsValid(raw: string, signature: string | null, appSecret: string | undefined) {
  if (!appSecret || !signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", appSecret).update(raw).digest("hex"));
  const supplied = Buffer.from(signature.slice(7));
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function shouldProcessEvent(status: string | null | undefined) {
  return status !== "processed" && status !== "duplicate";
}

export function leadgenChanges(body: { entry?: { changes?: { field?: string; value?: Record<string, unknown> }[] }[] }) {
  return (body.entry ?? []).flatMap((entry) => entry.changes ?? []).filter((change) => change.field === "leadgen").map((change) => change.value ?? {});
}
