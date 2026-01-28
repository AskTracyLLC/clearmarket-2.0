import { useState } from "react";
import { parseMessageAttachments, ParsedAttachment } from "@/lib/attachmentParser";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, ExternalLink } from "lucide-react";

interface MessageBodyRendererProps {
  body: string;
  isOutgoing?: boolean;
}

/**
 * Renders message body with inline image previews for attachments.
 * Detects attachment URLs and renders them as clickable thumbnails.
 */
export function MessageBodyRenderer({ body, isOutgoing }: MessageBodyRendererProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const { textBeforeAttachments, attachments } = parseMessageAttachments(body);
  
  const imageAttachments = attachments.filter((a) => a.isImage);
  const linkAttachments = attachments.filter((a) => !a.isImage);
  
  const openLightbox = (url: string) => {
    setSelectedImage(url);
    setLightboxOpen(true);
  };
  
  const openInNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };
  
  return (
    <div className="space-y-2">
      {/* Message text */}
      {textBeforeAttachments && (
        <p className="text-sm whitespace-pre-wrap">{textBeforeAttachments}</p>
      )}
      
      {/* Image attachments - thumbnail grid */}
      {imageAttachments.length > 0 && (
        <div className={`${imageAttachments.length === 1 ? "" : "grid grid-cols-2 gap-2"} mt-2`}>
          {imageAttachments.map((attachment, index) => (
            <div
              key={index}
              className="relative group cursor-pointer overflow-hidden rounded-md border border-border bg-muted/30"
              onClick={() => openLightbox(attachment.url)}
            >
              <img
                src={attachment.url}
                alt={`Attachment ${index + 1}`}
                className="max-h-[240px] w-full object-contain hover:opacity-90 transition-opacity"
                loading="lazy"
              />
              {/* Hover overlay with open in new tab button */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openInNewTab(attachment.url);
                  }}
                  className="bg-black/60 text-white rounded-full p-2 hover:bg-black/80 transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Non-image attachments as links */}
      {linkAttachments.length > 0 && (
        <div className="mt-2 space-y-1">
          {linkAttachments.map((attachment, index) => (
            <a
              key={index}
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`block text-sm truncate max-w-full underline ${
                isOutgoing ? "text-primary-foreground/80 hover:text-primary-foreground" : "text-blue-400 hover:text-blue-300"
              }`}
              title={attachment.url}
            >
              {truncateUrl(attachment.url)}
            </a>
          ))}
        </div>
      )}
      
      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-50 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          {selectedImage && (
            <div className="flex items-center justify-center min-h-[50vh] p-4">
              <img
                src={selectedImage}
                alt="Full size"
                className="max-w-full max-h-[80vh] object-contain rounded"
              />
            </div>
          )}
          {/* Open in new tab button in lightbox */}
          {selectedImage && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
              <button
                onClick={() => openInNewTab(selectedImage)}
                className="bg-white/10 text-white rounded-full px-4 py-2 hover:bg-white/20 transition-colors flex items-center gap-2 text-sm"
              >
                <ExternalLink className="h-4 w-4" />
                Open in new tab
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Truncate URL for display
 */
function truncateUrl(url: string, maxLength: number = 60): string {
  if (url.length <= maxLength) return url;
  
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const filename = path.split("/").pop() || "";
    
    if (filename.length > 30) {
      return `...${filename.slice(-30)}`;
    }
    
    return `${urlObj.host}/.../${filename}`;
  } catch {
    return url.slice(0, maxLength - 3) + "...";
  }
}
