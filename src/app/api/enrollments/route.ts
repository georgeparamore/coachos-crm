import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/log-server-error";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const courseId = typeof body?.courseId === "string" ? body.courseId : "";

  if (!clientId || !courseId) {
    return NextResponse.json({ error: "clientId and courseId are required" }, { status: 400 });
  }

  // RLS ("enrollments: coach full access to own rows") scopes this to
  // courses the caller actually owns — coach_id is set server-side by the
  // enrollments_set_coach_id trigger from courses.coach_id, not trusted
  // client input, so there's no separate ownership check needed here.
  const { error } = await supabase.from("enrollments").insert({ client_id: clientId, course_id: courseId });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "This client is already enrolled in that course" }, { status: 409 });
    }
    await logServerError(error, "enrollments.create", { userId: user.id, userEmail: user.email });
    return NextResponse.json({ error: "Failed to enroll client" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
