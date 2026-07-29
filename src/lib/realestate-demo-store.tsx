"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  DEMO_EVENTS,
  DEMO_LEADS,
  DEMO_LISTINGS,
  type DemoEvent,
  type DemoLead,
  type DemoListing,
  type DemoStage,
} from "@/lib/realestate-demo-data";

type NewListingInput = Omit<DemoListing, "id" | "top" | "left">;
type NewEventInput = Omit<DemoEvent, "id">;

type StoreValue = {
  leads: DemoLead[];
  calledIds: Set<string>;
  confirmCall: (leadId: string, stage: DemoStage) => void;
  listings: DemoListing[];
  addListing: (listing: NewListingInput) => void;
  updateListing: (id: string, listing: NewListingInput) => void;
  deleteListing: (id: string) => void;
  events: DemoEvent[];
  addEvent: (event: NewEventInput) => void;
  updateEvent: (id: string, event: NewEventInput) => void;
  deleteEvent: (id: string) => void;
};

const RealEstateDemoContext = createContext<StoreValue | null>(null);

export function RealEstateDemoProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<DemoLead[]>(DEMO_LEADS);
  const [calledIds, setCalledIds] = useState<Set<string>>(new Set());
  const [listings, setListings] = useState<DemoListing[]>(DEMO_LISTINGS);
  const [events, setEvents] = useState<DemoEvent[]>(DEMO_EVENTS);

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

  const addEvent = useCallback((event: NewEventInput) => {
    setEvents((prev) => [...prev, { ...event, id: `event-${Date.now()}` }]);
  }, []);

  const updateEvent = useCallback((id: string, event: NewEventInput) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...event } : e)));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      leads,
      calledIds,
      confirmCall,
      listings,
      addListing,
      updateListing,
      deleteListing,
      events,
      addEvent,
      updateEvent,
      deleteEvent,
    }),
    [
      leads,
      calledIds,
      confirmCall,
      listings,
      addListing,
      updateListing,
      deleteListing,
      events,
      addEvent,
      updateEvent,
      deleteEvent,
    ],
  );

  return <RealEstateDemoContext.Provider value={value}>{children}</RealEstateDemoContext.Provider>;
}

export function useRealEstateDemo() {
  const ctx = useContext(RealEstateDemoContext);
  if (!ctx) throw new Error("useRealEstateDemo must be used within RealEstateDemoProvider");
  return ctx;
}
