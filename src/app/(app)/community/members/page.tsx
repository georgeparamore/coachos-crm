import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DataLoadError } from "@/components/data-load-error";
import { logServerError } from "@/lib/log-server-error";
import type { CommunityMember } from "@/components/community-hub";

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default async function CommunityMembersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isCoach = profile?.role !== "client";
  let coachId = user.id;
  if (!isCoach) {
    const { data: membership } = await supabase.from("coach_client_memberships").select("coach_id").eq("client_id", user.id).eq("status", "active").order("accepted_at", { ascending: false }).limit(1).maybeSingle();
    if (!membership) return <div className="page"><div className="empty-state"><p>Community access is still pending.</p></div></div>;
    coachId = membership.coach_id;
  }

  const { data, error } = await supabase.rpc("community_member_directory", { target_coach_id: coachId });
  if (error) await logServerError(error, "community.members.load", { userId: user.id, userEmail: user.email });
  const members = ((data ?? []) as CommunityMember[]).sort((a, b) => {
    if (a.role === "coach" && b.role !== "coach") return -1;
    if (a.role !== "coach" && b.role === "coach") return 1;
    return (a.full_name || "").localeCompare(b.full_name || "");
  });

  return <div className="page">
    <div className="page-header"><div><div className="page-title">Members</div><div className="page-sub">Everyone in your community</div></div><span className="badge badge-blue">{members.length} {members.length === 1 ? "member" : "members"}</span></div>
    {error && <DataLoadError what="community members" />}
    <div className="card community-directory-card">
      {members.length === 0 ? <div className="empty-state"><p>No members have joined yet.</p></div> : members.map((member) => <div className="community-directory-row" key={member.id}>
        <div className="avatar community-avatar">{initials(member.full_name || "Member")}</div>
        <div><strong>{member.full_name || "Community member"}</strong><span>{member.role === "coach" ? "Coach · Host" : "Member"}</span></div>
        {member.role === "coach" && <span className="badge badge-blue">Host</span>}
      </div>)}
    </div>
  </div>;
}
