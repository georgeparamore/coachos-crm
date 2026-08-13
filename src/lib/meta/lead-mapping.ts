export type MetaField = { name: string; values?: string[] };

export type MappedWebsiteLead = {
  first_name: string | null;
  last_name: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  website_url: string | null;
  project_type: "new_website" | "redesign" | "other" | null;
  business_description: string | null;
  launch_timeframe: string | null;
  budget_set_aside: string | null;
  additional_notes: string | null;
  answers: Record<string, string>;
};

export function normalizeFieldKey(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function answerMap(fieldData: MetaField[] = []) {
  return Object.fromEntries(fieldData.map((field) => [normalizeFieldKey(field.name), (field.values ?? []).join(", ").trim()]));
}

function first(answers: Record<string, string>, keys: string[]) {
  for (const key of keys) if (answers[key]?.trim()) return answers[key].trim();
  return "";
}

function projectType(value: string): MappedWebsiteLead["project_type"] {
  const normalized = value.toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("redesign")) return "redesign";
  if (normalized.includes("new")) return "new_website";
  return "other";
}

export function mapWebsiteLead(fieldData: MetaField[] = []): MappedWebsiteLead {
  const answers = answerMap(fieldData);
  const firstName = first(answers, ["first_name", "firstname"]);
  const lastName = first(answers, ["last_name", "lastname"]);
  const email = first(answers, ["email", "email_address", "work_email"]);
  const phone = first(answers, ["phone_number", "phone", "mobile_number"]);
  const fullName = first(answers, ["full_name", "name", "what_is_your_full_name"])
    || [firstName, lastName].filter(Boolean).join(" ") || email || phone || "New Meta lead";
  const project = first(answers, ["project_type", "do_you_need_a_new_website_or_a_redesign", "new_website_or_redesign"]);
  return {
    first_name: firstName || null,
    last_name: lastName || null,
    name: fullName,
    email: email || null,
    phone: phone || null,
    business_name: first(answers, ["business_name", "company_name", "what_is_your_business_name"]) || null,
    website_url: first(answers, ["website_url", "website", "current_website", "what_is_your_current_website_if_you_have_one"]) || null,
    project_type: projectType(project),
    business_description: first(answers, ["business_description", "briefly_what_does_your_business_offer", "what_does_your_business_offer"]) || null,
    launch_timeframe: first(answers, ["launch_timeframe", "when_would_you_like_your_website_completed", "desired_launch_timeframe"]) || null,
    budget_set_aside: first(answers, ["budget", "budget_set_aside", "what_budget_have_you_set_aside_for_this_project"]) || null,
    additional_notes: first(answers, ["additional_notes", "notes", "anything_else"]) || null,
    answers,
  };
}
