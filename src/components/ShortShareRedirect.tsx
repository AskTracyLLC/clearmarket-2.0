import { useEffect, useState } from "react";
import { useParams, Navigate, Link, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw } from "lucide-react";

type ErrorType = "not_found" | "expired" | "invalid" | "server_error" | "invalid_role" | null;

/**
 * Short share URL redirect component
 * Resolves /s/:slug to the correct /share/rep/:slug or /share/vendor/:slug
 * Shows friendly error messages instead of generic 404
 */
export default function ShortShareRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"rep" | "vendor" | null>(null);
  const [error, setError] = useState<ErrorType>(null);
  const [retrying, setRetrying] = useState(false);

  const resolveSlug = async () => {
    if (!slug) {
      setError("invalid");
      setLoading(false);
      return;
    }

    // Basic validation - slug should be alphanumeric
    if (!/^[a-zA-Z0-9]+$/.test(slug)) {
      setError("invalid");
      setLoading(false);
      return;
    }

    try {
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
        const errorCode = errorData.error;
        
        // Map backend error codes to user-friendly error types
        if (response.status === 404) {
          if (errorCode === "PROFILE_NOT_FOUND") {
            setError("expired");
          } else {
            setError("not_found");
          }
        } else if (response.status === 400) {
          if (errorCode === "INVALID_ROLE") {
            // Profile exists but user hasn't set up their role
            setError("invalid_role");
          } else if (errorCode === "SLUG_REQUIRED") {
            setError("invalid");
          } else {
            setError("invalid");
          }
        } else if (response.status >= 500) {
          setError("server_error");
        } else {
          setError("not_found");
        }
        setLoading(false);
        return;
      }

      const profileData = await response.json();

      if (profileData.role === "rep" || profileData.role === "vendor") {
        setRole(profileData.role);
      } else {
        setError("invalid_role");
      }
    } catch (err) {
      console.error("Error resolving short share slug:", err);
      setError("server_error");
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };

  useEffect(() => {
    resolveSlug();
  }, [slug]);

  const handleRetry = () => {
    setRetrying(true);
    setError(null);
    setLoading(true);
    resolveSlug();
  };

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
    const errorMessages: Record<NonNullable<ErrorType>, { icon: string; title: string; description: string; showRetry?: boolean }> = {
      not_found: {
        icon: "🔍",
        title: "Profile Not Found",
        description: "This shared profile link doesn't exist. It may have been removed or the link is incorrect."
      },
      expired: {
        icon: "⏱️",
        title: "Link Expired or Disabled",
        description: "This shared profile link is no longer active. The profile owner may have disabled sharing or regenerated their link."
      },
      invalid: {
        icon: "⚠️",
        title: "Invalid Link",
        description: "This link appears to be malformed or incomplete. Please check the URL and try again."
      },
      invalid_role: {
        icon: "👤",
        title: "Profile Not Available",
        description: "This user hasn't completed their profile setup yet. The profile will be available once they finish setting up their account."
      },
      server_error: {
        icon: "🔧",
        title: "Temporary Error",
        description: "We're having trouble loading this profile right now. Please try again in a moment.",
        showRetry: true
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
              {errorInfo.showRetry && (
                <Button 
                  onClick={handleRetry} 
                  disabled={retrying}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
                  {retrying ? 'Retrying...' : 'Try Again'}
                </Button>
              )}
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

  // Preserve query params (e.g. ?view=client) during redirect
  const queryString = searchParams.toString();
  const redirectPath = `/share/${role}/${slug}${queryString ? `?${queryString}` : ''}`;

  return <Navigate to={redirectPath} replace />;
}
