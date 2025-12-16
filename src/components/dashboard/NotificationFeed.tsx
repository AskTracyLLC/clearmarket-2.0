import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Bell, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { isToday, startOfDay, parseISO } from "date-fns";
import { NotificationFeedItem, NotificationItem } from "./NotificationFeedItem";

interface NotificationFeedProps {
  userId: string;
  isRep: boolean;
  isVendor: boolean;
  limit?: number;
}

export function NotificationFeed({ userId, isRep, isVendor, limit = 20 }: NotificationFeedProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [earlierExpanded, setEarlierExpanded] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, [userId]);

  const loadNotifications = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, created_at, type, ref_id, title, body, is_read, is_deleted, review_later")
        .eq("user_id", userId)
        .eq("is_deleted", false)
        .eq("review_later", false)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      setNotifications((data || []) as NotificationItem[]);
    } catch (err) {
      console.error("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleReviewLater = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Split notifications into today and earlier
  const todayStart = startOfDay(new Date());
  const todayNotifications = notifications.filter(n => {
    const createdAt = parseISO(n.created_at);
    return createdAt >= todayStart;
  });
  const earlierNotifications = notifications.filter(n => {
    const createdAt = parseISO(n.created_at);
    return createdAt < todayStart;
  });

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-6 text-center">
          <p className="text-muted-foreground text-sm">Loading notifications...</p>
        </CardContent>
      </Card>
    );
  }

  if (notifications.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8 text-center">
          <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            No notifications yet.
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            You'll see updates here when you receive messages, reviews, or alerts.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Today Section */}
      {todayNotifications.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-foreground">Today</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-2">
            {todayNotifications.map((notification) => (
              <NotificationFeedItem
                key={notification.id}
                notification={notification}
                isRep={isRep}
                isVendor={isVendor}
                onDelete={handleDelete}
                onReviewLater={handleReviewLater}
              />
            ))}
          </div>
        </div>
      )}

      {/* Earlier Section */}
      {earlierNotifications.length > 0 && (
        <div>
          <button
            onClick={() => setEarlierExpanded(!earlierExpanded)}
            className="w-full"
          >
            <Card className="bg-muted/30 border-border hover:bg-muted/50 transition-colors">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {earlierExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">
                      Earlier activity ({earlierNotifications.length})
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    View updates from previous days
                  </span>
                </div>
              </CardContent>
            </Card>
          </button>

          {earlierExpanded && (
            <div className="space-y-2 mt-2">
              {earlierNotifications.map((notification) => (
                <NotificationFeedItem
                  key={notification.id}
                  notification={notification}
                  isRep={isRep}
                  isVendor={isVendor}
                  onDelete={handleDelete}
                  onReviewLater={handleReviewLater}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Show "Today" empty state if only earlier notifications exist */}
      {todayNotifications.length === 0 && earlierNotifications.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-foreground">Today</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <Card className="bg-card border-border">
            <CardContent className="py-4 text-center">
              <p className="text-muted-foreground text-sm">
                No new notifications today
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View All Link */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1"
          onClick={() => navigate("/notifications")}
        >
          View all notifications
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
