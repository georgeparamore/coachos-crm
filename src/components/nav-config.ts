export type NavItem = {
  href: string;
  label: string;
  icon: string;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Home", icon: "grid" },
      { href: "/clients", label: "People", icon: "users" },
      { href: "/courses", label: "Programs", icon: "play" },
      { href: "/calendar", label: "Calendar", icon: "calendar" },
    ],
  },
];

export const MORE_NAV_ITEMS: NavItem[] = [
  { href: "/community", label: "Community", icon: "message" },
  { href: "/ads", label: "Growth & money", icon: "bar-chart" },
  { href: "/settings", label: "Settings", icon: "gear" },
];

export const CONTEXT_NAV = [
  { paths: ["/clients", "/crm", "/calls"], label: "People", items: [{ href: "/clients", label: "Clients" }, { href: "/crm", label: "Leads" }, { href: "/calls", label: "Discovery calls" }] },
  { paths: ["/courses", "/students"], label: "Programs", items: [{ href: "/courses", label: "Courses" }, { href: "/students", label: "Progress" }] },
  { paths: ["/community"], label: "Community", items: [{ href: "/community", label: "Feed" }, { href: "/community/members", label: "Members" }] },
  { paths: ["/ads", "/analytics", "/subscriptions", "/invoices", "/contracts", "/deals"], label: "Growth & money", items: [{ href: "/ads", label: "Ads" }, { href: "/analytics", label: "Reports" }, { href: "/deals", label: "Deals" }], moreItems: [{ href: "/subscriptions", label: "Subscriptions" }, { href: "/invoices", label: "Invoices" }, { href: "/contracts", label: "Contracts" }] },
] as const;

// Separate nav for client accounts — everything above is coach/admin
// tooling (business management, ad spend, leads) that a client has no use
// for and, for most of it, no RLS access to anyway. Settings isn't included
// here since /settings is entirely business-profile/integrations content;
// a client-appropriate settings page is a follow-up, not built yet.
export const CLIENT_NAV_SECTIONS: NavSection[] = [
  {
    label: "Learn",
    items: [
      { href: "/classroom", label: "My courses", icon: "play" },
      { href: "/community", label: "Community", icon: "message" },
    ],
  },
];

// Analytics, Deal evaluations, Subscriptions, Invoices, and Contracts are
// real, working, Stripe-connected Phase 1-2 features — intentionally hidden
// from the nav (not deleted) while DJS CRM's new direction is being built
// out. Their routes still work if visited directly. Re-add a "Billing"
// NavSection with them once the rest of the product is finished — George
// asked to be reminded of this explicitly at that point.
