import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Search, Calendar, Tag, FolderOpen, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SiteFooter } from "@/components/SiteFooter";
import { format } from "date-fns";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category: string | null;
  tags: string[];
  published_at: string | null;
}

export default function PublicBlogIndex() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("blog_posts")
      .select("id, title, slug, excerpt, cover_image_url, category, tags, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error) {
      console.error("Error loading blog posts:", error);
    } else {
      setPosts(data || []);
    }
    setLoading(false);
  };

  // Derive categories from posts
  const categories = useMemo(() => {
    const cats = new Set<string>();
    posts.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [posts]);

  // Derive all tags from posts
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    posts.forEach((p) => {
      p.tags?.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [posts]);

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesSearch =
        !searchQuery ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.excerpt && post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        selectedCategory === "all" || post.category === selectedCategory;

      const matchesTag = !selectedTag || post.tags?.includes(selectedTag);

      return matchesSearch && matchesCategory && matchesTag;
    });
  }, [posts, searchQuery, selectedCategory, selectedTag]);

  return (
    <>
      <Helmet>
        <title>Blog | ClearMarket</title>
        <meta
          name="description"
          content="Insights and tips for field reps seeking work and vendors looking for coverage in the property inspection industry."
        />
        <link rel="canonical" href="https://useclearmarket.io/blog" />
        <meta property="og:title" content="ClearMarket Blog" />
        <meta
          property="og:description"
          content="Insights and tips for field reps seeking work and vendors looking for coverage in the property inspection industry."
        />
        <meta property="og:url" content="https://useclearmarket.io/blog" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="ClearMarket Blog" />
        <meta
          name="twitter:description"
          content="Insights and tips for field reps seeking work and vendors looking for coverage."
        />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/images/clearmarket-logo.jpg"
                alt="ClearMarket"
                className="h-8 w-8 rounded"
              />
              <span className="font-semibold text-lg text-foreground">ClearMarket</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                to="/signin"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign In
              </Link>
              <Button asChild size="sm">
                <Link to="/signup">Get Started</Link>
              </Button>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          <div className="container mx-auto px-4 py-8 md:py-12">
            {/* Page Title */}
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                ClearMarket Blog
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Insights, tips, and industry news for property inspection professionals.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full md:w-48">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tag Chips */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    !selectedTag
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  All
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`text-xs px-3 py-1 rounded-full transition-colors ${
                      selectedTag === tag
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    <Tag className="inline h-3 w-3 mr-1" />
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* Posts Grid */}
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading posts...</p>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No posts found.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredPosts.map((post) => (
                  <Link key={post.id} to={`/blog/${post.slug}`}>
                    <Card className="h-full hover:border-primary/50 transition-colors group">
                      {post.cover_image_url && (
                        <div className="aspect-video overflow-hidden rounded-t-lg">
                          <img
                            src={post.cover_image_url}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 mb-2">
                          {post.category && (
                            <Badge variant="secondary" className="text-xs">
                              {post.category}
                            </Badge>
                          )}
                          {post.published_at && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(post.published_at), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {post.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {post.excerpt && (
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {post.excerpt}
                          </p>
                        )}
                        {post.tags && post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {post.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                            {post.tags.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{post.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            {/* CTA Section */}
            <div className="mt-16 border-t border-border pt-12">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Ready to Get Started?
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Whether you're looking for work or seeking coverage, ClearMarket connects
                  independent contractors with opportunities.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button asChild size="lg">
                  <Link to="/signup?role=rep">
                    Looking for Work
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/signup?role=vendor">
                    Seeking Coverage
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground mt-8 max-w-2xl mx-auto">
                All ClearMarket content is informational and based on community workflows.
                ClearMarket does not employ Field Reps—all work relationships are between
                independent contractors and vendors.
              </p>
            </div>
          </div>
        </main>

        <SiteFooter variant="public" />
      </div>
    </>
  );
}
