import { supabase } from "@/integrations/supabase/client";
import { getPublicShareUrl } from "@/lib/publicUrl";

/**
 * Generate a random URL-safe slug for reputation share links
 */
function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 10; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

// Re-export for backward compatibility
export { getPublicShareUrl };

/**
 * Create a new reputation share link for the current user
 */
export async function createShareLink(roleType: 'rep' | 'vendor') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const slug = generateSlug();

  const { data, error } = await supabase
    .from('reputation_share_links')
    .insert({
      user_id: user.id,
      role_type: roleType,
      slug,
      is_enabled: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get the user's current share link (if any)
 */
export async function getMyShareLink(roleType: 'rep' | 'vendor') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('reputation_share_links')
    .select('*')
    .eq('user_id', user.id)
    .eq('role_type', roleType)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Toggle the enabled state of a share link
 */
export async function toggleShareLinkEnabled(linkId: string, isEnabled: boolean) {
  const { error } = await supabase
    .from('reputation_share_links')
    .update({ is_enabled: isEnabled })
    .eq('id', linkId);

  if (error) throw error;
}

/**
 * Delete a share link
 */
export async function deleteShareLink(linkId: string) {
  const { error } = await supabase
    .from('reputation_share_links')
    .delete()
    .eq('id', linkId);

  if (error) throw error;
}

/**
 * Fetch public reputation snapshot from edge function
 * This uses a direct fetch without auth headers for public access
 */
export async function fetchPublicSnapshot(slug: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const response = await fetch(
    `${supabaseUrl}/functions/v1/get_public_reputation_snapshot`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
      },
      body: JSON.stringify({ slug }),
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'Failed to load snapshot' }));
    throw errData;
  }

  return response.json();
}

/**
 * Fetch public profile share data (for /share/rep/:slug and /share/vendor/:slug)
 * This uses a direct fetch without auth headers for public access
 */
export async function fetchPublicProfileShare(slug: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const response = await fetch(
    `${supabaseUrl}/functions/v1/public-profile-share?slug=${slug}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
      },
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'Failed to load profile' }));
    throw new Error(errData.error || 'Failed to load profile');
  }

  return response.json();
}