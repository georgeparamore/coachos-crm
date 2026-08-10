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
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Home", icon: "grid" },
      { href: "/clients", label: "People", icon: "users" },
      { href: "/courses", label: "Programs", icon: "play" },
      { href: "/community", label: "Community", icon: "message" },
      { href: "/ads", label: "Growth", icon: "bar-chart" },
      { href: "/calendar", label: "Calendar", icon: "calendar" },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/settings", label: "Settings", icon: "gear" }],
  },
];

export const CONTEXT_NAV = [
  { paths: ["/clients", "/crm"], label: "People", items: [{ href: "/clients", label: "Clients" }, { href: "/crm", label: "Leads" }] },
  { paths: ["/courses", "/students"], label: "Programs", items: [{ href: "/courses", label: "Courses" }, { href: "/students", label: "Progress" }] },
  { paths: ["/community"], label: "Community", items: [{ href: "/community", label: "Feed" }, { href: "/community#members", label: "Members" }, { href: "/community#events", label: "Events" }, { href: "/community#live", label: "Live" }] },
  { paths: ["/ads", "/analytics", "/subscriptions", "/invoices", "/contracts", "/deals"], label: "Growth", items: [{ href: "/ads", label: "Ad performance" }, { href: "/analytics", label: "Analytics" }, { href: "/subscriptions", label: "Subscriptions" }, { href: "/invoices", label: "Invoices" }, { href: "/contracts", label: "Contracts" }, { href: "/deals", label: "Deals" }] },
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
