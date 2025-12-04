import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Search, HelpCircle, BookOpen, MessageSquare, SearchX } from "lucide-react";
import {
  fetchPublishedArticles,
  ARTICLE_CATEGORIES,
  type SupportArticle,
} from "@/lib/support";

export default function HelpCenter() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<SupportArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    loadArticles();
  }, []);

  async function loadArticles() {
    setLoading(true);
    const data = await fetchPublishedArticles();
    setArticles(data);
    setLoading(false);
  }

  const filteredArticles = useMemo(() => {
    let result = articles;

    // Filter by category
    if (activeTab !== "all") {
      result = result.filter((a) => a.category === activeTab);
    }

    // Filter by search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(search) ||
          a.body.toLowerCase().includes(search)
      );
    }

    return result;
  }, [articles, activeTab, searchTerm]);

  const articlesByCategory = useMemo(() => {
    const grouped: Record<string, SupportArticle[]> = {};
    for (const article of filteredArticles) {
      if (!grouped[article.category]) {
        grouped[article.category] = [];
      }
      grouped[article.category].push(article);
    }
    return grouped;
  }, [filteredArticles]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-primary/10 to-background py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BookOpen className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-bold">Help Center</h1>
          </div>
          <p className="text-muted-foreground text-lg mb-6">
            Answers to common questions about ClearMarket
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

      <div className="max-w-4xl mx-auto p-6">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" onClick={() => navigate("/support")}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Contact Support
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading articles...</p>
          </div>
        ) : articles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <HelpCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-semibold mb-2">Help articles coming soon</h2>
              <p className="text-muted-foreground mb-4">
                We're working on building out our help documentation.
              </p>
              <Button onClick={() => navigate("/support")}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Submit a Support Request
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Category Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="all">All Topics</TabsTrigger>
                {ARTICLE_CATEGORIES.map((cat) => (
                  <TabsTrigger key={cat.value} value={cat.value}>
                    {cat.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Results */}
            {filteredArticles.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <SearchX className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h2 className="text-xl font-semibold mb-2">No articles match your search</h2>
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
            ) : activeTab === "all" && !searchTerm ? (
              // Show grouped by category
              <div className="space-y-8">
                {ARTICLE_CATEGORIES.map((cat) => {
                  const catArticles = articlesByCategory[cat.value];
                  if (!catArticles || catArticles.length === 0) return null;
                  return (
                    <Card key={cat.value}>
                      <CardHeader>
                        <CardTitle className="text-lg">{cat.label}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                          {catArticles.map((article) => (
                            <AccordionItem key={article.id} value={article.id}>
                              <AccordionTrigger className="text-left">
                                {article.title}
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <p className="whitespace-pre-wrap">{article.body}</p>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              // Show flat list (filtered)
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {filteredArticles.length} article{filteredArticles.length !== 1 ? "s" : ""} found
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {filteredArticles.map((article) => (
                      <AccordionItem key={article.id} value={article.id}>
                        <AccordionTrigger className="text-left">
                          <div>
                            <span>{article.title}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {ARTICLE_CATEGORIES.find((c) => c.value === article.category)?.label}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <p className="whitespace-pre-wrap">{article.body}</p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Bottom CTA */}
        <Card className="mt-8">
          <CardContent className="py-6 text-center">
            <p className="text-muted-foreground mb-3">
              Didn't find what you were looking for?
            </p>
            <Button onClick={() => navigate("/support")}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Submit a Support Request
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
