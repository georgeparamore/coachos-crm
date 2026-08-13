import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { SchoolLoginForm } from "@/components/school-login-form";

export default async function SchoolLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = createServiceClient();
  const { data: school } = await service.from("businesses").select("id, slug, portal_name, portal_tagline, color, portal_enabled").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (!school || !school.portal_enabled) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: membership } = await supabase.from("coach_client_memberships").select("id").eq("business_id", school.id).eq("client_id", user.id).eq("status", "active").maybeSingle();
    if (membership) redirect(`/school/${slug}/classroom`);
  }
  return <main className="school-auth" style={{ "--school-color": school.color } as React.CSSProperties}>
    <div className="school-auth-card card">
      <div className="school-mark" style={{ background: school.color }}>{school.portal_name.slice(0, 1).toUpperCase()}</div>
      <div className="logo-name">{school.portal_name}</div>
      <p className="page-sub">{school.portal_tagline}</p>
      <SchoolLoginForm businessId={school.id} slug={school.slug} />
      <p className="sub" style={{ textAlign: "center", marginTop: 16 }}>Student portal · Powered by Full Circle CRM</p>
    </div>
  </main>;
}
