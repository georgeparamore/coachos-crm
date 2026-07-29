"use client";

import { useState } from "react";
import type { DemoListing } from "@/lib/realestate-demo-data";

type NewListingInput = Omit<DemoListing, "id" | "top" | "left">;

export function ListingFormModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (listing: NewListingInput) => void;
}) {
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");
  const [beds, setBeds] = useState("3");
  const [baths, setBaths] = useState("2");
  const [sqft, setSqft] = useState("");
  const [status, setStatus] = useState<DemoListing["status"]>("active");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Local preview only — this demo doesn't upload anywhere, a real build
    // would send this to storage and geocode the address via Mapbox.
    setPhotoUrl(URL.createObjectURL(file));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      address,
      city,
      price: Number(price) || 0,
      beds: Number(beds) || 0,
      baths: Number(baths) || 0,
      sqft: Number(sqft) || 0,
      status,
      photoUrl: photoUrl ?? undefined,
    });
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="card-title">Add a listing</div>

        <label className="rd-field">
          <span className="rd-field-label">Address</span>
          <input
            className="rd-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St"
            required
          />
        </label>

        <label className="rd-field">
          <span className="rd-field-label">City, state</span>
          <input
            className="rd-input"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Scottsdale, AZ"
            required
          />
        </label>

        <div className="two-col" style={{ marginBottom: 0 }}>
          <label className="rd-field">
            <span className="rd-field-label">Price</span>
            <input
              className="rd-input"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="650000"
              required
            />
          </label>
          <label className="rd-field">
            <span className="rd-field-label">Status</span>
            <select
              className="rd-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as DemoListing["status"])}
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="sold">Sold</option>
            </select>
          </label>
        </div>

        <div className="three-col" style={{ marginBottom: 0 }}>
          <label className="rd-field">
            <span className="rd-field-label">Beds</span>
            <input className="rd-input" type="number" value={beds} onChange={(e) => setBeds(e.target.value)} />
          </label>
          <label className="rd-field">
            <span className="rd-field-label">Baths</span>
            <input className="rd-input" type="number" value={baths} onChange={(e) => setBaths(e.target.value)} />
          </label>
          <label className="rd-field">
            <span className="rd-field-label">Sqft</span>
            <input className="rd-input" type="number" value={sqft} onChange={(e) => setSqft(e.target.value)} />
          </label>
        </div>

        <label className="rd-field">
          <span className="rd-field-label">Photo</span>
          <input className="rd-input" type="file" accept="image/*" onChange={handlePhoto} />
        </label>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="Listing preview" className="rd-photo-preview" />
        )}

        <div className="rd-summary-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Add listing
          </button>
        </div>
      </form>
    </div>
  );
}
