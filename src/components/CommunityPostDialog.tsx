import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { 
  createCommunityPost, 
  updateCommunityPost, 
  getCategoriesForChannel,
  CommunityPost,
  CommunityChannel,
} from "@/lib/community";
import { CommunityImageUpload, UploadedImage } from "@/components/CommunityImageUpload";
import { supabase } from "@/integrations/supabase/client";
import { checklist } from "@/lib/checklistTracking";
import { communityCopy } from "@/copy/communityCopy";

interface CommunityPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  channel?: CommunityChannel;
  existingPost?: CommunityPost | null;
  onSuccess?: () => void;
}

export function CommunityPostDialog({
  open,
  onOpenChange,
  userId,
  channel = "community",
  existingPost,
  onSuccess,
}: CommunityPostDialogProps) {
  const { toast } = useToast();
  
  // When editing, use the post's channel; otherwise use the prop
  const effectiveChannel = existingPost?.channel as CommunityChannel || channel;
  const categories = getCategoriesForChannel(effectiveChannel);
  
  const [category, setCategory] = useState(existingPost?.category || categories[0]?.value || "question");
  const [title, setTitle] = useState(existingPost?.title || "");
  const [body, setBody] = useState(existingPost?.body || "");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEditing = !!existingPost;

  // Load existing images when editing
  useEffect(() => {
    if (existingPost?.image_urls && existingPost.image_urls.length > 0) {
      setImages(
        existingPost.image_urls.map((url, index) => ({
          id: `existing-${index}`,
          url,
        }))
      );
    } else {
      setImages([]);
    }
  }, [existingPost]);

  // Reset category when channel changes (only for new posts)
  useEffect(() => {
    if (!existingPost) {
      setCategory(categories[0]?.value || "question");
    }
  }, [effectiveChannel, categories, existingPost]);

  const getDialogTitle = () => {
    if (isEditing) return "Edit Post";
    switch (channel) {
      case "community":
        return "New Community Post";
      case "network":
        return "New Network Alert";
      case "announcements":
        return "New Announcement";
      default:
        return "New Post";
    }
  };

  const getDialogDescription = () => {
    if (isEditing) return "Update your post details below.";
    switch (channel) {
      case "community":
        return "Share a question, discussion topic, or safety information with the community.";
      case "network":
        return "Send an alert to your network about availability, schedule changes, or important updates.";
      case "announcements":
        return "Post an official ClearMarket announcement for all users.";
      default:
        return "Share something with the community.";
    }
  };

  // Check if any images are still uploading
  const hasUploadingImages = images.some((img) => img.isUploading);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: communityCopy.postForm.titleLabel + " required",
        description: "Please enter a title for your post.",
        variant: "destructive",
      });
      return;
    }

    if (!body.trim()) {
      toast({
        title: communityCopy.postForm.contentLabel + " required",
        description: "Please enter the content of your post.",
        variant: "destructive",
      });
      return;
    }

    if (hasUploadingImages) {
      toast({
        title: "Please wait",
        description: "Images are still uploading.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    // Get final image URLs (exclude any still uploading)
    const imageUrls = images.filter((img) => !img.isUploading).map((img) => img.url);

    if (isEditing) {
      const result = await updateCommunityPost(existingPost.id, {
        category,
        title: title.trim(),
        body: body.trim(),
        image_urls: imageUrls,
      });

      if (result.success) {
        toast({ title: communityCopy.postForm.successToast });
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast({
          title: "Error",
          description: result.error || communityCopy.postForm.errorToast,
          variant: "destructive",
        });
      }
    } else {
      const result = await createCommunityPost(userId, category, title.trim(), body.trim(), channel, imageUrls);

      if (result.success) {
        toast({ title: communityCopy.postForm.successToast });
        setTitle("");
        setBody("");
        setImages([]);
        setCategory(categories[0]?.value || "question");
        onOpenChange(false);
        onSuccess?.();
        
        // Track checklist event for first community post
        if (channel === "community") {
          checklist.firstCommunityPost(userId);
        }
      } else {
        toast({
          title: "Error",
          description: result.error || communityCopy.postForm.errorToast,
          variant: "destructive",
        });
      }
    }

    setSubmitting(false);
  };

  // Handle paste on textarea to support image paste
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
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

      // If images found, we don't prevent default to allow text paste to still work
      // The CommunityImageUpload component handles the actual upload
      if (imageFiles.length > 0) {
        e.preventDefault();
        // Trigger upload via the image upload component
        const MAX_FILE_SIZE = 5 * 1024 * 1024;
        const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif"];
        const MAX_IMAGES = 5;

        const remainingSlots = MAX_IMAGES - images.length;
        if (imageFiles.length > remainingSlots) {
          toast({
            title: "Too many images",
            description: `You can add up to ${MAX_IMAGES} images per post.`,
            variant: "destructive",
          });
          return;
        }

        // Validate files
        for (const file of imageFiles) {
          if (!ALLOWED_TYPES.includes(file.type)) {
            toast({
              title: "Invalid file type",
              description: "Images must be PNG, JPG, or GIF format.",
              variant: "destructive",
            });
            return;
          }
          if (file.size > MAX_FILE_SIZE) {
            toast({
              title: "File too large",
              description: "That file is too large. Images must be under 5 MB.",
              variant: "destructive",
            });
            return;
          }
        }

        // Create placeholders and start uploads
        const newImages: UploadedImage[] = imageFiles.map((file) => ({
          id: `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          url: URL.createObjectURL(file),
          file,
          isUploading: true,
        }));

        setImages((prev) => [...prev, ...newImages]);

        // Upload files
        for (const img of newImages) {
          if (!img.file) continue;

          const fileExt = img.file.name.split(".").pop()?.toLowerCase() || "png";
          const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error } = await supabase.storage
            .from("community-post-images")
            .upload(fileName, img.file, { cacheControl: "3600", upsert: false });

          if (error) {
            toast({
              title: "Upload failed",
              description: "Could not upload the image. Please try again.",
              variant: "destructive",
            });
            setImages((prev) => prev.filter((i) => i.id !== img.id));
            continue;
          }

          const { data: urlData } = supabase.storage
            .from("community-post-images")
            .getPublicUrl(fileName);

          setImages((prev) =>
            prev.map((i) =>
              i.id === img.id
                ? { ...i, url: urlData.publicUrl, isUploading: false, file: undefined }
                : i
            )
          );
        }
      }
    },
    [images, userId, toast]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>{getDialogDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <RadioGroup value={category} onValueChange={setCategory} className="flex flex-wrap gap-4">
              {categories.map((cat) => (
                <div key={cat.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={cat.value} id={cat.value} />
                  <Label htmlFor={cat.value} className="cursor-pointer">
                    {cat.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">{communityCopy.postForm.titleLabel}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={communityCopy.postForm.titlePlaceholder}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">{communityCopy.postForm.contentLabel}</Label>
            <Textarea
              ref={textareaRef}
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onPaste={handlePaste}
              placeholder={communityCopy.postForm.contentPlaceholder}
              rows={6}
              maxLength={5000}
            />
          </div>

          {/* Image upload section */}
          <CommunityImageUpload
            userId={userId}
            images={images}
            onChange={setImages}
            disabled={submitting}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {communityCopy.postForm.cancelButton}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : isEditing ? "Save Changes" : communityCopy.postForm.submitButton}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
