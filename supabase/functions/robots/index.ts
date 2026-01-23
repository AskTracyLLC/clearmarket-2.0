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

  const robotsTxt = `# ClearMarket Robots.txt
# https://useclearmarket.io

User-agent: *
Allow: /
Allow: /blog
Allow: /blog/*
Allow: /help
Allow: /help/*
Allow: /terms
Allow: /privacy

# Block private/admin routes
Disallow: /admin/
Disallow: /admin/*
Disallow: /auth/
Disallow: /auth/*
Disallow: /dashboard
Disallow: /dashboard/*
Disallow: /settings
Disallow: /settings/*
Disallow: /messages
Disallow: /messages/*
Disallow: /notifications
Disallow: /notifications/*
Disallow: /rep/
Disallow: /vendor/
Disallow: /ops/
Disallow: /work-setup
Disallow: /community
Disallow: /coverage-map
Disallow: /safety
Disallow: /support
Disallow: /tools

# Sitemap location
Sitemap: ${SITE_URL}/sitemap.xml
`;

  return new Response(robotsTxt, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
});
