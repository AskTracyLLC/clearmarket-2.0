import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Search, HelpCircle, CreditCard, Shield, MessageCircle, Rocket, UserCog } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";

// Static FAQ content
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
          "1. Create your account and select the Vendor role.\n2. Complete your Vendor Profile (company details, coverage, inspection types).\n3. Add the systems/platforms you use so reps know what to expect.\n4. Purchase credits if you plan to use credit-based features.\n5. Search for Field Reps in your coverage gaps or post Seeking Coverage (when available) and reach out directly.\n\nAll work agreements and pricing are handled directly between you and the Field Rep."
      }
    ]
  },
  accounts_access: {
    label: "Accounts & Access",
    icon: UserCog,
    items: [
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
  credits_billing: {
    label: "Credits & Billing",
    icon: CreditCard,
    items: [
      {
        id: "what-are-credits",
        question: "What are credits used for?",
        answer:
          "Credits power certain actions inside ClearMarket.\n\nExamples include:\n• Unlocking more detailed contact information for Field Reps or Vendors\n• Posting or boosting Seeking Coverage requests (where available)\n• Accessing specific premium features that are marked as credit-based\n\nField Reps do not pay credits just to have a profile or participate in the community."
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
          "Open the Credits or Billing section and look for your credit history or activity.\n\nYou'll see:\n• When credits were purchased\n• Which actions used credits (for example, an unlock or post)\n• Your remaining credit balance\n\nIf something doesn't look right, contact Support so we can review it with you."
      }
    ]
  },
  safety_support: {
    label: "Safety & Support",
    icon: Shield,
    items: [
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
  }
} as const;

const CATEGORY_ORDER = ["getting_started", "accounts_access", "credits_billing", "safety_support"] as const;

export default function HelpCenter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  // Filter FAQ items by search term
  const filteredFAQ = useMemo(() => {
    if (!searchTerm) return STATIC_FAQ;
    
    const search = searchTerm.toLowerCase();
    const filtered: Record<string, { label: string; icon: typeof Rocket; items: readonly { id: string; question: string; answer: string }[] }> = {};
    
    for (const [key, category] of Object.entries(STATIC_FAQ)) {
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
  }, [searchTerm]);

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
    : Object.keys(STATIC_FAQ).length > 0;

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
              {CATEGORY_ORDER.map((key) => {
                const category = STATIC_FAQ[key];
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
              {CATEGORY_ORDER.map((key) => {
                const category = STATIC_FAQ[key];
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
                      <Accordion type="single" collapsible className="w-full">
                        {category.items.map((item) => (
                          <AccordionItem key={item.id} value={item.id}>
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
            {CATEGORY_ORDER.map((key) => {
              const category = STATIC_FAQ[key];
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
                      <Accordion type="single" collapsible className="w-full">
                        {category.items.map((item) => (
                          <AccordionItem key={item.id} value={item.id}>
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
