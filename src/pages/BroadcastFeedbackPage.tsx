import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Broadcast {
  id: string;
  title: string;
  message_md: string;
  cta_label: string;
  status: string;
}

interface Recipient {
  id: string;
  broadcast_id: string;
  user_id: string;
  opened_at: string | null;
  responded_at: string | null;
}

interface ExistingFeedback {
  id: string;
  rating: number;
  like_text: string | null;
  dislike_text: string | null;
  suggestion_text: string | null;
  allow_spotlight: boolean;
  allow_name: boolean;
}

export default function BroadcastFeedbackPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [existingFeedback, setExistingFeedback] = useState<ExistingFeedback | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [likeText, setLikeText] = useState("");
  const [dislikeText, setDislikeText] = useState("");
  const [suggestionText, setSuggestionText] = useState("");
  const [allowSpotlight, setAllowSpotlight] = useState(false);
  const [allowName, setAllowName] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && user && id) {
      loadData();
    }
  }, [authLoading, user, id]);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch broadcast
      const { data: broadcastData, error: broadcastError } = await supabase
        .from("admin_broadcasts")
        .select("id, title, message_md, cta_label, status")
        .eq("id", id)
        .maybeSingle();

      if (broadcastError) throw broadcastError;
      setBroadcast(broadcastData);

      if (!broadcastData) {
        setLoading(false);
        return;
      }

      // Fetch recipient row for current user
      const { data: recipientData, error: recipientError } = await supabase
        .from("admin_broadcast_recipients")
        .select("id, broadcast_id, user_id, opened_at, responded_at")
        .eq("broadcast_id", id)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (recipientError) throw recipientError;
      setRecipient(recipientData);

      if (recipientData) {
        // Mark as opened if not already
        if (!recipientData.opened_at) {
          await supabase
            .from("admin_broadcast_recipients")
            .update({ opened_at: new Date().toISOString() })
            .eq("id", recipientData.id);
        }

        // Check for existing feedback
        const { data: feedbackData } = await supabase
          .from("admin_broadcast_feedback")
          .select("id, rating, like_text, dislike_text, suggestion_text, allow_spotlight, allow_name")
          .eq("recipient_id", recipientData.id)
          .maybeSingle();

        if (feedbackData) {
          setExistingFeedback(feedbackData);
          setRating(feedbackData.rating);
          setLikeText(feedbackData.like_text || "");
          setDislikeText(feedbackData.dislike_text || "");
          setSuggestionText(feedbackData.suggestion_text || "");
          setAllowSpotlight(feedbackData.allow_spotlight);
          setAllowName(feedbackData.allow_name);
          setSubmitted(true);
        }
      }
    } catch (error) {
      console.error("Error loading feedback page:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "Rating required",
        description: "Please select a star rating.",
        variant: "destructive",
      });
      return;
    }

    if (!recipient) return;

    setSaving(true);
    try {
      if (existingFeedback) {
        // Update existing feedback
        const { error } = await supabase
          .from("admin_broadcast_feedback")
          .update({
            rating,
            like_text: likeText.trim() || null,
            dislike_text: dislikeText.trim() || null,
            suggestion_text: suggestionText.trim() || null,
            allow_spotlight: allowSpotlight,
            allow_name: allowSpotlight ? allowName : false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingFeedback.id);

        if (error) throw error;
      } else {
        // Insert new feedback
        const { error } = await supabase.from("admin_broadcast_feedback").insert({
          recipient_id: recipient.id,
          user_id: user!.id,
          rating,
          like_text: likeText.trim() || null,
          dislike_text: dislikeText.trim() || null,
          suggestion_text: suggestionText.trim() || null,
          allow_spotlight: allowSpotlight,
          allow_name: allowSpotlight ? allowName : false,
        });

        if (error) throw error;
      }

      // Mark notification as read if exists
      await supabase
        .from("notifications")
        .update({ 
          is_read: true, 
          status: "read",
          read_at: new Date().toISOString()
        })
        .eq("type", "admin_broadcast")
        .eq("ref_id", id)
        .eq("user_id", user!.id);

      setSubmitted(true);
      toast({ title: "Thanks — your feedback was sent!" });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Error submitting feedback",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-xl">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-xl">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please sign in to continue.</p>
            <Button className="mt-4" onClick={() => navigate("/signin")}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!broadcast || !recipient) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-xl">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              This feedback request is not available for your account.
            </p>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state after submitting
  if (submitted && !existingFeedback) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-xl">
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-semibold mb-2">Thank you!</h2>
            <p className="text-muted-foreground mb-6">
              Your feedback helps us improve ClearMarket.
            </p>
            <Button onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-xl">
      <Button variant="ghost" className="mb-4" onClick={() => navigate("/dashboard")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{broadcast.title}</CardTitle>
          <CardDescription className="whitespace-pre-wrap">
            {broadcast.message_md}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Star Rating */}
          <div className="space-y-2">
            <Label>How would you rate ClearMarket? *</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      star <= (hoverRating || rating)
                        ? "text-amber-400 fill-amber-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Like text */}
          <div className="space-y-2">
            <Label htmlFor="like_text">What are you liking?</Label>
            <Textarea
              id="like_text"
              placeholder="Tell us what's working well..."
              value={likeText}
              onChange={(e) => setLikeText(e.target.value)}
              rows={3}
            />
          </div>

          {/* Dislike text */}
          <div className="space-y-2">
            <Label htmlFor="dislike_text">What are you disliking?</Label>
            <Textarea
              id="dislike_text"
              placeholder="Tell us what could be better..."
              value={dislikeText}
              onChange={(e) => setDislikeText(e.target.value)}
              rows={3}
            />
          </div>

          {/* Suggestion text */}
          <div className="space-y-2">
            <Label htmlFor="suggestion_text">What should we add or fix next?</Label>
            <Textarea
              id="suggestion_text"
              placeholder="Share your ideas..."
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              rows={3}
            />
          </div>

          {/* Spotlight checkboxes */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="allow_spotlight"
                checked={allowSpotlight}
                onCheckedChange={(checked) => {
                  setAllowSpotlight(!!checked);
                  if (!checked) setAllowName(false);
                }}
              />
              <div className="space-y-1">
                <Label htmlFor="allow_spotlight" className="font-normal cursor-pointer">
                  You may spotlight my feedback in marketing
                </Label>
                <p className="text-xs text-muted-foreground">
                  We may quote your feedback on our website or materials.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 ml-6">
              <Checkbox
                id="allow_name"
                checked={allowName}
                onCheckedChange={(checked) => setAllowName(!!checked)}
                disabled={!allowSpotlight}
              />
              <div className="space-y-1">
                <Label
                  htmlFor="allow_name"
                  className={`font-normal cursor-pointer ${!allowSpotlight ? "text-muted-foreground" : ""}`}
                >
                  You may include my name
                </Label>
                <p className="text-xs text-muted-foreground">
                  Otherwise we'll display as "Anonymous Field Rep" or "Anonymous Vendor".
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving || rating === 0} className="flex-1">
              {saving ? "Submitting..." : existingFeedback ? "Update Feedback" : "Submit Feedback"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
