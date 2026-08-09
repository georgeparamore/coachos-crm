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
    label: "Manage",
    items: [
      { href: "/dashboard", label: "Overview", icon: "grid" },
      { href: "/clients", label: "Clients", icon: "users" },
      { href: "/courses", label: "Courses & programs", icon: "play" },
      { href: "/students", label: "Student progress", icon: "trending-up" },
      { href: "/community", label: "Community", icon: "message" },
      { href: "/crm", label: "Leads", icon: "users" },
      { href: "/ads", label: "Ad performance", icon: "bar-chart" },
      { href: "/calendar", label: "Calendar", icon: "calendar" },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/settings", label: "Settings", icon: "gear" }],
  },
];

// Analytics, Deal evaluations, Subscriptions, Invoices, and Contracts are
// real, working, Stripe-connected Phase 1-2 features — intentionally hidden
// from the nav (not deleted) while DJS CRM's new direction is being built
// out. Their routes still work if visited directly. Re-add a "Billing"
// NavSection with them once the rest of the product is finished — George
// asked to be reminded of this explicitly at that point.
