// Demo data for ClearMarket Demo Mode
// This file contains all mock data used in the demo - no real DB writes

export interface DemoRep {
  id: string;
  anonymous_id: string;
  real_name: string;
  email: string;
  phone: string;
  city: string;
  bio: string;
  coverage_states: string[];
  coverage_counties: string[];
  systems: string[];
  inspection_categories: string[];
  trust_score: number;
  community_score: number;
  looking_for_work: boolean;
  reviews: DemoReview[];
}

export interface DemoReview {
  id: string;
  reviewer_name: string;
  on_time: number;
  quality: number;
  communication: number;
  comment: string;
  date: string;
  verified: boolean;
}

export interface DemoVendor {
  id: string;
  name: string;
  description: string;
  coverage_states: string[];
  coverage_counties: string[];
  systems: string[];
}

export interface DemoCommunityPost {
  id: string;
  author: string;
  author_role: "Field Rep" | "Vendor";
  title: string;
  body: string;
  category: string;
  helpful_count: number;
  not_helpful_count: number;
  comments_count: number;
  date: string;
  under_review: boolean;
}

// Demo Field Reps
export const DEMO_REPS: DemoRep[] = [
  {
    id: "rep-1042",
    anonymous_id: "FieldRep#1042",
    real_name: "Jordan Lee",
    email: "jordan.lee@example.com",
    phone: "(414) 555-0142",
    city: "Milwaukee",
    bio: "Experienced property inspector with 8+ years in the Milwaukee area. Specialize in residential and commercial loss inspections. Reliable, thorough, and always on time.",
    coverage_states: ["WI"],
    coverage_counties: ["Milwaukee", "Waukesha", "Kenosha"],
    systems: ["EZ Inspections", "IA Path"],
    inspection_categories: ["Property Inspections", "Loss Insurance Claims"],
    trust_score: 4.8,
    community_score: 127,
    looking_for_work: true,
    reviews: [
      {
        id: "r1",
        reviewer_name: "NorthStar Services",
        on_time: 5,
        quality: 5,
        communication: 4,
        comment: "Jordan is consistently reliable. Great attention to detail on roof inspections.",
        date: "Dec 2025",
        verified: true,
      },
      {
        id: "r2",
        reviewer_name: "Midwest Claims Co",
        on_time: 5,
        quality: 4,
        communication: 5,
        comment: "Excellent communicator. Always keeps us updated on inspection status.",
        date: "Nov 2025",
        verified: true,
      },
    ],
  },
  {
    id: "rep-2179",
    anonymous_id: "FieldRep#2179",
    real_name: "Casey Morgan",
    email: "casey.morgan@example.com",
    phone: "(312) 555-0198",
    city: "Chicago",
    bio: "Chicago-based inspector covering the greater Chicagoland area. 5 years of experience with property and commercial inspections. Strong community involvement.",
    coverage_states: ["IL"],
    coverage_counties: ["Cook", "DuPage", "Lake"],
    systems: ["EZ Inspections", "WorldApp"],
    inspection_categories: ["Property Inspections", "Commercial Inspections"],
    trust_score: 4.5,
    community_score: 203,
    looking_for_work: true,
    reviews: [
      {
        id: "r3",
        reviewer_name: "Premier Inspections",
        on_time: 4,
        quality: 5,
        communication: 5,
        comment: "Casey goes above and beyond. Photos are always detailed and well-documented.",
        date: "Jan 2026",
        verified: true,
      },
      {
        id: "r4",
        reviewer_name: "Lakefront Claims",
        on_time: 4,
        quality: 4,
        communication: 4,
        comment: "Solid work. Would use again for Cook County assignments.",
        date: "Dec 2025",
        verified: true,
      },
    ],
  },
  {
    id: "rep-3308",
    anonymous_id: "FieldRep#3308",
    real_name: "Taylor Reed",
    email: "taylor.reed@example.com",
    phone: "(608) 555-0234",
    city: "Madison",
    bio: "Rural Wisconsin specialist. Comfortable with longer drives and remote properties. 6 years experience, primarily in loss inspections.",
    coverage_states: ["WI"],
    coverage_counties: ["Dane", "Rock", "Jefferson", "Sauk"],
    systems: ["IA Path", "Inspect Pro"],
    inspection_categories: ["Property Inspections", "Loss Insurance Claims", "Roof Inspections"],
    trust_score: 4.3,
    community_score: 89,
    looking_for_work: true,
    reviews: [
      {
        id: "r5",
        reviewer_name: "Rural Claims LLC",
        on_time: 5,
        quality: 4,
        communication: 4,
        comment: "Willing to drive to remote areas without complaint. Reliable for rural coverage.",
        date: "Nov 2025",
        verified: true,
      },
    ],
  },
  {
    id: "rep-7811",
    anonymous_id: "FieldRep#7811",
    real_name: "Avery Chen",
    email: "avery.chen@example.com",
    phone: "(847) 555-0312",
    city: "Evanston",
    bio: "Commercial inspection specialist. Newer to the platform but 10+ years in the industry. Focus on large commercial properties and multi-unit buildings.",
    coverage_states: ["IL"],
    coverage_counties: ["Cook", "Lake"],
    systems: ["EZ Inspections", "ClaimRuler"],
    inspection_categories: ["Commercial Inspections", "Property Inspections"],
    trust_score: 4.0,
    community_score: 34,
    looking_for_work: false,
    reviews: [
      {
        id: "r6",
        reviewer_name: "Metro Commercial Svcs",
        on_time: 4,
        quality: 5,
        communication: 4,
        comment: "Strong commercial background. Good for complex multi-story buildings.",
        date: "Oct 2025",
        verified: true,
      },
    ],
  },
];

// Demo Vendor
export const DEMO_VENDORS: DemoVendor[] = [
  {
    id: "vendor-1",
    name: "NorthStar Field Services (Demo)",
    description: "Regional field services company covering the upper Midwest. Looking for reliable reps for property and loss inspections.",
    coverage_states: ["IL", "WI"],
    coverage_counties: ["Cook", "DuPage", "Milwaukee", "Kenosha"],
    systems: ["EZ Inspections", "IA Path"],
  },
  {
    id: "vendor-2",
    name: "Midwest Claims Co",
    description: "Insurance claims adjuster seeking field reps for loss inspections across Illinois and Indiana.",
    coverage_states: ["IL", "IN"],
    coverage_counties: ["Cook", "Will", "Lake", "Porter"],
    systems: ["IA Path", "WorldApp"],
  },
  {
    id: "vendor-3",
    name: "Great Lakes Inspection Group",
    description: "Multi-state inspection company with a focus on residential and commercial properties.",
    coverage_states: ["WI", "MI"],
    coverage_counties: ["Milwaukee", "Wayne", "Oakland"],
    systems: ["EZ Inspections", "Inspect Pro"],
  },
];

// Demo Community Posts
export const DEMO_COMMUNITY_POSTS: DemoCommunityPost[] = [
  {
    id: "post-1",
    author: "FieldRep#4521",
    author_role: "Field Rep",
    title: "Looking for coverage in DuPage County",
    body: "Anyone have experience working in the western suburbs? Just expanded my coverage area and looking for tips on the best routes.",
    category: "Coverage",
    helpful_count: 12,
    not_helpful_count: 1,
    comments_count: 8,
    date: "2 hours ago",
    under_review: false,
  },
  {
    id: "post-2",
    author: "Vendor#892",
    author_role: "Vendor",
    title: "Heads up: EZ system outage this morning",
    body: "Just a heads up - EZ Inspections had some server issues earlier today. Should be resolved now but keep an eye out if your uploads are slow.",
    category: "System Alert",
    helpful_count: 45,
    not_helpful_count: 2,
    comments_count: 15,
    date: "5 hours ago",
    under_review: false,
  },
  {
    id: "post-3",
    author: "FieldRep#1893",
    author_role: "Field Rep",
    title: "Who has experience with IA inspections?",
    body: "Looking to get trained on IA Path. Any recommendations for getting up to speed quickly? I've been using EZ for years but seeing more vendors require IA.",
    category: "Question",
    helpful_count: 23,
    not_helpful_count: 0,
    comments_count: 12,
    date: "Yesterday",
    under_review: false,
  },
  {
    id: "post-4",
    author: "FieldRep#7234",
    author_role: "Field Rep",
    title: "Tips for winter inspections",
    body: "With winter coming up, what are your must-haves for cold weather inspections? I'm in Wisconsin and want to make sure I'm prepared.",
    category: "Tips",
    helpful_count: 67,
    not_helpful_count: 3,
    comments_count: 24,
    date: "2 days ago",
    under_review: false,
  },
  {
    id: "post-5",
    author: "Vendor#445",
    author_role: "Vendor",
    title: "Best practices for photo documentation",
    body: "Sharing our internal guide for photo requirements. Consistent documentation helps everyone. Happy to answer questions.",
    category: "Best Practices",
    helpful_count: 89,
    not_helpful_count: 4,
    comments_count: 31,
    date: "3 days ago",
    under_review: false,
  },
  {
    id: "post-6",
    author: "FieldRep#9012",
    author_role: "Field Rep",
    title: "Question about rates in Cook County",
    body: "What's the going rate for residential inspections in Cook County? Want to make sure I'm competitive.",
    category: "Rates",
    helpful_count: 8,
    not_helpful_count: 2,
    comments_count: 6,
    date: "4 days ago",
    under_review: false,
  },
  {
    id: "post-7",
    author: "Anonymous",
    author_role: "Field Rep",
    title: "[Under Review]",
    body: "This post has been flagged for moderator review.",
    category: "Flagged",
    helpful_count: 0,
    not_helpful_count: 5,
    comments_count: 0,
    date: "5 days ago",
    under_review: true,
  },
];
