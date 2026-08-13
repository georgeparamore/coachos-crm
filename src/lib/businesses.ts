export type Business = {
  id: string;
  coach_id: string;
  name: string;
  slug: string;
  color: string;
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export function businessSlug(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "business";
}
