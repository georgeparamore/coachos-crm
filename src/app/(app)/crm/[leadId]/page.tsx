import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Lead } from "@/lib/leads";
import { LEAD_STAGES } from "@/lib/leads";

function value(value: unknown) { return typeof value === "string" && value.trim() ? value : "—"; }

export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: lead }, { data: activities }] = await Promise.all([
    supabase.from("leads").select("*, businesses(name,color)").eq("id", leadId).eq("coach_id", user!.id).maybeSingle(),
    supabase.from("lead_activities").select("id,activity_type,note,metadata,occurred_at").eq("lead_id", leadId).eq("coach_id", user!.id).order("occurred_at", { ascending: false }),
  ]);
  if (!lead) notFound();
  const row = lead as Lead & { businesses?: { name: string; color: string } };
  const details = row.source_details ?? {};
  return <div className="page">
    <div className="page-header"><div><Link className="sub" href="/crm">← All leads</Link><div className="page-title" style={{ marginTop: 8 }}>{row.name}</div><div className="page-sub">{row.businesses?.name} · {LEAD_STAGES.find((stage) => stage.key === row.stage)?.label ?? row.stage}</div></div><Link className="btn btn-primary" href={`/crm?lead=${row.id}`}>Edit lead</Link></div>
    <div className="two-col"><div>
      <div className="card"><div className="card-title">Contact & project</div><div className="lead-detail-grid">
        <div><span>Email</span><strong>{value(row.email)}</strong></div><div><span>Phone</span><strong>{value(row.phone)}</strong></div>
        <div><span>Business</span><strong>{value(row.business_name)}</strong></div><div><span>Website</span><strong>{value(row.website_url)}</strong></div>
        <div><span>Project</span><strong>{value(row.project_type?.replaceAll("_", " "))}</strong></div><div><span>Budget</span><strong>{value(row.budget_set_aside)}</strong></div>
        <div><span>Desired launch</span><strong>{value(row.launch_timeframe)}</strong></div><div><span>Submitted</span><strong>{row.submitted_at ? new Date(row.submitted_at).toLocaleString() : new Date(row.created_at).toLocaleString()}</strong></div>
      </div></div>
      <div className="card"><div className="card-title">Qualification notes</div><p className="page-sub">{value(row.business_description)}</p>{row.notes && <pre className="lead-answer-block">{row.notes}</pre>}</div>
      <div className="card"><div className="card-title">Meta provenance</div><div className="lead-detail-grid"><div><span>Lead ID</span><strong>{value(row.external_id)}</strong></div><div><span>Form</span><strong>{value(details.form_name)}</strong></div><div><span>Page</span><strong>{value(details.page_name)}</strong></div><div><span>Campaign</span><strong>{value(details.campaign_name)}</strong></div><div><span>Ad set</span><strong>{value(details.adset_name)}</strong></div><div><span>Ad</span><strong>{value(details.ad_name)}</strong></div></div></div>
    </div><aside><div className="card"><div className="card-title">Activity</div>{(activities ?? []).length ? (activities ?? []).map((activity) => <div className="lead-activity" key={activity.id}><span>{activity.activity_type.replaceAll("_", " ")}</span><strong>{activity.note || "Activity recorded"}</strong><small>{new Date(activity.occurred_at).toLocaleString()}</small></div>) : <p className="sub">No activity yet.</p>}</div></aside></div>
  </div>;
}
