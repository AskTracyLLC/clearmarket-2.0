import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CommunityImageGalleryProps {
  images: string[];
}

export function CommunityImageGallery({ images }: CommunityImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Single image: full width
  if (images.length === 1) {
    return (
      <>
        <div className="mt-3">
          <img
            src={images[0]}
            alt="Post attachment"
            className="w-full max-h-96 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => openLightbox(0)}
          />
        </div>
        <ImageLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          images={images}
          currentIndex={currentIndex}
          onNext={goNext}
          onPrev={goPrev}
        />
      </>
    );
  }

  // 2-4 images: grid layout
  return (
    <>
      <div
        className={`mt-3 grid gap-2 ${
          images.length === 2
            ? "grid-cols-2"
            : images.length === 3
            ? "grid-cols-2"
            : "grid-cols-2"
        }`}
      >
        {images.slice(0, 4).map((url, index) => (
          <div
            key={index}
            className={`relative ${
              images.length === 3 && index === 0 ? "row-span-2" : ""
            }`}
          >
            <img
              src={url}
              alt={`Post attachment ${index + 1}`}
              className={`w-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${
                images.length === 3 && index === 0 ? "h-full" : "h-40"
              }`}
              onClick={() => openLightbox(index)}
            />
            {/* Show "+N more" on last visible image if there are more */}
            {index === 3 && images.length > 4 && (
              <div
                className="absolute inset-0 bg-background/70 rounded-lg flex items-center justify-center cursor-pointer"
                onClick={() => openLightbox(3)}
              >
                <span className="text-lg font-semibold text-foreground">
                  +{images.length - 4} more
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      <ImageLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        images={images}
        currentIndex={currentIndex}
        onNext={goNext}
        onPrev={goPrev}
      />
    </>
  );
}

interface ImageLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: string[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
}

function ImageLightbox({
  open,
  onOpenChange,
  images,
  currentIndex,
  onNext,
  onPrev,
}: ImageLightboxProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") onNext();
    if (e.key === "ArrowLeft") onPrev();
    if (e.key === "Escape") onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[90vw] max-h-[90vh] p-0 bg-background/95 backdrop-blur-sm border-none"
        onKeyDown={handleKeyDown}
      >
        <div className="relative flex items-center justify-center min-h-[50vh]">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-5 h-5" />
          </Button>

          {/* Navigation buttons */}
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
                onClick={onPrev}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10"
                onClick={onNext}
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </>
          )}

          {/* Image */}
          <img
            src={images[currentIndex]}
            alt={`Image ${currentIndex + 1} of ${images.length}`}
            className="max-w-full max-h-[85vh] object-contain"
          />

          {/* Counter */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 px-3 py-1 rounded-full text-sm text-foreground">
              {currentIndex + 1} / {images.length}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
