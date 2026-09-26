export function discoveryCallSegmentCount(durationMinutes: number | null | undefined, recordingBytes: number | null | undefined, segmentSeconds: number, directBytes: number) {
  const durationSeconds = Number(durationMinutes ?? 0) * 60;
  const shouldChunk = durationSeconds > segmentSeconds || Number(recordingBytes ?? 0) > directBytes;
  return shouldChunk ? Math.max(1, Math.ceil(Math.max(durationSeconds, segmentSeconds) / segmentSeconds)) : 1;
}

export function workflowErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) return String(error.message);
  return String(error || "Discovery-call processing failed");
}
