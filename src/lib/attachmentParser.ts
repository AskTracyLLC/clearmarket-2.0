/**
 * Utility to parse and classify attachment URLs in message text.
 */

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

export interface ParsedAttachment {
  url: string;
  isImage: boolean;
}

/**
 * Check if a URL points to an image file
 */
function isImageUrl(url: string): boolean {
  try {
    const urlLower = url.toLowerCase();
    // Check file extension
    for (const ext of IMAGE_EXTENSIONS) {
      if (urlLower.includes(ext)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a Supabase storage URL
 */
function isSupabaseStorageUrl(url: string): boolean {
  return url.includes("/storage/v1/object/");
}

/**
 * Extract URLs from text
 */
function extractUrls(text: string): string[] {
  // Match URLs starting with http/https
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex) || [];
  return matches;
}

/**
 * Parse message text and extract attachments.
 * Returns the message text (without attachment URLs) and a list of attachments.
 */
export function parseMessageAttachments(body: string): {
  textBeforeAttachments: string;
  attachments: ParsedAttachment[];
} {
  const lines = body.split("\n");
  const attachments: ParsedAttachment[] = [];
  const textLines: string[] = [];
  
  let inAttachmentsSection = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check if we're entering the Attachments section
    if (trimmedLine.toLowerCase().startsWith("attachments:")) {
      inAttachmentsSection = true;
      continue; // Skip the "Attachments:" line itself
    }
    
    // If in attachments section, look for URLs
    if (inAttachmentsSection) {
      // Skip separator lines and empty lines
      if (trimmedLine === "---" || trimmedLine === "") {
        continue;
      }
      
      // Extract URLs from this line (may have bullet prefix like "• ")
      const cleanLine = trimmedLine.replace(/^[•\-*]\s*/, "");
      const urls = extractUrls(cleanLine);
      
      for (const url of urls) {
        const isImage = isImageUrl(url) || (isSupabaseStorageUrl(url) && isImageUrl(url));
        attachments.push({ url, isImage });
      }
      
      // If no URL found on this line but it's not empty, it might be end of attachments section
      if (urls.length === 0 && trimmedLine.length > 0) {
        inAttachmentsSection = false;
        textLines.push(line);
      }
    } else {
      // Check for inline Supabase storage URLs that are images
      const urls = extractUrls(line);
      let lineHasInlineAttachment = false;
      
      for (const url of urls) {
        if (isSupabaseStorageUrl(url) && isImageUrl(url)) {
          attachments.push({ url, isImage: true });
          lineHasInlineAttachment = true;
        }
      }
      
      // If this line contains only an attachment URL, don't include it in text
      if (!lineHasInlineAttachment) {
        textLines.push(line);
      } else {
        // Remove the URL from the line and keep the rest
        let modifiedLine = line;
        for (const url of urls) {
          if (isSupabaseStorageUrl(url) && isImageUrl(url)) {
            modifiedLine = modifiedLine.replace(url, "").trim();
          }
        }
        if (modifiedLine.length > 0) {
          textLines.push(modifiedLine);
        }
      }
    }
  }
  
  // Clean up text: remove trailing "---" separator and empty lines at the end
  let textBeforeAttachments = textLines.join("\n").trim();
  
  // Remove trailing separator that often precedes Attachments
  if (textBeforeAttachments.endsWith("---")) {
    textBeforeAttachments = textBeforeAttachments.slice(0, -3).trim();
  }
  
  return {
    textBeforeAttachments,
    attachments,
  };
}
