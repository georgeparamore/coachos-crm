"use client";

import { useState } from "react";
import { BookingFormModal } from "@/components/realestate-demo/booking-form-modal";
import { ListingFormModal } from "@/components/realestate-demo/listing-form-modal";
import { useRealEstateDemo } from "@/lib/realestate-demo-store";
import type { DemoListing } from "@/lib/realestate-demo-data";

const STATUS_BADGE: Record<DemoListing["status"], string> = {
  active: "badge-green",
  pending: "badge-amber",
  sold: "badge-blue",
};

function formatPrice(n: number) {
  return `$${(n / 1000).toFixed(0)}k`;
}

export function ListingsMap() {
  const { listings, addListing } = useRealEstateDemo();
  const [selected, setSelected] = useState<DemoListing | null>(null);
  const [filter, setFilter] = useState<"all" | DemoListing["status"]>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [booking, setBooking] = useState<DemoListing | null>(null);
  const [addingListing, setAddingListing] = useState(false);

  const visible = listings.filter((l) => filter === "all" || l.status === filter);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  }

  function handleBookingSubmit(details: { name: string; phone: string; date: string; time: string; notes: string }) {
    if (!booking) return;
    showToast(`Showing requested for ${details.name || "your client"} at ${booking.address} — ${details.date} ${details.time}. Added to your calendar for review.`);
    setBooking(null);
  }

  function handleAddListing(input: Parameters<typeof addListing>[0]) {
    addListing(input);
    setAddingListing(false);
    showToast(`${input.address} added to your listings.`);
  }

  return (
    <div>
      <div className="rd-leads-toolbar">
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
        <button className="btn btn-primary btn-sm" onClick={() => setAddingListing(true)}>
          + Add listing
        </button>
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
            {selected.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.photoUrl} alt={selected.address} className="rd-map-popup-photo" />
            )}
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
            <button
              className="btn btn-primary btn-sm"
              style={{ width: "100%", justifyContent: "center", marginTop: 6 }}
              onClick={() => setBooking(selected)}
            >
              Book a showing
            </button>
          </div>
        )}
      </div>

      <div className="rd-listing-grid">
        {visible.map((listing) => (
          <div key={listing.id} className="card rd-listing-card" style={{ marginBottom: 0 }}>
            {listing.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.photoUrl} alt={listing.address} className="rd-listing-card-photo" />
            ) : (
              <div className="rd-listing-card-photo rd-listing-card-photo-placeholder">No photo yet</div>
            )}
            <div className="rd-lead-card-top" style={{ marginTop: 10 }}>
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

      {booking && (
        <BookingFormModal listing={booking} onClose={() => setBooking(null)} onSubmit={handleBookingSubmit} />
      )}

      {addingListing && (
        <ListingFormModal onClose={() => setAddingListing(false)} onSubmit={handleAddListing} />
      )}

      {toast && <div className="rd-toast">{toast}</div>}
    </div>
  );
}
