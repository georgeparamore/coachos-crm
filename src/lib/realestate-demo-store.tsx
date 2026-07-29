"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  DEMO_LEADS,
  DEMO_LISTINGS,
  type DemoLead,
  type DemoListing,
  type DemoStage,
} from "@/lib/realestate-demo-data";

type NewListingInput = Omit<DemoListing, "id" | "top" | "left">;

type StoreValue = {
  leads: DemoLead[];
  calledIds: Set<string>;
  confirmCall: (leadId: string, stage: DemoStage) => void;
  listings: DemoListing[];
  addListing: (listing: NewListingInput) => void;
  updateListing: (id: string, listing: NewListingInput) => void;
  deleteListing: (id: string) => void;
};

const RealEstateDemoContext = createContext<StoreValue | null>(null);

export function RealEstateDemoProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<DemoLead[]>(DEMO_LEADS);
  const [calledIds, setCalledIds] = useState<Set<string>>(new Set());
  const [listings, setListings] = useState<DemoListing[]>(DEMO_LISTINGS);

  const confirmCall = useCallback((leadId: string, stage: DemoStage) => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage } : l)));
    setCalledIds((prev) => new Set(prev).add(leadId));
  }, []);

  const addListing = useCallback((listing: NewListingInput) => {
    setListings((prev) => [
      ...prev,
      {
        ...listing,
        id: `listing-${Date.now()}`,
        // Scattered within the mock map's visible bounds so it doesn't need a real geocoder.
        top: `${15 + Math.round(Math.random() * 65)}%`,
        left: `${12 + Math.round(Math.random() * 72)}%`,
      },
    ]);
  }, []);

  const updateListing = useCallback((id: string, listing: NewListingInput) => {
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, ...listing } : l)));
  }, []);

  const deleteListing = useCallback((id: string) => {
    setListings((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const value = useMemo(
    () => ({ leads, calledIds, confirmCall, listings, addListing, updateListing, deleteListing }),
    [leads, calledIds, confirmCall, listings, addListing, updateListing, deleteListing],
  );

  return <RealEstateDemoContext.Provider value={value}>{children}</RealEstateDemoContext.Provider>;
}

export function useRealEstateDemo() {
  const ctx = useContext(RealEstateDemoContext);
  if (!ctx) throw new Error("useRealEstateDemo must be used within RealEstateDemoProvider");
  return ctx;
}
