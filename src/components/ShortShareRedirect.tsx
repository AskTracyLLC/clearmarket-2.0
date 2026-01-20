import { useEffect, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, AlertCircle } from "lucide-react";

/**
 * Short share URL redirect component
 * Resolves /s/:slug to the correct /share/rep/:slug or /share/vendor/:slug
 * Shows friendly error messages instead of generic 404
 */
export default function ShortShareRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"rep" | "vendor" | null>(null);
  const [error, setError] = useState<"not_found" | "expired" | "invalid" | null>(null);

  useEffect(() => {
    async function resolveSlug() {
      if (!slug) {
        setError("invalid");
        setLoading(false);
        return;
      }

      try {
        // Call the edge function to resolve the slug
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-profile-share?slug=${encodeURIComponent(slug)}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          // Determine error type based on response
          if (response.status === 404) {
            if (errorData.error === 'PROFILE_NOT_FOUND') {
              setError("not_found");
            } else {
              setError("expired");
            }
          } else {
            setError("invalid");
          }
          setLoading(false);
          return;
        }

        const profileData = await response.json();

        if (profileData.role === "rep" || profileData.role === "vendor") {
          setRole(profileData.role);
        } else {
          setError("invalid");
        }
      } catch (err) {
        console.error("Error resolving short share slug:", err);
        setError("not_found");
      } finally {
        setLoading(false);
      }
    }

    resolveSlug();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-12 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/2 mx-auto" />
              <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
              <p className="text-muted-foreground">Loading profile...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show friendly error page instead of redirecting to /not-found
  if (error) {
    const errorMessages = {
      not_found: {
        icon: "🔍",
        title: "Profile Not Found",
        description: "This shared profile link doesn't exist. It may have been removed or the link is incorrect."
      },
      expired: {
        icon: "⏱️",
        title: "Link Expired",
        description: "This shared profile link is no longer active. The profile owner may have disabled sharing or regenerated their link."
      },
      invalid: {
        icon: "⚠️",
        title: "Invalid Link",
        description: "This link appears to be malformed or incomplete. Please check the URL and try again."
      }
    };

    const errorInfo = errorMessages[error];

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-6">
            <div className="text-6xl">{errorInfo.icon}</div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{errorInfo.title}</h1>
              <p className="text-muted-foreground">{errorInfo.description}</p>
            </div>
            
            <div className="flex flex-col gap-3">
              <Link to="/">
                <Button className="w-full gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Go to ClearMarket
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground">
                ClearMarket connects field reps and vendors in the property inspection industry.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!role) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to={`/share/${role}/${slug}`} replace />;
}
