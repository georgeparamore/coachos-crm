"use client";

import { useState } from "react";
import { DEMO_LISTINGS, type DemoListing } from "@/lib/realestate-demo-data";

const STATUS_BADGE: Record<DemoListing["status"], string> = {
  active: "badge-green",
  pending: "badge-amber",
  sold: "badge-blue",
};

function formatPrice(n: number) {
  return `$${(n / 1000).toFixed(0)}k`;
}

export function ListingsMap() {
  const [selected, setSelected] = useState<DemoListing | null>(null);
  const [filter, setFilter] = useState<"all" | DemoListing["status"]>("all");
  const [toast, setToast] = useState<string | null>(null);

  const visible = DEMO_LISTINGS.filter((l) => filter === "all" || l.status === filter);

  function bookShowing(listing: DemoListing) {
    setToast(`Showing request drafted for ${listing.address} — added to your calendar for review.`);
    setTimeout(() => setToast(null), 3200);
  }

  return (
    <div>
      <div className="rd-map-filters">
        {(["all", "active", "pending", "sold"] as const).map((f) => (
          <button
            key={f}
            className={`btn btn-sm${filter === f ? " btn-primary" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All listings" : f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="rd-map">
        <div className="rd-map-grid" />
        {visible.map((listing) => (
          <button
            key={listing.id}
            className={`rd-map-pin${selected?.id === listing.id ? " rd-map-pin-active" : ""}`}
            style={{ top: listing.top, left: listing.left }}
            onClick={() => setSelected(listing)}
            aria-label={listing.address}
          >
            {formatPrice(listing.price)}
          </button>
        ))}

        {selected && (
          <div className="rd-map-popup">
            <button className="rd-map-popup-close" onClick={() => setSelected(null)} aria-label="Close">
              ×
            </button>
            <div className="rd-map-popup-price">${selected.price.toLocaleString()}</div>
            <div className="page-sub">
              {selected.address}, {selected.city}
            </div>
            <div className="mini-stat-row" style={{ padding: "8px 0 4px" }}>
              <span className="mini-stat-label">
                {selected.beds} bd · {selected.baths} ba · {selected.sqft.toLocaleString()} sqft
              </span>
              <span className={`badge ${STATUS_BADGE[selected.status]}`}>{selected.status}</span>
            </div>
            <button className="btn btn-primary btn-sm" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={() => bookShowing(selected)}>
              Book a showing
            </button>
          </div>
        )}
      </div>

      <div className="rd-listing-grid">
        {visible.map((listing) => (
          <div key={listing.id} className="card" style={{ marginBottom: 0 }}>
            <div className="rd-lead-card-top">
              <span className="rd-lead-name">${listing.price.toLocaleString()}</span>
              <span className={`badge ${STATUS_BADGE[listing.status]}`}>{listing.status}</span>
            </div>
            <div className="page-sub" style={{ marginTop: 2 }}>
              {listing.address}, {listing.city}
            </div>
            <div className="mini-stat-label" style={{ marginTop: 8 }}>
              {listing.beds} bd · {listing.baths} ba · {listing.sqft.toLocaleString()} sqft
            </div>
          </div>
        ))}
      </div>

      {toast && <div className="rd-toast">{toast}</div>}
    </div>
  );
}
