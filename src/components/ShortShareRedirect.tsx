import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Short share URL redirect component
 * Resolves /s/:slug to the correct /share/rep/:slug or /share/vendor/:slug
 */
export default function ShortShareRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"rep" | "vendor" | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function resolveSlug() {
      if (!slug) {
        setError(true);
        setLoading(false);
        return;
      }

      try {
        // Call the edge function to resolve the slug - it detects role automatically
        const { data, error: fetchError } = await supabase.functions.invoke(
          "public-profile-share",
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        // Use query params approach since we need to pass slug
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
          setError(true);
          setLoading(false);
          return;
        }

        const profileData = await response.json();

        if (profileData.role === "rep" || profileData.role === "vendor") {
          setRole(profileData.role);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Error resolving short share slug:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    resolveSlug();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  if (error || !role) {
    return <Navigate to="/not-found" replace />;
  }

  return <Navigate to={`/share/${role}/${slug}`} replace />;
}
