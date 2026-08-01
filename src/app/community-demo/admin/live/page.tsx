import { LiveStreamManager } from "@/components/community-demo/live-stream-manager";

export default function AdminLivePage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Live streaming</div>
          <div className="page-sub">Go live from Google Meet, Zoom, or Ridgeline&apos;s built-in player.</div>
        </div>
      </div>
      <LiveStreamManager />
    </div>
  );
}
