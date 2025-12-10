import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";

type PageType = "terms" | "privacy";

interface SitePage {
  id: string;
  title: string;
  content: string;
  effective_at: string | null;
  last_updated_at: string;
  is_published: boolean;
}

const pageTypeMap: Record<PageType, string> = {
  terms: "tos",
  privacy: "privacy",
};

export default function LegalPage() {
  const { pageType } = useParams<{ pageType: string }>();
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<SitePage | null>(null);
  const [notFound, setNotFound] = useState(false);

  const dbPageType = pageTypeMap[pageType as PageType];

  useEffect(() => {
    if (!dbPageType) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    loadPage();
  }, [pageType, dbPageType]);

  async function loadPage() {
    try {
      const { data, error } = await supabase
        .from("site_pages")
        .select("id, title, content, effective_at, last_updated_at, is_published")
        .eq("page_type", dbPageType as "tos" | "privacy" | "support")
        .eq("is_published", true)
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setPage(data);
      }
    } catch (err) {
      console.error("Error loading page:", err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The requested page is not available or has not been published yet.
        </p>
        <Link to="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8 px-4">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-2">{page.title}</h1>
          
          <div className="text-sm text-muted-foreground mb-8 space-y-1">
            {page.effective_at && (
              <p>Effective: {format(new Date(page.effective_at), "MMMM d, yyyy")}</p>
            )}
            <p>Last Updated: {format(new Date(page.last_updated_at), "MMMM yyyy")}</p>
          </div>

          <div className="whitespace-pre-wrap leading-relaxed">
            {page.content}
          </div>
        </article>

        <div className="mt-12 pt-6 border-t text-center text-sm text-muted-foreground">
          <p>
            Questions? Contact us at{" "}
            <a href="mailto:hello@useclearmarket.io" className="text-primary hover:underline">
              hello@useclearmarket.io
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
