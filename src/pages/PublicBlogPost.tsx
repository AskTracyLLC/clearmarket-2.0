import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Calendar, Tag, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteFooter } from "@/components/SiteFooter";
import { format } from "date-fns";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  content_markdown: string;
  category: string | null;
  tags: string[];
  published_at: string | null;
}

export default function PublicBlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (slug) {
      loadPost(slug);
    }
  }, [slug]);

  const loadPost = async (postSlug: string) => {
    setLoading(true);
    setNotFound(false);

    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", postSlug)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error("Error loading blog post:", error);
      setNotFound(true);
    } else if (!data) {
      setNotFound(true);
    } else {
      setPost(data);
    }
    setLoading(false);
  };

  // Generate meta description
  const metaDescription = post?.excerpt
    ? post.excerpt
    : post?.content_markdown
    ? post.content_markdown.slice(0, 160).replace(/[#*_`\n]/g, "") + "..."
    : "Read this article on ClearMarket Blog.";

  const canonicalUrl = `https://useclearmarket.io/blog/${slug}`;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
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
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Helmet>
          <title>Post Not Found | ClearMarket Blog</title>
        </Helmet>
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
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-2xl font-bold text-foreground mb-2">Post Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The post you're looking for doesn't exist or has been unpublished.
          </p>
          <Button asChild>
            <Link to="/blog">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blog
            </Link>
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{post.title} | ClearMarket</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph */}
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="article" />
        {post.cover_image_url && (
          <meta property="og:image" content={post.cover_image_url} />
        )}

        {/* Twitter Card */}
        <meta
          name="twitter:card"
          content={post.cover_image_url ? "summary_large_image" : "summary"}
        />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={metaDescription} />
        {post.cover_image_url && (
          <meta name="twitter:image" content={post.cover_image_url} />
        )}
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
                to="/blog"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Blog
              </Link>
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
          <article className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
            {/* Back link */}
            <Link
              to="/blog"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blog
            </Link>

            {/* Cover Image */}
            {post.cover_image_url && (
              <div className="aspect-video overflow-hidden rounded-lg mb-8">
                <img
                  src={post.cover_image_url}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {post.category && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <FolderOpen className="h-3 w-3" />
                  {post.category}
                </Badge>
              )}
              {post.published_at && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(post.published_at), "MMMM d, yyyy")}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {post.title}
            </h1>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground flex items-center gap-1"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="prose prose-invert prose-lg max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold mt-8 mb-4 text-foreground">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-semibold mt-6 mb-3 text-foreground">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-4 text-foreground/90 leading-relaxed">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside mb-4 text-foreground/90 space-y-1">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside mb-4 text-foreground/90 space-y-1">{children}</ol>
                  ),
                  li: ({ children }) => <li className="text-foreground/90">{children}</li>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      className="text-primary hover:underline"
                      target={href?.startsWith("http") ? "_blank" : undefined}
                      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
                    >
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children }) => (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm text-foreground">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4">
                      {children}
                    </pre>
                  ),
                }}
              >
                {post.content_markdown}
              </ReactMarkdown>
            </div>

            {/* CTA */}
            <div className="mt-12 pt-8 border-t border-border text-center">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Join the ClearMarket Community
              </h2>
              <p className="text-muted-foreground mb-4">
                Connect with vendors and field reps in the property inspection industry.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Button asChild>
                  <Link to="/signup">Create Free Account</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/blog">More Articles</Link>
                </Button>
              </div>
            </div>
          </article>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
