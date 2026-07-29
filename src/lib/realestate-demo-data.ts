// Static mock data for the real-estate CRM concept demo. Nothing here talks
// to a database, Twilio, or an AI provider — it's canned content arranged to
// walk a client through the shape of the product before anything is built.

export type DemoStage = "New" | "Hot Lead" | "In Conversation" | "Showing Booked" | "Follow Up";

export type DemoListing = {
  id: string;
  address: string;
  city: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  status: "active" | "pending" | "sold";
  top: string; // % position on the mock map
  left: string;
};

export type DemoLead = {
  id: string;
  name: string;
  phone: string;
  intent: "buying" | "selling";
  stage: DemoStage;
  listingId: string;
  summary: string;
  budget: string;
  source: "instagram_ads" | "facebook_ads" | "referral" | "website";
  transcript: string[];
  aiSummary: {
    keyPoints: string[];
    sentiment: "Positive" | "Neutral" | "Cautious";
    suggestedStage: DemoStage;
    nextStep: string;
  };
};

export const DEMO_LISTINGS: DemoListing[] = [
  {
    id: "l1",
    address: "412 Willow Creek Dr",
    city: "Scottsdale, AZ",
    price: 685000,
    beds: 4,
    baths: 3,
    sqft: 2640,
    status: "active",
    top: "28%",
    left: "38%",
  },
  {
    id: "l2",
    address: "88 Camelback Vista",
    city: "Paradise Valley, AZ",
    price: 1250000,
    beds: 5,
    baths: 4.5,
    sqft: 4100,
    status: "active",
    top: "52%",
    left: "62%",
  },
  {
    id: "l3",
    address: "2210 Desert Rose Ln",
    city: "Tempe, AZ",
    price: 419000,
    beds: 3,
    baths: 2,
    sqft: 1820,
    status: "pending",
    top: "68%",
    left: "30%",
  },
  {
    id: "l4",
    address: "77 Saguaro Ridge Ct",
    city: "Gilbert, AZ",
    price: 549900,
    beds: 4,
    baths: 3,
    sqft: 2310,
    status: "active",
    top: "40%",
    left: "78%",
  },
];

export const DEMO_LEADS: DemoLead[] = [
  {
    id: "lead1",
    name: "Sarah Chen",
    phone: "(480) 555-0142",
    intent: "buying",
    stage: "Hot Lead",
    listingId: "l1",
    budget: "$650k–$700k",
    source: "instagram_ads",
    summary: "Wants a second showing of Willow Creek this weekend, pre-approved with lender.",
    transcript: [
      "Hi Sarah, thanks for calling back — you mentioned you wanted another look at the Willow Creek place?",
      "Yes! My husband couldn't make it to the first showing and he really wants to see the backyard.",
      "Totally, I can do Saturday morning or Sunday afternoon — which works better?",
      "Saturday morning is perfect. Also — are the sellers open to a home warranty being included?",
      "I can ask, that's a pretty common ask. I'll follow up with them today and let you know before Saturday.",
      "Great, we're also pre-approved now, so if it goes well we'd want to move quickly.",
    ],
    aiSummary: {
      keyPoints: [
        "Requesting a second showing, Saturday AM, to bring her husband",
        "Pre-approved with lender — ready to move quickly if the showing goes well",
        "Asked whether sellers will include a home warranty",
      ],
      sentiment: "Positive",
      suggestedStage: "Hot Lead",
      nextStep: "Confirm Saturday 10am showing and ask sellers about the home warranty.",
    },
  },
  {
    id: "lead2",
    name: "Marcus Webb",
    phone: "(602) 555-0118",
    intent: "selling",
    stage: "In Conversation",
    listingId: "l2",
    budget: "Listing at $1.25M",
    source: "facebook_ads",
    summary: "Considering listing his Paradise Valley home, comparing two agents.",
    transcript: [
      "Hi Marcus, thanks for the call — you mentioned you're thinking about listing the Camelback place?",
      "Yeah, we've had it a while and the market seems good right now. I'm talking to one other agent too, just so you know.",
      "Totally fair, happy to answer whatever would help you compare. Have you had it appraised recently?",
      "Not in the last year — we did some remodeling in the kitchen since then though.",
      "That should help the number. I can put together a comp report this week if that's useful.",
      "Yeah, send that over — that'll help us decide.",
    ],
    aiSummary: {
      keyPoints: [
        "Comparing agents before committing to a listing",
        "Kitchen remodel completed since last appraisal — worth re-comping",
        "Requested a comparative market analysis this week",
      ],
      sentiment: "Neutral",
      suggestedStage: "In Conversation",
      nextStep: "Send comp report referencing the kitchen remodel within 2 days.",
    },
  },
  {
    id: "lead3",
    name: "Priya Nair",
    phone: "(602) 555-0177",
    intent: "buying",
    stage: "New",
    listingId: "l3",
    budget: "$400k–$450k",
    source: "instagram_ads",
    summary: "First-time buyer, asked about the Desert Rose listing status.",
    transcript: [
      "Hi Priya, I saw you inquired about the Desert Rose Ln property — thanks for reaching out.",
      "Hi! Yeah, I saw it on Instagram. Is it still available? The post didn't say.",
      "It's actually gone pending as of this week, but I have a very similar one a few blocks over that just hit the market.",
      "Oh okay — is it in the same price range?",
      "Just under, actually. Want me to send photos and set up a showing this week?",
      "Sure, that'd be great, I'm free most evenings.",
    ],
    aiSummary: {
      keyPoints: [
        "Original listing of interest (Desert Rose) is now pending",
        "Open to a comparable alternative just under budget",
        "Available most evenings this week for a showing",
      ],
      sentiment: "Positive",
      suggestedStage: "Hot Lead",
      nextStep: "Send comps and book an evening showing this week.",
    },
  },
  {
    id: "lead4",
    name: "Dan Ostrowski",
    phone: "(480) 555-0193",
    intent: "buying",
    stage: "Follow Up",
    listingId: "l4",
    budget: "$500k–$560k",
    source: "referral",
    summary: "Went quiet after first call, mentioned needing to sell his current home first.",
    transcript: [
      "Hey Dan, following up on the Saguaro Ridge place — any thoughts since we last spoke?",
      "Hey, sorry for the radio silence. We realized we need to sell our current house before we can move on anything.",
      "No problem at all — want me to connect you with someone who can give you a read on your home's value?",
      "That would actually be really helpful, yeah.",
      "I'll get that set up this week and circle back once you have a number to work with.",
    ],
    aiSummary: {
      keyPoints: [
        "Needs to sell current home before buying — contingent buyer",
        "Requested a home valuation referral",
        "Still interested in Saguaro Ridge once financing lines up",
      ],
      sentiment: "Cautious",
      suggestedStage: "Follow Up",
      nextStep: "Connect with valuation partner, check back in 1–2 weeks.",
    },
  },
  {
    id: "lead5",
    name: "Angela Reyes",
    phone: "(623) 555-0164",
    intent: "buying",
    stage: "New",
    listingId: "l1",
    budget: "$620k–$690k",
    source: "website",
    summary: "Relocating from out of state, wants a video walkthrough first.",
    transcript: [
      "Hi Angela, thanks for calling — I saw you're relocating from out of state?",
      "Yes, from Denver, we're moving for my job in the fall.",
      "Great timing then. Since you can't get out here easily, want me to send a video walkthrough of Willow Creek?",
      "That would be huge, honestly. We're trying to narrow down neighborhoods before we fly out.",
      "I'll record one this week and send it over, and flag a couple similar ones nearby too.",
    ],
    aiSummary: {
      keyPoints: [
        "Relocating from Denver, moving in the fall",
        "Cannot view in person yet — wants a video walkthrough",
        "Still narrowing down neighborhoods",
      ],
      sentiment: "Positive",
      suggestedStage: "In Conversation",
      nextStep: "Send video walkthrough plus 2-3 comparable listings nearby.",
    },
  },
];

export function getListing(id: string): DemoListing | undefined {
  return DEMO_LISTINGS.find((l) => l.id === id);
}

export const STAGE_BADGE: Record<DemoStage, string> = {
  New: "badge-blue",
  "Hot Lead": "badge-red",
  "In Conversation": "badge-amber",
  "Showing Booked": "badge-green",
  "Follow Up": "badge-purple",
};

export const SOURCE_LABEL: Record<DemoLead["source"], string> = {
  instagram_ads: "Instagram Ads",
  facebook_ads: "Facebook Ads",
  referral: "Referral",
  website: "Website",
};
