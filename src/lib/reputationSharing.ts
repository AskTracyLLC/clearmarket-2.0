import { supabase } from "@/integrations/supabase/client";

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
 */
export async function fetchPublicSnapshot(slug: string) {
  const { data, error } = await supabase.functions.invoke('get_public_reputation_snapshot', {
    body: { slug }
  });

  if (error) throw error;
  return data;
}