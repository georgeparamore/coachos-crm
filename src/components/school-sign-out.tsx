"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SchoolSignOut({ slug }: { slug: string }) {
  const router = useRouter();
  return <button className="btn btn-sm" onClick={async () => { await createClient().auth.signOut(); router.push(`/school/${slug}/login`); router.refresh(); }}>Sign out</button>;
}
