import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquare, UserPlus, Star, Settings, Briefcase, Users, CheckCircle, ClipboardCheck, Megaphone } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ReviewDialog } from "@/components/ReviewDialog";

interface Notification {
  id: string;
  created_at: string;
  type: "message" | "connection_request" | "review" | "review_reminder" | "new_coverage_opportunity" | "community_comment_on_post" | "community_post_resolved" | "vendor_network_alert" | "vendor_alert";
  ref_id: string | null;
  title: string;
  body: string | null;
  is_read: boolean;
}

export default function Notifications() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);
  
  // Review dialog state for review_reminder deep-linking
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewTargetUserId, setReviewTargetUserId] = useState<string | null>(null);
  const [reviewRepInterestId, setReviewRepInterestId] = useState<string | null>(null);
  const [reviewDirection, setReviewDirection] = useState<"vendor_to_rep" | "rep_to_vendor" | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/signin");
      return;
    }

    loadNotifications();
  }, [user, authLoading, navigate]);

  async function loadNotifications() {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setNotifications((data || []) as Notification[]);

      // Mark all as read after loading
      if (data && data.some(n => !n.is_read)) {
        await markAllAsRead();
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
      toast({
        title: "Error",
        description: "Failed to load notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function markAllAsRead() {
    if (!user || markingRead) return;

    setMarkingRead(true);
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    } finally {
      setMarkingRead(false);
    }
  }

  async function handleNotificationClick(notification: Notification) {
    if (!user) return;

    try {
      // Determine where to navigate based on type
      if (notification.type === "message" && notification.ref_id) {
        // Find the conversation ID from the message
        const { data: message } = await supabase
          .from("messages")
          .select("conversation_id")
          .eq("id", notification.ref_id)
          .maybeSingle();

        if (message?.conversation_id) {
          navigate(`/messages/${message.conversation_id}`);
        } else {
          navigate("/messages");
        }
      } else if (notification.type === "connection_request") {
        // Navigate to messages inbox where connection requests are shown
        navigate("/messages");
      } else if (notification.type === "review") {
        // Check user's role to determine which reviews page
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_vendor_admin, is_fieldrep")
          .eq("id", user.id)
          .single();

        if (profile?.is_vendor_admin) {
          navigate("/vendor/reviews");
        } else if (profile?.is_fieldrep) {
          navigate("/rep/reviews");
        }
      } else if (notification.type === "new_coverage_opportunity") {
        // Navigate to Find Work page
        navigate("/rep/find-work");
      } else if (notification.type === "community_comment_on_post" && notification.ref_id) {
        // Navigate to the community post
        navigate(`/community/${notification.ref_id}`);
      } else if (notification.type === "community_post_resolved" && notification.ref_id) {
        // Navigate to the resolved community post
        navigate(`/community/${notification.ref_id}`);
      } else if (notification.type === "review_reminder" && notification.ref_id) {
        // Deep-link to open review dialog for this connection
        await handleReviewReminderClick(notification.ref_id);
      } else if (notification.type === "vendor_network_alert") {
        // Navigate to My Vendors page for reps
        navigate("/rep/my-vendors");
      } else if (notification.type === "vendor_alert") {
        // Vendor alert from rep - navigate to My Reps
        navigate("/vendor/my-reps");
      }
    } catch (error) {
      console.error("Error navigating from notification:", error);
    }
  }

  async function handleReviewReminderClick(repInterestId: string) {
    if (!user) return;

    try {
      // Fetch the rep_interest to determine direction and target user
      const { data: repInterest, error: riError } = await supabase
        .from("rep_interest")
        .select("id, rep_id, post_id")
        .eq("id", repInterestId)
        .maybeSingle();

      if (riError || !repInterest) {
        console.error("Error fetching rep_interest:", riError);
        toast({
          title: "Error",
          description: "Could not load review details",
          variant: "destructive",
        });
        return;
      }

      // Fetch rep profile to get user_id
      const { data: repProfile, error: rpError } = await supabase
        .from("rep_profile")
        .select("user_id")
        .eq("id", repInterest.rep_id)
        .maybeSingle();

      if (rpError || !repProfile) {
        console.error("Error fetching rep profile:", rpError);
        return;
      }

      // Fetch post to get vendor_id
      const { data: post, error: postError } = await supabase
        .from("seeking_coverage_posts")
        .select("vendor_id")
        .eq("id", repInterest.post_id)
        .maybeSingle();

      if (postError || !post) {
        console.error("Error fetching post:", postError);
        return;
      }

      const repUserId = repProfile.user_id;
      const vendorUserId = post.vendor_id;

      // Determine direction based on current user
      if (user.id === vendorUserId) {
        // Vendor reviewing rep
        setReviewDirection("vendor_to_rep");
        setReviewTargetUserId(repUserId);
      } else if (user.id === repUserId) {
        // Rep reviewing vendor
        setReviewDirection("rep_to_vendor");
        setReviewTargetUserId(vendorUserId);
      } else {
        console.error("Current user is neither vendor nor rep for this connection");
        return;
      }

      setReviewRepInterestId(repInterestId);
      setReviewDialogOpen(true);
    } catch (error) {
      console.error("Error handling review reminder click:", error);
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case "message":
        return <MessageSquare className="h-4 w-4" />;
      case "connection_request":
        return <UserPlus className="h-4 w-4" />;
      case "review":
        return <Star className="h-4 w-4" />;
      case "review_reminder":
        return <ClipboardCheck className="h-4 w-4" />;
      case "new_coverage_opportunity":
        return <Briefcase className="h-4 w-4" />;
      case "community_comment_on_post":
        return <Users className="h-4 w-4" />;
      case "community_post_resolved":
        return <CheckCircle className="h-4 w-4" />;
      case "vendor_network_alert":
      case "vendor_alert":
        return <Megaphone className="h-4 w-4" />;
      default:
        return null;
    }
  }

  function getNotificationBadgeLabel(type: string) {
    switch (type) {
      case "message":
        return "Message";
      case "connection_request":
        return "Connection";
      case "review":
        return "Review";
      case "review_reminder":
        return "Review Request";
      case "new_coverage_opportunity":
        return "New Work";
      case "community_comment_on_post":
        return "Community";
      case "community_post_resolved":
        return "Post Update";
      case "vendor_network_alert":
        return "Vendor Alert";
      case "vendor_alert":
        return "Rep Alert";
      default:
        return type;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-3xl font-bold">Notifications</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/notifications/settings")}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>
          <p className="text-muted-foreground">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">Notifications</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/notifications/settings")}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>

        {notifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No notifications yet.</p>
              <p className="text-sm text-muted-foreground mt-2">
                You'll be notified here when you receive messages, connection requests, or reviews.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                  !notification.is_read ? "border-primary" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {getNotificationBadgeLabel(notification.type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                        {!notification.is_read && (
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className={`text-sm ${!notification.is_read ? "font-semibold" : "font-medium"}`}>
                        {notification.title}
                      </p>
                      {notification.body && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.body}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Review Dialog for review_reminder deep-linking */}
      {reviewTargetUserId && reviewDirection && user && (
        <ReviewDialog
          open={reviewDialogOpen}
          onOpenChange={(open) => {
            setReviewDialogOpen(open);
            if (!open) {
              setReviewTargetUserId(null);
              setReviewRepInterestId(null);
              setReviewDirection(null);
            }
          }}
          reviewerId={user.id}
          revieweeId={reviewTargetUserId}
          direction={reviewDirection}
          repInterestId={reviewRepInterestId}
          isExitReview={false}
          onSaved={() => {
            setReviewDialogOpen(false);
            setReviewTargetUserId(null);
            setReviewRepInterestId(null);
            setReviewDirection(null);
            toast({
              title: "Review submitted",
              description: "Thank you for your feedback!",
            });
          }}
        />
      )}
    </div>
  );
}
