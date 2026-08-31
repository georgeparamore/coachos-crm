export type DiscoveryCallStatus = "queued" | "processing" | "completed" | "failed";

export type DiscoveryProjectBrief = {
  executive_summary: string;
  what_to_build: string;
  project_type: string;
  vision: string;
  target_audience: string;
  core_features: string[];
  must_haves: string[];
  nice_to_haves: string[];
  design_direction: string[];
  references: string[];
  integrations: string[];
  content_needs: string[];
  budget: string;
  timeline: string;
  risks: string[];
  open_questions: string[];
  next_steps: string[];
  confidence_notes: string;
};

export type DiscoveryCall = {
  id: string;
  coach_id: string;
  business_id: string;
  lead_id: string | null;
  client_id: string | null;
  topic: string;
  host_email: string | null;
  participant_emails: string[];
  started_at: string | null;
  duration_minutes: number | null;
  recording_completed_at: string | null;
  recording_play_url: string | null;
  status: DiscoveryCallStatus;
  transcript: string | null;
  project_brief: DiscoveryProjectBrief | null;
  processing_attempts: number;
  last_error: string | null;
  processed_at: string | null;
  created_at: string;
  businesses?: { name: string; color: string };
  leads?: { name: string; email: string | null } | null;
};

export const DISCOVERY_CALL_STATUS_LABELS: Record<DiscoveryCallStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  completed: "Ready",
  failed: "Needs attention",
};
