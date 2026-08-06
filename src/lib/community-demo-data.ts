// Static mock data for the community/course-platform concept demo. Nothing
// here talks to a database, YouTube, Zoom, or Google — it's canned content
// arranged to walk a client through the shape of the product (think Skool)
// before anything is built.

import { AVATAR_CLASSES } from "@/lib/format";

export function avatarColorClass(id: string): string {
  let hash = 0;
  for (const ch of id) hash += ch.charCodeAt(0);
  return AVATAR_CLASSES[hash % AVATAR_CLASSES.length];
}

export type MemberRole = "admin" | "coach" | "student";

export type DemoMember = {
  id: string;
  name: string;
  role: MemberRole;
  title: string;
  bio: string;
  location: string;
  joinedDate: string; // "YYYY-MM-DD"
  points: number;
  tags: string[];
  coursesEnrolled: number;
};

export type DemoLesson = {
  id: string;
  title: string;
  durationMin: number;
  youtubeId: string; // public, embeddable sample video
};

export type DemoCourse = {
  id: string;
  title: string;
  description: string;
  category: string;
  color: string; // css var name for cover tint
  lessons: DemoLesson[];
};

export type DemoComment = {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
};

export type DemoPost = {
  id: string;
  authorId: string;
  category: "General" | "Wins" | "Q&A" | "Announcements";
  content: string;
  createdAt: string;
  likes: number;
  pinned?: boolean;
  comments: DemoComment[];
};

export type AdCampaignStatus = "active" | "paused" | "ended";

export type DemoAdCampaign = {
  id: string;
  name: string;
  platform: "facebook" | "instagram";
  status: AdCampaignStatus;
  spend: number; // dollars, last 30 days
  impressions: number;
  clicks: number;
  leads: number;
  startDate: string; // "YYYY-MM-DD"
};

export type EventType = "live-call" | "workshop" | "deadline" | "community";
export type StreamPlatform = "google-meet" | "zoom" | "native";

export type DemoEvent = {
  id: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM", 24h
  title: string;
  type: EventType;
  platform?: StreamPlatform;
  link?: string;
};

export type LeadStatus = "new" | "contacted" | "follow-up" | "closed";

export type DemoLead = {
  id: string;
  name: string;
  email: string;
  source: "instagram" | "youtube" | "referral" | "website";
  status: LeadStatus;
  joinedAt: string;
  note: string;
};

export const CATEGORIES = ["General", "Wins", "Q&A", "Announcements"] as const;

export const MEMBERS: DemoMember[] = [
  {
    id: "m-admin",
    name: "Jordan Blake",
    role: "admin",
    title: "Founder & Head Coach",
    bio: "Building Ridgeline Coaching to help 1,000 coaches launch profitable group programs.",
    location: "Austin, TX",
    joinedDate: "2024-01-08",
    points: 4820,
    tags: ["Coach", "Founder"],
    coursesEnrolled: 4,
  },
  {
    id: "m1",
    name: "Sarah Chen",
    role: "student",
    title: "Fitness Coach",
    bio: "Online strength coach for busy parents. 3 years in, scaling past 1:1.",
    location: "Scottsdale, AZ",
    joinedDate: "2025-03-11",
    points: 1240,
    tags: ["Fitness", "Level 3"],
    coursesEnrolled: 2,
  },
  {
    id: "m2",
    name: "Marcus Webb",
    role: "student",
    title: "Business Consultant",
    bio: "Helping SaaS founders fix churn. New to cohort-based teaching.",
    location: "Denver, CO",
    joinedDate: "2025-05-02",
    points: 860,
    tags: ["Consulting", "Level 2"],
    coursesEnrolled: 1,
  },
  {
    id: "m3",
    name: "Priya Nair",
    role: "student",
    title: "Nutrition Coach",
    bio: "Building a hybrid nutrition practice, in the middle of the launch sprint.",
    location: "Tempe, AZ",
    joinedDate: "2025-06-20",
    points: 540,
    tags: ["Nutrition", "Level 1"],
    coursesEnrolled: 3,
  },
  {
    id: "m4",
    name: "Dan Ostrowski",
    role: "coach",
    title: "Community Manager",
    bio: "Runs weekly office hours and keeps the community feed alive.",
    location: "Chicago, IL",
    joinedDate: "2024-11-14",
    points: 3110,
    tags: ["Team", "Moderator"],
    coursesEnrolled: 4,
  },
  {
    id: "m5",
    name: "Angela Reyes",
    role: "student",
    title: "Career Coach",
    bio: "Transitioning from corporate HR into 1:1 career coaching.",
    location: "Denver, CO",
    joinedDate: "2025-07-01",
    points: 210,
    tags: ["Career", "Level 1"],
    coursesEnrolled: 1,
  },
  {
    id: "m6",
    name: "Leo Fischer",
    role: "student",
    title: "Real Estate Coach",
    bio: "Coaches agents on lead generation, loves a good Sunday post.",
    location: "Gilbert, AZ",
    joinedDate: "2025-02-18",
    points: 1980,
    tags: ["Real Estate", "Level 3"],
    coursesEnrolled: 2,
  },
];

export const COURSES: DemoCourse[] = [
  {
    id: "c1",
    title: "Launch Your Group Program",
    description: "The 6-step framework for turning 1:1 clients into a scalable cohort offer.",
    category: "Business",
    color: "purple",
    lessons: [
      { id: "c1-l1", title: "Welcome + how this course works", durationMin: 4, youtubeId: "aqz-KE-bpKQ" },
      { id: "c1-l2", title: "Pick your first cohort topic", durationMin: 12, youtubeId: "aqz-KE-bpKQ" },
      { id: "c1-l3", title: "Pricing your program", durationMin: 9, youtubeId: "aqz-KE-bpKQ" },
      { id: "c1-l4", title: "Writing the sales page", durationMin: 15, youtubeId: "aqz-KE-bpKQ" },
      { id: "c1-l5", title: "Your 14-day launch calendar", durationMin: 11, youtubeId: "aqz-KE-bpKQ" },
    ],
  },
  {
    id: "c2",
    title: "Content That Converts",
    description: "Turn weekly content into a predictable pipeline of warm leads.",
    category: "Marketing",
    color: "teal",
    lessons: [
      { id: "c2-l1", title: "The 3 post types that sell", durationMin: 8, youtubeId: "aqz-KE-bpKQ" },
      { id: "c2-l2", title: "Batching a month of content in 2 hours", durationMin: 14, youtubeId: "aqz-KE-bpKQ" },
      { id: "c2-l3", title: "Writing hooks that stop the scroll", durationMin: 10, youtubeId: "aqz-KE-bpKQ" },
      { id: "c2-l4", title: "Turning comments into DMs", durationMin: 7, youtubeId: "aqz-KE-bpKQ" },
    ],
  },
  {
    id: "c3",
    title: "Coaching Call Mastery",
    description: "Run tighter 1:1 and group calls that clients actually show up for.",
    category: "Coaching Skills",
    color: "amber",
    lessons: [
      { id: "c3-l1", title: "Structuring a 45-minute call", durationMin: 9, youtubeId: "aqz-KE-bpKQ" },
      { id: "c3-l2", title: "Asking better questions", durationMin: 13, youtubeId: "aqz-KE-bpKQ" },
      { id: "c3-l3", title: "Handling resistance and excuses", durationMin: 16, youtubeId: "aqz-KE-bpKQ" },
    ],
  },
  {
    id: "c4",
    title: "Systems for Solo Coaches",
    description: "The tools and templates to run your practice without burning out.",
    category: "Operations",
    color: "blue",
    lessons: [
      { id: "c4-l1", title: "Your client onboarding checklist", durationMin: 6, youtubeId: "aqz-KE-bpKQ" },
      { id: "c4-l2", title: "Setting up a simple CRM", durationMin: 11, youtubeId: "aqz-KE-bpKQ" },
      { id: "c4-l3", title: "Automating check-ins", durationMin: 8, youtubeId: "aqz-KE-bpKQ" },
      { id: "c4-l4", title: "Protecting your calendar", durationMin: 10, youtubeId: "aqz-KE-bpKQ" },
    ],
  },
];

export const POSTS: DemoPost[] = [
  {
    id: "p1",
    authorId: "m-admin",
    category: "Announcements",
    content:
      "New module just dropped in \"Launch Your Group Program\" — the 14-day launch calendar. Go claim your spot for Thursday's live Q&A on the calendar tab!",
    createdAt: "2026-07-30T14:20:00",
    likes: 24,
    pinned: true,
    comments: [
      { id: "cm1", authorId: "m1", content: "Just watched it, exactly what I needed before my launch next week!" },
      { id: "cm2", authorId: "m6", content: "Will there be a replay for those who can't make Thursday live?" },
    ].map((c, i) => ({ ...c, createdAt: `2026-07-30T1${4 + i}:1${i}:00` })),
  },
  {
    id: "p2",
    authorId: "m1",
    category: "Wins",
    content:
      "Just closed my first group cohort — 9 people, $2,700 in 48 hours. Could not have done it without the sales page module. 🎉",
    createdAt: "2026-07-29T09:05:00",
    likes: 41,
    comments: [
      { id: "cm3", authorId: "m4", content: "Incredible, Sarah! What was your biggest lever this time around?", createdAt: "2026-07-29T09:20:00" },
      { id: "cm4", authorId: "m1", content: "Honestly the founding-member pricing from lesson 3 did most of the work.", createdAt: "2026-07-29T09:32:00" },
      { id: "cm5", authorId: "m3", content: "This is so motivating, saving this thread.", createdAt: "2026-07-29T10:05:00" },
    ],
  },
  {
    id: "p3",
    authorId: "m2",
    category: "Q&A",
    content:
      "Anyone have a template for a discovery call script for consulting clients? Struggling to keep mine under 30 minutes.",
    createdAt: "2026-07-29T18:40:00",
    likes: 12,
    comments: [
      {
        id: "cm6",
        authorId: "m-admin",
        content: "Check lesson 1 in Coaching Call Mastery, the 45-min structure scales down well.",
        createdAt: "2026-07-29T19:05:00",
      },
    ],
  },
  {
    id: "p4",
    authorId: "m3",
    category: "General",
    content:
      "Loving the community so far — currently 3 lessons into Content That Converts and already rewrote my whole content calendar.",
    createdAt: "2026-07-28T11:15:00",
    likes: 18,
    comments: [],
  },
  {
    id: "p5",
    authorId: "m6",
    category: "Wins",
    content:
      "Hit 2,000 community points today 🏆 — started at zero six months ago. This place changed how I run my business.",
    createdAt: "2026-07-27T20:02:00",
    likes: 33,
    comments: [{ id: "cm7", authorId: "m4", content: "Legend. Proud of you, Leo.", createdAt: "2026-07-27T20:30:00" }],
  },
];

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Seeded relative to "today" so the calendar always opens on a populated week,
// regardless of when someone runs the demo.
export const EVENTS: DemoEvent[] = [
  {
    id: "ev1",
    date: offsetDate(0),
    time: "13:00",
    title: "Live Q&A: Launch calendar walkthrough",
    type: "live-call",
    platform: "zoom",
    link: "https://zoom.us/j/1234567890",
  },
  {
    id: "ev2",
    date: offsetDate(0),
    time: "17:00",
    title: "Office hours with Dan",
    type: "community",
    platform: "google-meet",
    link: "https://meet.google.com/abc-defg-hij",
  },
  {
    id: "ev3",
    date: offsetDate(2),
    time: "11:00",
    title: "Workshop: Writing sales pages that convert",
    type: "workshop",
    platform: "native",
    link: "https://app.ridgelinecoaching.co/live/workshop-sales-pages",
  },
  { id: "ev4", date: offsetDate(3), time: "23:59", title: "Cohort 4 application deadline", type: "deadline" },
  {
    id: "ev5",
    date: offsetDate(5),
    time: "10:00",
    title: "Monthly community call",
    type: "community",
    platform: "zoom",
    link: "https://zoom.us/j/9876543210",
  },
  { id: "ev6", date: offsetDate(-2), time: "14:00", title: "Cohort 3 kickoff call", type: "live-call", platform: "google-meet" },
];

export const LEADS: DemoLead[] = [
  {
    id: "lead1",
    name: "Melissa Grant",
    email: "melissa.grant@example.com",
    source: "instagram",
    status: "new",
    joinedAt: "2026-07-30",
    note: "Downloaded the free launch checklist, hasn't been contacted yet.",
  },
  {
    id: "lead2",
    name: "Tom Ricci",
    email: "tom.ricci@example.com",
    source: "youtube",
    status: "contacted",
    joinedAt: "2026-07-28",
    note: "Replied to welcome email, asked about pricing for the group program.",
  },
  {
    id: "lead3",
    name: "Bianca Suarez",
    email: "bianca.suarez@example.com",
    source: "referral",
    status: "follow-up",
    joinedAt: "2026-07-24",
    note: "Referred by Leo Fischer, started a 7-day trial of the community.",
  },
  {
    id: "lead4",
    name: "Owen Park",
    email: "owen.park@example.com",
    source: "website",
    status: "closed",
    joinedAt: "2026-07-15",
    note: "Converted to a paid annual membership after the free workshop.",
  },
  {
    id: "lead5",
    name: "Ravi Kapoor",
    email: "ravi.kapoor@example.com",
    source: "instagram",
    status: "closed",
    joinedAt: "2026-07-10",
    note: "Went cold after two follow-ups, said timing wasn't right.",
  },
  {
    id: "lead6",
    name: "Claire Dubois",
    email: "claire.dubois@example.com",
    source: "website",
    status: "new",
    joinedAt: "2026-07-31",
    note: "Signed up for the newsletter from the pricing page.",
  },
];

// Placeholder ad-performance data — stands in for what a real Meta Marketing
// API connection would return. Nothing here talks to Facebook; it's canned
// content to demo the shape of an ads dashboard before the real OAuth +
// API integration is built.
export const AD_CAMPAIGNS: DemoAdCampaign[] = [
  {
    id: "camp1",
    name: "Group Program Launch — Cold Audience",
    platform: "facebook",
    status: "active",
    spend: 1240,
    impressions: 84200,
    clicks: 1340,
    leads: 42,
    startDate: "2026-07-14",
  },
  {
    id: "camp2",
    name: "Retargeting — Website Visitors",
    platform: "facebook",
    status: "active",
    spend: 410,
    impressions: 21000,
    clicks: 610,
    leads: 18,
    startDate: "2026-07-20",
  },
  {
    id: "camp3",
    name: "Free Workshop Signups",
    platform: "instagram",
    status: "active",
    spend: 260,
    impressions: 33500,
    clicks: 590,
    leads: 22,
    startDate: "2026-07-25",
  },
  {
    id: "camp4",
    name: "Lookalike — Past Buyers",
    platform: "facebook",
    status: "paused",
    spend: 890,
    impressions: 52000,
    clicks: 780,
    leads: 25,
    startDate: "2026-06-30",
  },
];

export const AD_SPEND_TREND = [
  { label: "Mon", value: 142 },
  { label: "Tue", value: 168 },
  { label: "Wed", value: 121 },
  { label: "Thu", value: 205 },
  { label: "Fri", value: 189 },
  { label: "Sat", value: 96 },
  { label: "Sun", value: 88 },
];

export function getMember(id: string): DemoMember | undefined {
  return MEMBERS.find((m) => m.id === id);
}

export function getCourse(id: string): DemoCourse | undefined {
  return COURSES.find((c) => c.id === id);
}

export const ROLE_BADGE: Record<MemberRole, string> = {
  admin: "badge-purple",
  coach: "badge-teal",
  student: "badge-blue",
};

export const LEAD_STATUS_BADGE: Record<LeadStatus, string> = {
  new: "badge-blue",
  contacted: "badge-amber",
  "follow-up": "badge-purple",
  closed: "badge-green",
};

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  "follow-up": "Follow up",
  closed: "Closed",
};

export const LEAD_SOURCE_LABEL: Record<DemoLead["source"], string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  referral: "Referral",
  website: "Website",
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  "live-call": "Live call",
  workshop: "Workshop",
  deadline: "Deadline",
  community: "Community",
};

export const PLATFORM_LABEL: Record<StreamPlatform, string> = {
  "google-meet": "Google Meet",
  zoom: "Zoom",
  native: "Ridgeline Live",
};
