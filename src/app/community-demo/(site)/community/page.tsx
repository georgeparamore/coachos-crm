import { CommunityFeed } from "@/components/community-demo/community-feed";

export default function CommunityPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Community</div>
          <div className="page-sub">Posts, wins, and questions from the whole Ridgeline community.</div>
        </div>
      </div>
      <CommunityFeed />
    </div>
  );
}
