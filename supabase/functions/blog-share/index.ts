import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://useclearmarket.io";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Extract slug from path: /blog-share/my-slug or /p/my-slug
    const pathParts = url.pathname.split("/").filter(Boolean);
    // The slug is the last part of the path
    const slug = pathParts[pathParts.length - 1];

    if (!slug || slug === "blog-share" || slug === "p") {
      return renderNotFound("", "No post specified");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: post, error } = await supabase
      .from("blog_posts")
      .select("title, excerpt, content_markdown, slug, cover_image_url")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error || !post) {
      return renderNotFound(slug, "This post is unavailable.");
    }

    // Generate description from excerpt or content
    const description = post.excerpt || 
      (post.content_markdown ? post.content_markdown.substring(0, 160).replace(/[#*_\n]/g, "").trim() + "..." : "");

    const canonicalUrl = `${SITE_URL}/blog/${post.slug}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(post.title)} | ClearMarket</title>
  <meta name="description" content="${escapeHtml(description)}">
  
  <!-- OpenGraph -->
  <meta property="og:site_name" content="ClearMarket">
  <meta property="og:title" content="${escapeHtml(post.title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonicalUrl}">
  ${post.cover_image_url ? `<meta property="og:image" content="${escapeHtml(post.cover_image_url)}">` : ""}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(post.title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${post.cover_image_url ? `<meta name="twitter:image" content="${escapeHtml(post.cover_image_url)}">` : ""}
  
  <!-- Redirect for humans -->
  <meta http-equiv="refresh" content="0;url=${canonicalUrl}">
  <link rel="canonical" href="${canonicalUrl}">
</head>
<body>
  <p>Redirecting to <a href="${canonicalUrl}">${escapeHtml(post.title)}</a>...</p>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("blog-share error:", err);
    return renderNotFound("", "An error occurred.");
  }
});

function renderNotFound(slug: string, message: string): Response {
  const canonicalUrl = slug ? `${SITE_URL}/blog/${slug}` : `${SITE_URL}/blog`;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Post not found | ClearMarket</title>
  <meta name="description" content="${escapeHtml(message)}">
  
  <!-- OpenGraph -->
  <meta property="og:site_name" content="ClearMarket">
  <meta property="og:title" content="Post not found">
  <meta property="og:description" content="${escapeHtml(message)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonicalUrl}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Post not found">
  <meta name="twitter:description" content="${escapeHtml(message)}">
</head>
<body>
  <h1>Post not found</h1>
  <p>${escapeHtml(message)}</p>
  <p><a href="${SITE_URL}/blog">Browse all posts</a></p>
</body>
</html>`;

  return new Response(html, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
