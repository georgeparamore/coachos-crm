import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DiscoveryCallActions } from "@/components/discovery-call-actions";
import type { DiscoveryCall, DiscoveryProjectBrief } from "@/lib/discovery-calls";
import { DISCOVERY_CALL_STATUS_LABELS } from "@/lib/discovery-calls";
import { DiscoveryTranscript } from "@/components/discovery-transcript";
import { LocalDateTime } from "@/components/local-date-time";
import { AssistantCallBriefing } from "@/components/assistant-call-briefing";

function ListSection({ title, items }: { title: string; items: string[] }) {
  return <section className="brief-section"><h3>{title}</h3>{items.length ? <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul> : <p className="sub">Nothing identified.</p>}</section>;
}

export default async function DiscoveryCallDetailPage({ params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: call } = await supabase.from("discovery_calls").select("*, businesses(name,color), leads(name,email)").eq("id", callId).eq("coach_id", user!.id).maybeSingle();
  if (!call) notFound();
  const row = call as DiscoveryCall;
  const brief = row.project_brief as DiscoveryProjectBrief | null;
  const { data: leads } = await supabase.from("leads").select("id,name,email").eq("coach_id", user!.id).eq("business_id", row.business_id).is("deleted_at", null).order("created_at", { ascending: false });
  const statusClass = row.status === "completed" ? "badge-green" : row.status === "failed" ? "badge-red" : "badge-amber";

  return <div className="page">
    <div className="page-header"><div><Link className="sub" href="/calls">← Discovery calls</Link><div className="page-title" style={{ marginTop: 8 }}>{row.topic}</div><div className="page-sub">{row.started_at ? <LocalDateTime value={row.started_at} /> : "Date unavailable"}{row.duration_minutes != null ? ` · ${row.duration_minutes} minutes` : ""}</div></div><div style={{ display: "flex", gap: 8, alignItems: "center" }}><span className={`badge ${statusClass}`}>{DISCOVERY_CALL_STATUS_LABELS[row.status]}</span>{row.recording_play_url && <a className="btn" href={row.recording_play_url} target="_blank" rel="noreferrer">Open recording ↗</a>}</div></div>
    {row.status === "failed" && <div className="card" style={{ background: "var(--red-bg)", border: "none", color: "var(--red-text)" }}><strong>Processing needs attention</strong><p style={{ margin: "6px 0 0" }}>{row.last_error}</p></div>}
    {(row.status === "queued" || row.status === "processing") && <div className="card" style={{ background: "var(--amber-bg)", border: "none" }}><strong>{row.status === "queued" ? "Waiting to process" : "Creating the transcript and project brief…"}</strong><p className="sub" style={{ margin: "6px 0 0" }}>This page will show the finished brief when processing completes.</p></div>}
    <div className="two-col"><main>
      {brief ? <>
        <div className="card brief-hero"><div className="brief-hero-heading"><h2>What George should build</h2><AssistantCallBriefing topic={row.topic} brief={brief} /></div><p className="brief-build-direction">{brief.what_to_build}</p><p>{brief.executive_summary}</p></div>
        <div className="card"><div className="card-title">Project direction</div><div className="lead-detail-grid"><div><span>Project type</span><strong>{brief.project_type}</strong></div><div><span>Target audience</span><strong>{brief.target_audience}</strong></div><div><span>Budget</span><strong>{brief.budget}</strong></div><div><span>Timeline</span><strong>{brief.timeline}</strong></div></div><div className="brief-vision"><span>Vision</span><p>{brief.vision}</p></div></div>
        <div className="card brief-grid"><ListSection title="Core features" items={brief.core_features} /><ListSection title="Must-haves" items={brief.must_haves} /><ListSection title="Nice-to-haves" items={brief.nice_to_haves} /><ListSection title="Design direction" items={brief.design_direction} /><ListSection title="Integrations" items={brief.integrations} /><ListSection title="Content needed" items={brief.content_needs} /><ListSection title="References" items={brief.references} /><ListSection title="Risks" items={brief.risks} /><ListSection title="Open questions" items={brief.open_questions} /><ListSection title="Next steps" items={brief.next_steps} /></div>
        {brief.confidence_notes && <div className="card"><div className="card-title">Confidence notes</div><p className="page-sub">{brief.confidence_notes}</p></div>}
      </> : null}
      {row.transcript && <DiscoveryTranscript transcript={row.transcript} />}
    </main><aside><DiscoveryCallActions callId={row.id} currentLeadId={row.lead_id} leads={leads ?? []} canRetry={row.status === "failed"} canReprocess={row.status === "completed" && !row.transcript?.startsWith("[[")} /><div className="card"><div className="card-title">Call details</div><div className="lead-detail-grid one-column"><div><span>Business</span><strong>{row.businesses?.name ?? "—"}</strong></div><div><span>Lead</span><strong>{row.leads?.name ?? "Not linked"}</strong></div><div><span>Host</span><strong>{row.host_email ?? "—"}</strong></div><div><span>Processed</span><strong>{row.processed_at ? <LocalDateTime value={row.processed_at} /> : "—"}</strong></div></div></div></aside></div>
  </div>;
}
