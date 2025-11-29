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

  // Extract the path within the bucket from full URL if needed
  // Full URL format: https://xxx.supabase.co/storage/v1/object/public/background-checks/user-id/file.png
  // We need: user-id/file.png
  let filePath = path;
  if (path.includes('/background-checks/')) {
    filePath = path.split('/background-checks/')[1];
  }

  const { data, error } = await supabase.storage
    .from("background-checks")
    .createSignedUrl(filePath, expiresInSeconds);

  if (error) {
    console.error("Error creating signed URL for background check:", error);
    return null;
  }

  return data?.signedUrl ?? null;
}
