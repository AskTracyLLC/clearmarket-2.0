import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Search, HelpCircle, CreditCard, Shield, MessageCircle, Rocket, UserCog } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Static FAQ content
const STATIC_FAQ = {
  getting_started: {
    label: "Getting Started",
    icon: Rocket,
    items: [
      {
        id: "what-is-clearmarket",
        question: "What is ClearMarket?",
        answer: "ClearMarket is a networking platform that connects field reps and vendors in the property inspection industry. Reps can showcase their coverage and experience, vendors can post Seeking Coverage requests and find reliable reps."
      },
      {
        id: "get-started-rep",
        question: "How do I get started as a Field Rep?",
        answer: "1. Create your account\n2. Complete your Field Rep Profile\n3. Add your Coverage Areas & pricing\n4. Join the Community Board and start participating"
      },
      {
        id: "get-started-vendor",
        question: "How do I get started as a Vendor?",
        answer: "1. Create your account\n2. Complete your Vendor Profile\n3. Fund your credits (if Stripe is connected)\n4. Post your first Seeking Coverage request"
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
        answer: "Use the Forgot Password link on the sign-in page. You'll receive an email with a secure reset link. If you still can't sign in, contact Support from the Help Center."
      },
      {
        id: "deactivate-account",
        question: "How do I deactivate my account?",
        answer: "You can request deactivation from inside the app. Admins may deactivate accounts that violate our guidelines. Deactivated accounts can't log in or appear in search."
      },
      {
        id: "restricted-pages",
        question: "Why can't I see certain pages?",
        answer: "Some pages are role-specific. Vendor-only and Field Rep–only pages may be restricted unless you have the correct role. Admins can view both with an admin banner."
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
        answer: "Credits power vendor actions in ClearMarket (for example, posting Seeking Coverage or unlocking contact details). Field reps do not pay credits to participate."
      },
      {
        id: "buy-credits",
        question: "How do I buy credits?",
        answer: "Vendors can purchase credits from the Credits page. Purchases are handled by Stripe; ClearMarket never stores your full card details."
      },
      {
        id: "credit-activity",
        question: "Where can I see my recent credit activity?",
        answer: "The Credits page shows a transaction history including date, action (e.g., Seeking Coverage post, unlock), amount, and any admin adjustments."
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
        answer: "Use the flag icon on profiles, messages, or Community Board posts to submit a report. Our moderation team reviews reports and may take further action."
      },
      {
        id: "block-user",
        question: "How do I block another user?",
        answer: "You can block users from message threads or profiles. Blocked users can't message you, connect with you, or see certain actions."
      },
      {
        id: "contact-support",
        question: "How do I contact Support?",
        answer: "Use the Contact Support button below to open a ticket, or email us at hello@useclearmarket.io."
      }
    ]
  }
};

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
    const filtered: typeof STATIC_FAQ = {} as any;
    
    for (const [key, category] of Object.entries(STATIC_FAQ)) {
      const matchingItems = category.items.filter(
        (item) =>
          item.question.toLowerCase().includes(search) ||
          item.answer.toLowerCase().includes(search)
      );
      if (matchingItems.length > 0) {
        filtered[key as keyof typeof STATIC_FAQ] = {
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
