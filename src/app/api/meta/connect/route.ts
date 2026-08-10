import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signOAuthState } from "@/lib/meta/crypto";
import { buildAuthorizeUrl } from "@/lib/meta/client";

// Needs Node's crypto module (via signOAuthState) — not Edge-compatible.
export const runtime = "nodejs";

function getRedirectUri(request: Request) {
  // Keep the OAuth round trip on the exact host the coach is using. This is
  // especially important for Vercel aliases: using a separately configured
  // app URL here can make Meta reject the callback or send the coach back to
  // an older deployment.
  return new URL("/api/meta/callback", request.url).toString();
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "coach") {
    return NextResponse.json({ error: "Only a coach account can connect Meta Ads" }, { status: 403 });
  }

  let authorizeUrl: string;
  try {
    const state = signOAuthState(user.id);
    authorizeUrl = buildAuthorizeUrl(getRedirectUri(request), state);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Meta Ads is not configured yet";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.redirect(authorizeUrl);
}
