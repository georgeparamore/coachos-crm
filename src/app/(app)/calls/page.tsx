import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { DiscoveryCall } from "@/lib/discovery-calls";
import { DISCOVERY_CALL_STATUS_LABELS } from "@/lib/discovery-calls";

export default async function DiscoveryCallsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: calls }, { data: businesses }] = await Promise.all([
    supabase.from("discovery_calls").select("*, businesses(name,color), leads(name,email)").eq("coach_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("businesses").select("id,name,color").eq("coach_id", user!.id).eq("is_active", true).order("name"),
  ]);
  const rows = (calls as DiscoveryCall[]) ?? [];
  const readyCount = rows.filter((call) => call.status === "completed").length;
  const attentionCount = rows.filter((call) => call.status === "failed").length;

  return <div className="page">
    <div className="page-header"><div><div className="page-title">Discovery calls</div><div className="page-sub">Recordings transformed into clear, build-ready client requirements</div></div><Link className="btn" href="/settings">Zoom setup</Link></div>
    <div className="pipeline-summary" style={{ marginBottom: 22 }}><span><strong>{rows.length}</strong> total calls</span><span><strong>{readyCount}</strong> briefs ready</span><span><strong>{attentionCount}</strong> need attention</span></div>
    {rows.length ? <div className="call-list">{rows.map((call) => {
      const brief = call.project_brief;
      const statusClass = call.status === "completed" ? "badge-green" : call.status === "failed" ? "badge-red" : "badge-amber";
      return <Link className="card call-list-card" href={`/calls/${call.id}`} key={call.id}>
        <div className="call-list-main"><div className="call-list-title">{call.topic}</div><div className="sub">{call.started_at ? new Date(call.started_at).toLocaleString() : new Date(call.created_at).toLocaleString()} {call.duration_minutes != null ? `· ${call.duration_minutes} min` : ""}</div>{brief?.what_to_build && <p>{brief.what_to_build}</p>}</div>
        <div className="call-list-meta"><span className={`badge ${statusClass}`}>{DISCOVERY_CALL_STATUS_LABELS[call.status]}</span>{call.businesses && <span className="business-chip"><span style={{ background: call.businesses.color }} />{call.businesses.name}</span>}<span className="sub">{call.leads?.name ?? "Unlinked lead"} →</span></div>
      </Link>;
    })}</div> : <div className="card empty-call-state"><div className="card-title">No discovery calls yet</div><p className="sub">Once Zoom is connected, completed cloud recordings will appear here automatically.</p><Link className="btn btn-primary" href="/settings">Set up Zoom</Link></div>}
    {businesses?.length === 0 && <p className="sub">Add a business in Settings before routing discovery calls.</p>}
  </div>;
}

