import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://useclearmarket.io";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch published blog posts (RLS allows public to read published posts)
    const { data: posts, error } = await supabase
      .from("blog_posts")
      .select("slug, updated_at, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error) {
      console.error("Sitemap query error:", error);
    }

    // Build sitemap XML
    const today = new Date().toISOString().split("T")[0];
    
    let urls = `
    <url>
      <loc>${SITE_URL}/</loc>
      <lastmod>${today}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>1.0</priority>
    </url>
    <url>
      <loc>${SITE_URL}/blog</loc>
      <lastmod>${today}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.7</priority>
    </url>`;

    // Add blog post URLs
    if (posts && posts.length > 0) {
      for (const post of posts) {
        const lastmod = post.updated_at
          ? new Date(post.updated_at).toISOString().split("T")[0]
          : post.published_at
          ? new Date(post.published_at).toISOString().split("T")[0]
          : today;

        urls += `
    <url>
      <loc>${SITE_URL}/blog/${post.slug}</loc>
      <lastmod>${lastmod}</lastmod>
      <changefreq>monthly</changefreq>
      <priority>0.6</priority>
    </url>`;
      }
    }

    // Add other public pages
    urls += `
    <url>
      <loc>${SITE_URL}/help</loc>
      <lastmod>${today}</lastmod>
      <changefreq>monthly</changefreq>
      <priority>0.5</priority>
    </url>
    <url>
      <loc>${SITE_URL}/terms</loc>
      <lastmod>${today}</lastmod>
      <changefreq>monthly</changefreq>
      <priority>0.3</priority>
    </url>
    <url>
      <loc>${SITE_URL}/privacy</loc>
      <lastmod>${today}</lastmod>
      <changefreq>monthly</changefreq>
      <priority>0.3</priority>
    </url>`;

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Sitemap generation error:", err);
    
    // Return minimal valid sitemap on error
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>${SITE_URL}/blog</loc>
      <changefreq>daily</changefreq>
      <priority>0.9</priority>
    </url>
</urlset>`;

    return new Response(fallbackSitemap, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  }
});
