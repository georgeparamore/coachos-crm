export default function CommunityPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Community</div>
          <div className="page-sub">Discussion, announcements, and group interaction</div>
        </div>
      </div>

      <div className="community-shell">
        <aside className="community-categories">
          <div className="card-title">Categories</div>
          <a className="active" href="#all">All discussions</a>
          <a href="#announcements">Announcements</a>
          <a href="#general">General</a>
          <a href="#feedback">Feedback &amp; advice</a>
        </aside>
        <div className="community-empty card">
          <div className="empty-kicker">Community</div>
          <div className="page-title">A place for your people</div>
          <p>Posts, announcements, member discussions, events, and live sessions will appear here when Community launches.</p>
          <button className="btn btn-accent" disabled>Start a discussion</button>
        </div>
      </div>
    </div>
  );
}
