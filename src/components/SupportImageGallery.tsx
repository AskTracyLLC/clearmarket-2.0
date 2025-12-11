import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface SupportImageGalleryProps {
  images: string[];
}

export function SupportImageGallery({ images }: SupportImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!images || images.length === 0) return null;

  const openLightbox = (url: string) => {
    setSelectedImage(url);
    setLightboxOpen(true);
  };

  // Single image: full width with contain
  if (images.length === 1) {
    return (
      <>
        <div className="mt-3 flex justify-center rounded-lg overflow-hidden bg-muted/30 border border-border">
          <img
            src={images[0]}
            alt="Attachment"
            className="max-w-full max-h-[450px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => openLightbox(images[0])}
          />
        </div>

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
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Multiple images: grid with contain
  return (
    <>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {images.map((url, index) => (
          <div
            key={index}
            className="relative cursor-pointer overflow-hidden rounded-md border border-border bg-muted/30 flex justify-center items-center h-[150px]"
            onClick={() => openLightbox(url)}
          >
            <img
              src={url}
              alt={`Attachment ${index + 1}`}
              className="max-w-full max-h-full object-contain hover:opacity-90 transition-opacity"
            />
          </div>
        ))}
      </div>

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
        </DialogContent>
      </Dialog>
    </>
  );
}
