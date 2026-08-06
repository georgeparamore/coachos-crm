import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signOAuthState } from "@/lib/meta/crypto";
import { buildAuthorizeUrl } from "@/lib/meta/client";

// Needs Node's crypto module (via signOAuthState) — not Edge-compatible.
export const runtime = "nodejs";

function getRedirectUri() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl}/api/meta/callback`;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "coach") {
    return NextResponse.json({ error: "Only a coach account can connect Meta Ads" }, { status: 403 });
  }

  let authorizeUrl: string;
  try {
    const state = signOAuthState(user.id);
    authorizeUrl = buildAuthorizeUrl(getRedirectUri(), state);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Meta Ads is not configured yet";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.redirect(authorizeUrl);
}
