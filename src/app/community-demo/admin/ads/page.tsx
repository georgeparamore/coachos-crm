import { AdPerformance } from "@/components/community-demo/ad-performance";

export default function AdminAdsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Ad performance</div>
          <div className="page-sub">Campaign spend and results from your connected ad accounts.</div>
        </div>
      </div>
      <AdPerformance />
    </div>
  );
}
