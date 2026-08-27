import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/school",
  "/auth",
  "/portfolio", // public marketing/portfolio site — no account required
  "/api/leads", // public contact-form lead intake for the marketing site
  "/sign", // client-facing contract signing links — no account required
  "/api/stripe/webhook", // verified via Stripe signature, not a user session
  "/api/meta/webhook", // verified via Meta's HMAC signature, not a user session
  "/api/zoom/webhook", // verified via Zoom's HMAC signature, not a user session
  "/api/contracts", // public contract fetch/sign, gated by an unguessable token
  "/realestate-demo", // client-facing mockup — no real data or auth behind it
  "/community-demo", // client-facing mockup — no real data or auth behind it
  "/privacy", // public privacy policy — required by Meta's app review, no account needed
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
