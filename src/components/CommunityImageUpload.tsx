import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ImagePlus, X, Loader2 } from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGES = 5;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif"];

interface UploadedImage {
  id: string;
  url: string;
  file?: File;
  isUploading?: boolean;
}

interface CommunityImageUploadProps {
  userId: string;
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  disabled?: boolean;
}

export function CommunityImageUpload({
  userId,
  images,
  onChange,
  disabled = false,
}: CommunityImageUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Images must be PNG, JPG, or GIF format.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "That file is too large. Images must be under 5 MB.";
    }
    return null;
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error } = await supabase.storage
      .from("community-post-images")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("community-post-images")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const remainingSlots = MAX_IMAGES - images.length;

      if (fileArray.length > remainingSlots) {
        toast({
          title: "Too many images",
          description: `You can add up to ${MAX_IMAGES} images per post. ${remainingSlots} slot${remainingSlots === 1 ? "" : "s"} remaining.`,
          variant: "destructive",
        });
        return;
      }

      // Validate all files first
      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          toast({ title: "Invalid file", description: error, variant: "destructive" });
          return;
        }
      }

      // Create placeholder entries
      const newImages: UploadedImage[] = fileArray.map((file) => ({
        id: `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        url: URL.createObjectURL(file),
        file,
        isUploading: true,
      }));

      onChange([...images, ...newImages]);
      setUploadingCount((c) => c + fileArray.length);

      // Upload each file and track results
      const uploadResults: { id: string; url: string }[] = [];
      for (const img of newImages) {
        if (!img.file) continue;

        const publicUrl = await uploadImage(img.file);
        if (publicUrl) {
          uploadResults.push({ id: img.id, url: publicUrl });
        } else {
          toast({
            title: "Upload failed",
            description: "Could not upload one of the images. Please try again.",
            variant: "destructive",
          });
        }
      }

      // Build the final updated list
      const currentImages = [...images, ...newImages];
      const finalImages = currentImages.map((img) => {
        const uploaded = uploadResults.find((u) => u.id === img.id);
        return uploaded
          ? { ...img, url: uploaded.url, isUploading: false, file: undefined }
          : img;
      }).filter((img) => !img.isUploading || uploadResults.some((u) => u.id === img.id));

      onChange(finalImages);
      setUploadingCount(0);
    },
    [images, onChange, toast, userId]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (disabled) return;

      const items = e.clipboardData.items;
      const imageFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        handleFiles(imageFiles);
      }
    },
    [disabled, handleFiles]
  );

  const removeImage = (id: string) => {
    onChange(images.filter((img) => img.id !== id));
  };

  const isAtLimit = images.length >= MAX_IMAGES;

  return (
    <div className="space-y-3">
      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative w-20 h-20 rounded-md overflow-hidden border border-border bg-muted"
            >
              <img
                src={img.url}
                alt="Upload preview"
                className="w-full h-full object-cover"
              />
              {img.isUploading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              )}
              {!img.isUploading && !disabled && (
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-background/90 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  aria-label="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add image button and helper text */}
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isAtLimit}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isAtLimit || uploadingCount > 0}
        >
          <ImagePlus className="w-4 h-4 mr-2" />
          Add image
        </Button>
        <span className="text-xs text-muted-foreground">
          {isAtLimit
            ? `Maximum ${MAX_IMAGES} images reached`
            : "You can also paste screenshots directly into your post."}
        </span>
      </div>

      {/* Hidden paste target - we'll attach to textarea instead */}
    </div>
  );
}

export { type UploadedImage };
