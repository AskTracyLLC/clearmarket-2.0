import { supabase } from "@/integrations/supabase/client";

/**
 * Generate a signed URL for viewing a background check screenshot
 * stored in the private background-checks bucket.
 * 
 * @param path - The storage path to the file (e.g., "user-id/filename.png")
 * @param expiresInSeconds - How long the signed URL should be valid (default: 5 minutes)
 * @returns The signed URL or null if generation fails
 */
export async function getBackgroundCheckSignedUrl(
  path: string,
  expiresInSeconds: number = 300
): Promise<string | null> {
  if (!path) return null;

  // Extract just the filename from the full URL if needed
  const filename = path.includes('/') ? path.split('/').pop()! : path;

  const { data, error } = await supabase.storage
    .from("background-checks")
    .createSignedUrl(filename, expiresInSeconds);

  if (error) {
    console.error("Error creating signed URL for background check:", error);
    return null;
  }

  return data?.signedUrl ?? null;
}
