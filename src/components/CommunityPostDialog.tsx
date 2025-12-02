import { useState } from "react";
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
import { createCommunityPost, updateCommunityPost, POST_CATEGORIES, CommunityPost } from "@/lib/community";

interface CommunityPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  existingPost?: CommunityPost | null;
  onSuccess?: () => void;
}

export function CommunityPostDialog({
  open,
  onOpenChange,
  userId,
  existingPost,
  onSuccess,
}: CommunityPostDialogProps) {
  const { toast } = useToast();
  const [category, setCategory] = useState(existingPost?.category || "question");
  const [title, setTitle] = useState(existingPost?.title || "");
  const [body, setBody] = useState(existingPost?.body || "");
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!existingPost;

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your post.",
        variant: "destructive",
      });
      return;
    }

    if (!body.trim()) {
      toast({
        title: "Body required",
        description: "Please enter the content of your post.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    if (isEditing) {
      const result = await updateCommunityPost(existingPost.id, {
        category,
        title: title.trim(),
        body: body.trim(),
      });

      if (result.success) {
        toast({ title: "Post updated" });
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update post",
          variant: "destructive",
        });
      }
    } else {
      const result = await createCommunityPost(userId, category, title.trim(), body.trim());

      if (result.success) {
        toast({ title: "Post created" });
        setTitle("");
        setBody("");
        setCategory("question");
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create post",
          variant: "destructive",
        });
      }
    }

    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Post" : "New Community Post"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your post details below."
              : "Share a question, experience, warning, or helpful info with the community."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <RadioGroup value={category} onValueChange={setCategory} className="flex flex-wrap gap-4">
              {POST_CATEGORIES.map((cat) => (
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
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's your post about?"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Content</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your thoughts, questions, or experiences..."
              rows={6}
              maxLength={5000}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : isEditing ? "Save Changes" : "Create Post"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
