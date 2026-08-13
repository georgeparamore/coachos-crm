export const LEAD_STAGES = [
  { key: "new", label: "New", badge: "badge-blue" },
  { key: "in_conversation", label: "Contacted", badge: "badge-amber" },
  { key: "qualified", label: "Qualified", badge: "badge-blue" },
  { key: "consultation_booked", label: "Consultation booked", badge: "badge-purple" },
  { key: "proposal_sent", label: "Proposal sent", badge: "badge-purple" },
  { key: "won", label: "Won", badge: "badge-green" },
  { key: "lost", label: "Lost", badge: "badge-red" },
  { key: "spam_disqualified", label: "Spam / disqualified", badge: "badge-red" },
  { key: "signed", label: "Won (legacy)", badge: "badge-green" },
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number]["key"];

export type Lead = {
  id: string;
  coach_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: LeadStage;
  value_cents: number | null;
  fit_score: number | null;
  notes: string | null;
  follow_up_at: string | null;
  external_source?: string | null;
  external_id?: string | null;
  source_details?: Record<string, unknown>;
  business_id: string;
  service_interest: string | null;
  last_contacted_at: string | null;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
  website_url?: string | null;
  project_type?: "new_website" | "redesign" | "other" | null;
  business_description?: string | null;
  launch_timeframe?: string | null;
  budget_set_aside?: string | null;
  additional_notes?: string | null;
  assigned_to?: string | null;
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadInput = {
  business_id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  service_interest: string;
  stage: LeadStage;
  value_cents: number | null;
  fit_score: number | null;
  notes: string;
  follow_up_at: string | null;
  business_name?: string;
  website_url?: string;
  project_type?: "new_website" | "redesign" | "other" | null;
  business_description?: string;
  launch_timeframe?: string;
  budget_set_aside?: string;
  additional_notes?: string;
};
