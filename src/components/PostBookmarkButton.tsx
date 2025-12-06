import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bookmark } from "lucide-react";
import { isPostSaved, savePost, unsavePost } from "@/lib/postSaves";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  postId: string;
  userId: string;
  initialSaved?: boolean;
  onToggle?: (saved: boolean) => void;
  size?: "sm" | "default";
}

export function PostBookmarkButton({ postId, userId, initialSaved, onToggle, size = "sm" }: Props) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(initialSaved ?? false);
  const [loading, setLoading] = useState(initialSaved === undefined);

  useEffect(() => {
    if (initialSaved === undefined) {
      checkSaveStatus();
    }
  }, [postId, userId, initialSaved]);

  const checkSaveStatus = async () => {
    const isSaved = await isPostSaved(userId, postId);
    setSaved(isSaved);
    setLoading(false);
  };

  const handleToggle = async () => {
    setLoading(true);
    
    if (saved) {
      const { success } = await unsavePost(userId, postId);
      if (success) {
        setSaved(false);
        toast({ title: "Post removed from saved" });
        onToggle?.(false);
      } else {
        toast({ title: "Failed to unsave post", variant: "destructive" });
      }
    } else {
      const { success } = await savePost(userId, postId);
      if (success) {
        setSaved(true);
        toast({ title: "Post saved" });
        onToggle?.(true);
      } else {
        toast({ title: "Failed to save post", variant: "destructive" });
      }
    }
    
    setLoading(false);
  };

  return (
    <Button
      variant="ghost"
      size={size === "sm" ? "icon" : "default"}
      className={cn(
        "h-8 w-8",
        saved && "text-primary"
      )}
      onClick={handleToggle}
      disabled={loading}
      title={saved ? "Remove from saved" : "Save post"}
    >
      <Bookmark 
        className={cn(
          "w-4 h-4",
          saved && "fill-current"
        )} 
      />
    </Button>
  );
}