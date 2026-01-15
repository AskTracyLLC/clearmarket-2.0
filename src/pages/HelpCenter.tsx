import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Search, HelpCircle, CreditCard, Shield, MessageCircle, Rocket, UserCog, Loader2, Users, MapPin, Star, Handshake, Lock, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Category configuration with icons and labels
const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ComponentType<any> }> = {
  getting_started: { label: "Getting Started", icon: Rocket },
  platform_purpose: { label: "Platform Purpose", icon: HelpCircle },
  accounts_roles: { label: "Accounts & Roles", icon: UserCog },
  profiles: { label: "Profiles", icon: Users },
  discovery_matching: { label: "Discovery & Matching", icon: MapPin },
  connections_privacy: { label: "Connections & Privacy", icon: Lock },
  trust_reviews: { label: "Trust & Reviews", icon: Star },
  community: { label: "Community Board", icon: Handshake },
  credits_billing: { label: "Credits & Billing", icon: CreditCard },
  safety_support: { label: "Policies & Support", icon: Shield },
  coming_soon: { label: "Coming Soon", icon: Bell },
};

const CATEGORY_ORDER = [
  "getting_started",
  "platform_purpose", 
  "accounts_roles",
  "profiles",
  "discovery_matching",
  "connections_privacy",
  "trust_reviews",
  "community",
  "credits_billing",
  "safety_support",
  "coming_soon"
] as const;

// Static fallback FAQ content (kept for safety if DB is empty)
const STATIC_FAQ = {
  getting_started: {
    label: "Getting Started",
    icon: Rocket,
    items: [
      {
        id: "what-is-clearmarket",
        question: "What is ClearMarket?",
        answer:
          "ClearMarket is a networking and coverage-matching platform for the property inspection industry.\n\nField Reps use ClearMarket to show where they work, what types of inspections they do, and which systems they're familiar with. Vendors use ClearMarket to see who is active in a specific area and reach out when they're looking for help with coverage.\n\nClearMarket does not dispatch work or employ inspectors. Any work agreements, pricing, and expectations are handled directly between Vendors and Field Reps."
      },
      {
        id: "get-started-rep",
        question: "How do I get started as a Field Rep?",
        answer:
          "1. Create your account and select the Field Rep role.\n2. Complete your Field Rep Profile (basic info, experience, and systems used).\n3. Add your Coverage Areas (states/counties, and zip codes if you'd like).\n4. (Optional) Add your typical fee ranges so Vendors know what to expect.\n5. Join the Community Board and start participating.\n\nOnce your profile is set up, Vendors can find you when they search for coverage in your areas."
      },
      {
        id: "get-started-vendor",
        question: "How do I get started as a Vendor?",
        answer:
          "1. Create your account and select the Vendor role.\n2. Complete your Vendor Profile (company details, coverage, inspection types).\n3. Add the systems/platforms you use so reps know what to expect.\n4. Purchase credits if you plan to use credit-based features.\n5. Search for Field Reps in your coverage gaps or post Seeking Coverage and reach out directly.\n\nAll work agreements and pricing are handled directly between you and the Field Rep."
      },
      {
        id: "help-center-goal",
        question: "What is the Help Center for?",
        answer:
          "The Help Center exists to help you get the best ClearMarket experience — with clear guidance, fewer mistakes, and better outcomes.\n\nYou can search for answers, browse by category, or contact Support if you need additional help."
      }
    ]
  },
  platform_purpose: {
    label: "Platform Purpose",
    icon: HelpCircle,
    items: [
      {
        id: "what-clearmarket-does",
        question: "What does ClearMarket do?",
        answer:
          "ClearMarket is a networking + accountability platform for Vendors and Field Reps.\n\nIt's built to:\n• Reduce noise and irrelevant outreach\n• Improve match quality between Vendors and Field Reps\n• Support trust-based connections through reviews and verified profiles"
      },
      {
        id: "what-clearmarket-doesnt-do",
        question: "What ClearMarket doesn't do",
        answer:
          "ClearMarket does not dispatch work and does not act as an employer.\n\nAll Field Reps operate as independent contractors (1099 structure). Work agreements, pricing, and expectations are handled directly between Vendors and Field Reps."
      }
    ]
  },
  accounts_roles: {
    label: "Accounts & Roles",
    icon: UserCog,
    items: [
      {
        id: "account-types",
        question: "What account types are available?",
        answer:
          "ClearMarket offers two account types:\n\n• Vendor accounts — For companies seeking coverage in specific areas\n• Field Rep accounts — For independent inspectors looking for work opportunities"
      },
      {
        id: "forgot-password",
        question: "I forgot my password — what do I do?",
        answer:
          "Use the \"Forgot password?\" link on the sign-in page. Enter the email you used to register and you'll receive a secure reset link.\n\nIf you don't see the email after a few minutes, check your spam/junk folder. If it still doesn't arrive, contact Support from the Help Center or email hello@useclearmarket.io."
      },
      {
        id: "deactivate-account",
        question: "How do I deactivate my account?",
        answer:
          "You can request deactivation from inside the app (Account or Profile settings) or by emailing hello@useclearmarket.io from the email address on your profile.\n\nDeactivated accounts can't log in or appear in search. Some activity (like past reviews) may still appear in a limited or anonymized way where needed to keep the system accurate."
      },
      {
        id: "restricted-pages",
        question: "Why can't I see certain pages?",
        answer:
          "Some pages are role-specific. Vendor-only and Field Rep–only pages may be restricted unless you have the correct role.\n\nCertain features may also require a completed profile, verification, or an active subscription/credit balance. If you believe you should have access to something you're not seeing, please contact Support."
      }
    ]
  },
  profiles: {
    label: "Profiles",
    icon: Users,
    items: [
      {
        id: "field-rep-profile",
        question: "What's included in a Field Rep Profile?",
        answer:
          "Field Rep profiles include:\n\n• Coverage areas (at minimum state + county)\n• Inspection categories:\n  - Property Inspections\n  - Loss Insurance Claims (Appointment-based)\n  - Commercial\n  - Other (free-text, multi-entry)\n• Systems used / familiar with (ex: EZ, IA, etc.)\n• Additional profile details used to improve match relevance"
      },
      {
        id: "vendor-profile",
        question: "What's included in a Vendor Profile?",
        answer:
          "Vendor profiles include:\n\n• Areas covered (states/counties)\n• Inspection types needed/performed\n• System the work is completed in (where applicable)\n• Company details and contact information"
      },
      {
        id: "network-alerts",
        question: "What are Network Alerts?",
        answer:
          "Network Alerts is a tool for Field Reps that lets them notify all vendors in their network at once — without having to update vendors individually.\n\nCommon uses include:\n• Emergency \"Stop Work\" notice for the day\n• Requesting immediate extensions\n• Marking yourself unavailable for a defined time period\n• Sharing planned time off in advance\n• Letting vendors know where you'll be working (ex: \"I'll be in X area tomorrow\")\n\nPrivacy protection: Alerts are sent so vendors do not see each other. This keeps the Field Rep's vendor network private while still streamlining communication."
      }
    ]
  },
  discovery_matching: {
    label: "Discovery & Matching",
    icon: MapPin,
    items: [
      {
        id: "seeking-coverage-posts",
        question: "How do Seeking Coverage posts work?",
        answer:
          "Vendors post Seeking Coverage requests for specific areas + work type.\n\nPosts are intended for real coverage needs (not broad advertising). Field Reps who cover those areas are alerted and can express interest in the work."
      },
      {
        id: "matched-alerts",
        question: "How do Matched Alerts work?",
        answer:
          "Field Reps are alerted only when a Seeking Coverage post matches their coverage area.\n\nField Reps can then show interest in the work, which starts a conversation with the Vendor."
      },
      {
        id: "why-anonymous-search-limited",
        question: "Why is anonymous search limited?",
        answer:
          "This approach is designed to reduce spam and irrelevant outreach, including:\n\n• \"I'm available\" messages in areas where nobody needs coverage\n• Vendor messages to reps who don't cover that area\n\nResult: less noise, more relevant connections, faster matching."
      }
    ]
  },
  connections_privacy: {
    label: "Connections & Privacy",
    icon: Lock,
    items: [
      {
        id: "messaging-before-connecting",
        question: "Can I message before connecting?",
        answer:
          "Yes! Full contact details stay private until both parties are connected.\n\nWhile a Vendor and an interested Field Rep are discussing a Seeking Coverage opportunity, they can communicate through in-platform messages.\n\nThis allows coordination and Q&A without exposing personal contact info."
      },
      {
        id: "contact-unlock-after-connection",
        question: "When are contact details shared?",
        answer:
          "Once both the Vendor and the interested Field Rep reach an agreement and both choose to connect, a connection is established (In Network).\n\nOnly after that connection is established will full contact details be provided to both parties."
      }
    ]
  },
  trust_reviews: {
    label: "Trust & Reviews",
    icon: Star,
    items: [
      {
        id: "verified-reviews",
        question: "How do verified reviews work?",
        answer:
          "Reviews are designed to reflect real working experiences.\n\nReview categories include:\n• On-time\n• Quality\n• Communication\n\nReviews can only be left after a connection has been established and work has been discussed."
      },
      {
        id: "review-cooldown",
        question: "What is the review cooldown?",
        answer:
          "Reviews are limited so that only one review can be left, then a required amount of time must pass before another review can be submitted for the same person/company.\n\nThis helps prevent spam and score manipulation (ex: daily 5-star reviews from the same user)."
      },
      {
        id: "feedback-option",
        question: "What is the Feedback option?",
        answer:
          "Users have a limited option to mark certain submissions as Feedback rather than a score-impacting review.\n\n• Feedback does not directly affect Trust Scores\n• Feedback is treated as an internal improvement note to encourage better performance without unfairly misrepresenting someone's overall track record"
      },
      {
        id: "review-notifications",
        question: "How do review notifications work?",
        answer:
          "Both parties are notified when a review is added.\n\nUsers have an opportunity to approve or dispute before it becomes public (to reduce unfair ratings)."
      },
      {
        id: "trust-vs-community-score",
        question: "What's the difference between Trust Score and Community Score?",
        answer:
          "Trust Score: reliability signals over time (including verified performance trends based on work-related reviews)\n\nCommunity Score: community participation + peer helpfulness signals from the Community Board\n\nCommunity Score can be used as a sort/filter signal where implemented."
      }
    ]
  },
  community: {
    label: "Community Board",
    icon: Handshake,
    items: [
      {
        id: "community-board",
        question: "What is the Community Board?",
        answer:
          "The Community Board is a space where users can post updates, ask questions, share helpful info, and support one another.\n\nIt's designed to encourage peer-to-peer support within the ClearMarket community."
      },
      {
        id: "post-comment-controls",
        question: "What controls are available for posts and comments?",
        answer:
          "• Mark content Helpful / Not Helpful\n• Flag/Report content for moderator review\n• Heavily flagged content may be greyed out and sent for review"
      },
      {
        id: "under-review-ping",
        question: "What is the 'Ping' feature for Under Review content?",
        answer:
          "Users can \"ping\" posts marked Under Review to show interest.\n\nUsers who ping are alerted once the post is reviewed and results are published.\n\nThis helps moderators prioritize what gets reviewed first."
      }
    ]
  },
  credits_billing: {
    label: "Credits & Billing",
    icon: CreditCard,
    items: [
      {
        id: "what-are-credits",
        question: "What are credits used for?",
        answer:
          "Credits power certain actions inside ClearMarket.\n\nExamples include:\n• Posting or boosting Seeking Coverage requests\n• Accessing specific premium features that are marked as credit-based\n\nField Reps do not pay credits just to have a profile or participate in the community."
      },
      {
        id: "buy-credits",
        question: "How do I buy credits?",
        answer:
          "Vendors can purchase credits from the Credits or Billing page inside the app.\n\n1. Go to Credits/Billing.\n2. Choose the amount of credits you want to purchase.\n3. Enter your payment details and confirm.\n\nPayments are processed securely through Stripe. ClearMarket does not store your full card number."
      },
      {
        id: "credit-activity",
        question: "Where can I see my recent credit activity?",
        answer:
          "Open the Credits or Billing section and look for your credit history or activity.\n\nYou'll see:\n• When credits were purchased\n• Which actions used credits (for example, a post)\n• Your remaining credit balance\n\nIf something doesn't look right, contact Support so we can review it with you."
      }
    ]
  },
  safety_support: {
    label: "Policies & Support",
    icon: Shield,
    items: [
      {
        id: "refund-requests",
        question: "How do refund requests work?",
        answer:
          "Refunds may be considered in limited situations (ex: duplicate charges or failed feature delivery).\n\nAll refund requests require a Support Ticket submitted with detailed proof, including:\n• A clear written explanation (step-by-step)\n• Screenshots showing the issue\n• Proof of failed feature delivery (error messages, missing access after payment, timestamps, confirmation screens, etc.)\n\nRequests without sufficient detail and proof may be denied.\n\nSupport: hello@useclearmarket.io"
      },
      {
        id: "report-user",
        question: "How do I report a user or content?",
        answer:
          "Use the flag or report option on profiles, messages, or Community Board posts (where available) to submit a report.\n\nYou can also email hello@useclearmarket.io with a link and a brief description of the issue. Our moderation team reviews reports and may warn, limit, or remove users or content that violates our guidelines or Terms of Service."
      },
      {
        id: "block-user",
        question: "How do I block another user?",
        answer:
          "If a block feature is available in your account, you can block users from message threads or profiles so they can't contact you.\n\nIf you don't see a block option yet but need to stop contact from someone, email hello@useclearmarket.io with their name or profile link and we'll review what actions can be taken."
      },
      {
        id: "contact-support",
        question: "How do I contact Support?",
        answer:
          "You can contact Support in two ways:\n\n• Click the Contact Support button in the Help Center or Support page.\n• Email us directly at hello@useclearmarket.io.\n\nPlease include as much detail as you can (what you were trying to do, any error messages, and screenshots if possible) so we can help you faster."
      }
    ]
  },
  coming_soon: {
    label: "Coming Soon",
    icon: Bell,
    items: [
      {
        id: "coming-soon-intro",
        question: "What features are coming soon?",
        answer:
          "We're actively building and improving ClearMarket. The items below are planned features and may change as we refine the platform based on real user feedback."
      },
      {
        id: "coverage-maps",
        question: "Coverage Maps",
        answer:
          "• ClearMarket Coverage Map — See overall coverage growth across the network\n• My Coverage Map — Vendor-specific coverage visibility for your areas"
      },
      {
        id: "expanded-analytics",
        question: "Expanded Analytics & Reporting",
        answer:
          "More insights to help users identify coverage gaps and network strengths."
      },
      {
        id: "more-automation",
        question: "More Automation & Notification Preferences",
        answer:
          "Smarter alerts, cleaner workflows, and improved control of notifications."
      },
      {
        id: "tools-area",
        question: "Where can I see upcoming features?",
        answer:
          "For additional upcoming features, please also check the Tools area inside ClearMarket — we keep that section updated as new tools are added and released."
      }
    ]
  }
} as const;

type HelpCategory = {
  label: string;
  icon: React.ComponentType<any>;
  items: { id: string; question: string; answer: string }[];
};

type HelpData = Record<string, HelpCategory>;

export default function HelpCenter() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [faqData, setFaqData] = useState<HelpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | undefined>(undefined);

  // Load FAQ data from database
  useEffect(() => {
    async function loadFaqFromDatabase() {
      try {
        const { data, error } = await supabase
          .from("help_center_articles")
          .select("id, title, slug, category, content, display_order")
          .eq("is_published", true)
          .order("category")
          .order("display_order");

        if (error) {
          console.error("Error loading help articles from DB:", error);
          setFaqData(null);
          return;
        }

        if (!data || data.length === 0) {
          console.warn("No help articles found in database, using static fallback");
          setFaqData(null);
          return;
        }

        // Group by category and build HelpData structure
        const grouped: HelpData = {};
        
        for (const article of data) {
          const categoryKey = article.category;
          const config = CATEGORY_CONFIG[categoryKey];
          
          if (!config) {
            // Skip unknown categories
            continue;
          }

          if (!grouped[categoryKey]) {
            grouped[categoryKey] = {
              label: config.label,
              icon: config.icon,
              items: [],
            };
          }

          grouped[categoryKey].items.push({
            id: article.slug || article.id,
            question: article.title,
            answer: article.content,
          });
        }

        // Check if we got any valid data
        if (Object.keys(grouped).length === 0) {
          console.warn("No valid categories found in database, using static fallback");
          setFaqData(null);
          return;
        }

        setFaqData(grouped);
      } catch (err) {
        console.error("Failed to load FAQ from database:", err);
        setFaqData(null);
      } finally {
        setLoading(false);
      }
    }

    loadFaqFromDatabase();
  }, []);

  // Use DB data if available, otherwise fallback to static
  const activeFaqData: HelpData = useMemo(() => {
    if (faqData && Object.keys(faqData).length > 0) {
      return faqData;
    }
    // Fallback to static FAQ
    return STATIC_FAQ as unknown as HelpData;
  }, [faqData]);

  // Handle slug parameter to auto-focus article
  useEffect(() => {
    if (!slug || loading) return;
    
    // Find the article by slug
    for (const [categoryKey, category] of Object.entries(activeFaqData)) {
      const matchingItem = category.items.find(item => item.id === slug);
      if (matchingItem) {
        setActiveTab(categoryKey);
        setExpandedItem(matchingItem.id);
        // Scroll to the article after a short delay to allow render
        setTimeout(() => {
          const element = document.getElementById(`faq-${matchingItem.id}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
        break;
      }
    }
  }, [slug, loading, activeFaqData]);

  // Filter FAQ items by search term
  const filteredFAQ = useMemo(() => {
    if (!searchTerm) return activeFaqData;
    
    const search = searchTerm.toLowerCase();
    const filtered: HelpData = {};
    
    for (const [key, category] of Object.entries(activeFaqData)) {
      const matchingItems = category.items.filter(
        (item) =>
          item.question.toLowerCase().includes(search) ||
          item.answer.toLowerCase().includes(search)
      );
      if (matchingItems.length > 0) {
        filtered[key] = {
          ...category,
          items: matchingItems
        };
      }
    }
    
    return filtered;
  }, [searchTerm, activeFaqData]);

  // Get all items for search results display
  const allFilteredItems = useMemo(() => {
    if (!searchTerm) return [];
    return Object.entries(filteredFAQ).flatMap(([key, category]) =>
      category.items.map(item => ({ ...item, categoryKey: key, categoryLabel: category.label }))
    );
  }, [filteredFAQ, searchTerm]);

  const handleBackToDashboard = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/signin");
    }
  };

  const hasResults = searchTerm 
    ? allFilteredItems.length > 0 
    : Object.keys(activeFaqData).length > 0;

  // Get available categories (only those with data)
  const availableCategories = CATEGORY_ORDER.filter(key => activeFaqData[key]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-primary/10 to-background py-12 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <HelpCircle className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-bold">Help Center</h1>
          </div>
          <p className="text-muted-foreground text-lg mb-6">
            Find quick answers to common questions about using ClearMarket.
          </p>

          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for answers..."
              className="pl-12 h-12 text-lg"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" onClick={() => navigate("/support")}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Contact Support
          </Button>
        </div>

        {/* Search Results or Tabbed Content */}
        {searchTerm ? (
          // Show flat search results
          hasResults ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {allFilteredItems.length} result{allFilteredItems.length !== 1 ? "s" : ""} found
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {allFilteredItems.map((item) => (
                    <AccordionItem key={item.id} value={item.id}>
                      <AccordionTrigger className="text-left">
                        <div>
                          <span>{item.question}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {item.categoryLabel}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="whitespace-pre-wrap text-muted-foreground">{item.answer}</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h2 className="text-xl font-semibold mb-2">No results found</h2>
                <p className="text-muted-foreground mb-4">
                  Try different keywords or browse all topics.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={() => setSearchTerm("")}>
                    Clear Search
                  </Button>
                  <Button onClick={() => navigate("/support")}>
                    Submit a Support Request
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        ) : (
          // Show tabbed categories
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
              <TabsTrigger value="all" className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                All Topics
              </TabsTrigger>
              {availableCategories.map((key) => {
                const category = activeFaqData[key];
                if (!category) return null;
                const Icon = category.icon;
                return (
                  <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {category.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* All Topics Tab */}
            <TabsContent value="all" className="space-y-6">
              {availableCategories.map((key) => {
                const category = activeFaqData[key];
                if (!category) return null;
                const Icon = category.icon;
                return (
                  <Card key={key}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        {category.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full" value={expandedItem} onValueChange={setExpandedItem}>
                        {category.items.map((item) => (
                          <AccordionItem key={item.id} value={item.id} id={`faq-${item.id}`}>
                            <AccordionTrigger className="text-left">
                              {item.question}
                            </AccordionTrigger>
                            <AccordionContent>
                              <p className="whitespace-pre-wrap text-muted-foreground">{item.answer}</p>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* Individual Category Tabs */}
            {availableCategories.map((key) => {
              const category = activeFaqData[key];
              if (!category) return null;
              const Icon = category.icon;
              return (
                <TabsContent key={key} value={key}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        {category.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full" value={expandedItem} onValueChange={setExpandedItem}>
                        {category.items.map((item) => (
                          <AccordionItem key={item.id} value={item.id} id={`faq-${item.id}`}>
                            <AccordionTrigger className="text-left">
                              {item.question}
                            </AccordionTrigger>
                            <AccordionContent>
                              <p className="whitespace-pre-wrap text-muted-foreground">{item.answer}</p>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        {/* Bottom CTA */}
        <Card className="mt-8">
          <CardContent className="py-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Need more help?</h3>
            <p className="text-muted-foreground mb-6">
              Can't find what you're looking for? Our support team is here to help.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate("/support")}>
                <MessageCircle className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
              <Button variant="outline" onClick={handleBackToDashboard}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {user ? "Back to Dashboard" : "Sign In"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
