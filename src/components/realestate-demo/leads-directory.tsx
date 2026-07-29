"use client";

import { useMemo, useState } from "react";
import {
  DEMO_LEADS,
  SOURCE_LABEL,
  STAGE_BADGE,
  getListing,
  type DemoStage,
} from "@/lib/realestate-demo-data";

const STAGES: (DemoStage | "all")[] = ["all", "New", "Hot Lead", "In Conversation", "Showing Booked", "Follow Up"];

export function LeadsDirectory() {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<DemoStage | "all">("all");

  const filtered = useMemo(() => {
    return DEMO_LEADS.filter((l) => {
      const matchesStage = stage === "all" || l.stage === stage;
      const matchesQuery =
        query.trim() === "" || l.name.toLowerCase().includes(query.trim().toLowerCase());
      return matchesStage && matchesQuery;
    });
  }, [query, stage]);

  return (
    <div>
      <div className="rd-leads-toolbar">
        <input
          className="rd-search"
          placeholder="Search leads by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="rd-map-filters">
          {STAGES.map((s) => (
            <button
              key={s}
              className={`btn btn-sm${stage === s ? " btn-primary" : ""}`}
              onClick={() => setStage(s)}
            >
              {s === "all" ? "All stages" : s}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="rd-lead-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Intent</th>
              <th>Listing</th>
              <th>Source</th>
              <th>Stage</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => {
              const listing = getListing(lead.listingId);
              return (
                <tr key={lead.id}>
                  <td>
                    <div className="rd-lead-name">{lead.name}</div>
                    <div className="mini-stat-label">{lead.phone}</div>
                  </td>
                  <td className="mini-stat-label">{lead.intent === "buying" ? "Buying" : "Selling"}</td>
                  <td className="mini-stat-label">{listing?.address ?? "—"}</td>
                  <td className="mini-stat-label">{SOURCE_LABEL[lead.source]}</td>
                  <td>
                    <span className={`badge ${STAGE_BADGE[lead.stage]}`}>{lead.stage}</span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="mini-stat-label" style={{ textAlign: "center", padding: 24 }}>
                  No leads match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
