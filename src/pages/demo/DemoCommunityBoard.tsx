import { useState } from "react";
import { DemoAppShell } from "@/demo/DemoAppShell";
import { useDemoContext } from "@/demo/DemoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ThumbsUp,
  ThumbsDown,
  Flag,
  MessageSquare,
  AlertTriangle,
  Send,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DemoCommunityBoardProps {
  role: "vendor" | "rep";
}

export default function DemoCommunityBoard({ role }: DemoCommunityBoardProps) {
  const { toast } = useToast();
  const { demoPosts, votePost, reportPost } = useDemoContext();
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [newPostContent, setNewPostContent] = useState("");

  const handleVote = (postId: string, voteType: "helpful" | "not_helpful") => {
    votePost(postId, voteType);
    toast({
      title: voteType === "helpful" ? "Marked as Helpful (Demo)" : "Marked as Not Helpful (Demo)",
      description: "Your vote has been recorded. In production, this affects Community Score.",
    });
  };

  const handleReport = (postId: string) => {
    setSelectedPostId(postId);
    setReportDialogOpen(true);
  };

  const submitReport = () => {
    if (selectedPostId) {
      reportPost(selectedPostId);
      toast({
        title: "Reported (Demo)",
        description: "This post has been flagged for moderator review.",
      });
    }
    setReportDialogOpen(false);
    setSelectedPostId(null);
  };

  const handleNewPost = () => {
    if (!newPostContent.trim()) return;
    toast({
      title: "Post Created (Demo)",
      description: "Your post would appear on the Community Board. In demo mode, it won't persist.",
    });
    setNewPostContent("");
  };

  return (
    <DemoAppShell role={role}>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Community Board</h1>
          <p className="text-muted-foreground">
            Connect with the ClearMarket community
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Share with the Community</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="Ask a question, share a tip, or start a discussion..."
              rows={3}
            />
            <div className="flex justify-end">
              <Button onClick={handleNewPost} disabled={!newPostContent.trim()}>
                <Send className="h-4 w-4 mr-2" />
                Post (Demo)
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {demoPosts.map((post) => (
            <Card
              key={post.id}
              className={post.under_review ? "opacity-60" : ""}
            >
              <CardContent className="pt-6">
                {post.under_review && (
                  <div className="flex items-center gap-2 mb-3 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Sent for Moderator Review (Demo)
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{post.author}</span>
                      <Badge variant="outline" className="text-xs">
                        {post.author_role}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{post.date}</p>
                  </div>
                  <Badge variant="secondary">{post.category}</Badge>
                </div>

                <h3 className="font-semibold mb-2">{post.title}</h3>
                <p className="text-muted-foreground">{post.body}</p>

                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVote(post.id, "helpful")}
                      disabled={post.under_review}
                    >
                      <ThumbsUp className="h-4 w-4 mr-1" />
                      {post.helpful_count}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVote(post.id, "not_helpful")}
                      disabled={post.under_review}
                    >
                      <ThumbsDown className="h-4 w-4 mr-1" />
                      {post.not_helpful_count}
                    </Button>
                    <Button variant="ghost" size="sm" disabled={post.under_review}>
                      <MessageSquare className="h-4 w-4 mr-1" />
                      {post.comments_count}
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReport(post.id)}
                    disabled={post.under_review}
                  >
                    <Flag className="h-4 w-4 mr-1" />
                    Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report Post</DialogTitle>
              <DialogDescription>
                Are you sure you want to report this post? It will be sent to moderators for review.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={submitReport}>
                Report Post (Demo)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DemoAppShell>
  );
}
