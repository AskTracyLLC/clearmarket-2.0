import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Search, BookOpen, ChevronRight } from "lucide-react";

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  content: string;
  display_order: number;
}

export default function PublicHelpCenter() {
  const { articleSlug } = useParams<{ articleSlug: string }>();
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    loadArticles();
  }, []);

  useEffect(() => {
    if (articleSlug && articles.length > 0) {
      const article = articles.find((a) => a.slug === articleSlug);
      setSelectedArticle(article || null);
    } else {
      setSelectedArticle(null);
    }
  }, [articleSlug, articles]);

  async function loadArticles() {
    try {
      const { data, error } = await supabase
        .from("help_center_articles")
        .select("id, title, slug, category, content, display_order")
        .eq("is_published", true)
        .order("category")
        .order("display_order");

      if (error) throw error;

      setArticles(data || []);
      const uniqueCategories = [...new Set((data || []).map((a) => a.category))];
      setCategories(uniqueCategories);
    } catch (err) {
      console.error("Error loading articles:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredArticles = articles.filter((article) => {
    const matchesSearch =
      !searchQuery ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "all" || article.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedArticles = filteredArticles.reduce((acc, article) => {
    if (!acc[article.category]) {
      acc[article.category] = [];
    }
    acc[article.category].push(article);
    return acc;
  }, {} as Record<string, HelpArticle[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Single article view
  if (selectedArticle) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl py-8 px-4">
          <Link
            to="/help"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Help Center
          </Link>

          <article className="prose prose-neutral dark:prose-invert max-w-none">
            <div className="text-sm text-primary font-medium mb-2">{selectedArticle.category}</div>
            <h1 className="text-3xl font-bold mb-6">{selectedArticle.title}</h1>
            <div className="whitespace-pre-wrap leading-relaxed">{selectedArticle.content}</div>
          </article>

          <div className="mt-12 pt-6 border-t">
            <p className="text-sm text-muted-foreground mb-4">
              Still need help? Contact our support team.
            </p>
            <Link to="/support">
              <Button variant="outline">Contact Support</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Article listing view
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8 px-4">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Help Center</h1>
          <p className="text-muted-foreground">
            Find answers to common questions and learn how to use ClearMarket
          </p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {categories.length > 0 && (
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-8">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="all">All</TabsTrigger>
              {categories.map((cat) => (
                <TabsTrigger key={cat} value={cat}>
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {filteredArticles.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery
                  ? "No articles found matching your search."
                  : "No help articles available yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedArticles).map(([category, categoryArticles]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-lg">{category}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {categoryArticles.map((article) => (
                      <Link
                        key={article.id}
                        to={`/help/${article.slug}`}
                        className="flex items-center justify-between px-6 py-4 hover:bg-accent/50 transition-colors group"
                      >
                        <span className="font-medium">{article.title}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-12 pt-6 border-t text-center">
          <p className="text-muted-foreground mb-4">
            Can't find what you're looking for?
          </p>
          <Link to="/support">
            <Button>Contact Support</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
