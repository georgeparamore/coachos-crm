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
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "grid" },
      { href: "/analytics", label: "Analytics", icon: "bar-chart" },
      { href: "/calendar", label: "Calendar", icon: "calendar" },
    ],
  },
  {
    label: "Clients",
    items: [
      { href: "/crm", label: "CRM & pipeline", icon: "users" },
      { href: "/deals", label: "Deal evaluations", icon: "file-text" },
      { href: "/ads", label: "Ad performance", icon: "bar-chart" },
    ],
  },
  {
    label: "Monetization",
    items: [
      { href: "/subscriptions", label: "Subscriptions", icon: "refresh" },
      { href: "/invoices", label: "Invoices", icon: "invoice" },
      { href: "/contracts", label: "Contracts", icon: "pen" },
    ],
  },
  {
    label: "Education",
    items: [
      { href: "/courses", label: "Courses & programs", icon: "play" },
      { href: "/community", label: "Community", icon: "message" },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/settings", label: "Settings", icon: "gear" }],
  },
];
