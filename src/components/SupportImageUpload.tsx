import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SupportImageUploadProps {
  userId: string;
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  maxSizeMB?: number;
}

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif"];

export function SupportImageUpload({
  userId,
  images,
  onImagesChange,
  maxImages = 5,
  maxSizeMB = 5,
}: SupportImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return "Images must be PNG, JPG, or GIF format.";
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        return `That file is too large. Images must be under ${maxSizeMB} MB.`;
      }
      return null;
    },
    [maxSizeMB]
  );

  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("support-attachments")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from("support-attachments")
        .getPublicUrl(fileName);

      return urlData?.publicUrl || null;
    },
    [userId]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const remainingSlots = maxImages - images.length;

      if (remainingSlots <= 0) {
        toast({
          title: "Maximum images reached",
          description: `You can attach up to ${maxImages} images per request.`,
          variant: "destructive",
        });
        return;
      }

      const filesToUpload = fileArray.slice(0, remainingSlots);

      // Validate all files first
      for (const file of filesToUpload) {
        const error = validateFile(file);
        if (error) {
          toast({ title: "Invalid file", description: error, variant: "destructive" });
          return;
        }
      }

      setUploading(true);
      const newUrls: string[] = [];

      for (const file of filesToUpload) {
        const url = await uploadFile(file);
        if (url) {
          newUrls.push(url);
        } else {
          toast({
            title: "Upload failed",
            description: "One or more images failed to upload. Please try again.",
            variant: "destructive",
          });
        }
      }

      if (newUrls.length > 0) {
        onImagesChange([...images, ...newUrls]);
      }

      setUploading(false);
    },
    [images, maxImages, onImagesChange, toast, uploadFile, validateFile]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        handleFiles(imageFiles);
      }
    },
    [handleFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        e.target.value = "";
      }
    },
    [handleFiles]
  );

  const removeImage = useCallback(
    (index: number) => {
      const newImages = images.filter((_, i) => i !== index);
      onImagesChange(newImages);
    },
    [images, onImagesChange]
  );

  return (
    <div className="space-y-3" onPaste={handlePaste}>
      {/* Image thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Attachment ${index + 1}`}
                className="w-16 h-16 object-cover rounded-md border border-border"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button and helper text */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || images.length >= maxImages}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4 mr-2" />
          )}
          {uploading ? "Uploading..." : "Add screenshot"}
        </Button>
        <span className="text-xs text-muted-foreground">
          You can also paste screenshots directly.
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {images.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {images.length} of {maxImages} images attached
        </p>
      )}
    </div>
  );
}
