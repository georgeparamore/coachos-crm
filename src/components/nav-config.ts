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
      { href: "/courses", label: "Courses & programs", icon: "play" },
      { href: "/community", label: "Community", icon: "message" },
      { href: "/crm", label: "Leads", icon: "users" },
      { href: "/ads", label: "Ad performance", icon: "bar-chart" },
      { href: "/calendar", label: "Calendar", icon: "calendar" },
    ],
  },
  {
    label: "Billing",
    items: [
      { href: "/analytics", label: "Analytics", icon: "bar-chart" },
      { href: "/deals", label: "Deal evaluations", icon: "file-text" },
      { href: "/subscriptions", label: "Subscriptions", icon: "refresh" },
      { href: "/invoices", label: "Invoices", icon: "invoice" },
      { href: "/contracts", label: "Contracts", icon: "pen" },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/settings", label: "Settings", icon: "gear" }],
  },
];
