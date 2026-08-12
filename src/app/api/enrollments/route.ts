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

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const courseId = typeof body?.courseId === "string" ? body.courseId : "";
  const clientIds = Array.isArray(body?.clientIds)
    ? [...new Set(body.clientIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0))]
    : null;
  if (!courseId || !clientIds) return NextResponse.json({ error: "courseId and clientIds are required" }, { status: 400 });

  const { data: course } = await supabase.from("courses").select("id").eq("id", courseId).eq("coach_id", user.id).maybeSingle();
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  if (clientIds.length) {
    const { data: memberships, error: membershipsError } = await supabase
      .from("coach_client_memberships")
      .select("client_id")
      .eq("coach_id", user.id)
      .eq("status", "active")
      .in("client_id", clientIds);
    if (membershipsError) {
      await logServerError(membershipsError, "enrollments.memberships", { userId: user.id, userEmail: user.email });
      return NextResponse.json({ error: "Could not verify clients" }, { status: 500 });
    }
    if ((memberships ?? []).length !== clientIds.length) return NextResponse.json({ error: "One or more clients are unavailable" }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase.from("enrollments").select("id, client_id").eq("course_id", courseId).eq("coach_id", user.id);
  if (existingError) {
    await logServerError(existingError, "enrollments.list-for-update", { userId: user.id, userEmail: user.email });
    return NextResponse.json({ error: "Could not load current enrollments" }, { status: 500 });
  }

  const wanted = new Set(clientIds);
  const current = new Set((existing ?? []).map((row) => row.client_id));
  const removeIds = (existing ?? []).filter((row) => !wanted.has(row.client_id)).map((row) => row.id);
  const addIds = clientIds.filter((clientId) => !current.has(clientId));

  const operations = [];
  if (removeIds.length) operations.push(supabase.from("enrollments").delete().in("id", removeIds));
  if (addIds.length) operations.push(supabase.from("enrollments").insert(addIds.map((clientId) => ({ course_id: courseId, client_id: clientId }))));
  const results = await Promise.all(operations);
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    await logServerError(failed.error, "enrollments.bulk-update", { userId: user.id, userEmail: user.email });
    return NextResponse.json({ error: "Failed to update enrollments" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, clientIds });
}
