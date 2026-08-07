import { MemberDirectory } from "@/components/community-demo/member-directory";

export default function MembersPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Members</div>
          <div className="page-sub">Everyone in the Ridgeline community.</div>
        </div>
      </div>
      <MemberDirectory />
    </div>
  );
}
