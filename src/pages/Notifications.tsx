import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Clock, Info } from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isYesterday, isThisWeek, parseISO, startOfDay } from "date-fns";
import { PageHeader } from "@/components/PageHeader";

import { NotificationFeedItem, NotificationItem } from "@/components/dashboard/NotificationFeedItem";

export default function Notifications() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [reviewLaterItems, setReviewLaterItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "review-later">("all");
  const [userRoles, setUserRoles] = useState<{ isRep: boolean; isVendor: boolean }>({ isRep: false, isVendor: false });

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/signin");
      return;
    }

    loadUserRoles();
    loadNotifications();
    loadReviewLaterItems();
  }, [user, authLoading, navigate]);

  async function loadUserRoles() {
    if (!user) return;
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_fieldrep, is_vendor_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      setUserRoles({
        isRep: profile.is_fieldrep || false,
        isVendor: profile.is_vendor_admin || false,
      });
    }
  }

  async function loadNotifications() {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, created_at, type, ref_id, title, body, is_read, is_deleted, review_later")
        .eq("user_id", user.id)
        .eq("is_deleted", false)
        .eq("review_later", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setNotifications((data || []) as NotificationItem[]);

      // Mark all as read after loading
      if (data && data.some(n => !n.is_read)) {
        await markAllAsRead();
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  async function loadReviewLaterItems() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, created_at, type, ref_id, title, body, is_read, is_deleted, review_later")
        .eq("user_id", user.id)
        .eq("is_deleted", false)
        .eq("review_later", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setReviewLaterItems((data || []) as NotificationItem[]);
    } catch (error) {
      console.error("Error loading review later items:", error);
    }
  }

  async function markAllAsRead() {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  }

  const handleDelete = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setReviewLaterItems(prev => prev.filter(n => n.id !== id));
  };

  const handleReviewLater = (id: string) => {
    // Move from notifications to review later
    const item = notifications.find(n => n.id === id);
    if (item) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      setReviewLaterItems(prev => [{ ...item, review_later: true }, ...prev]);
    }
  };

  const handleRestoreFromReviewLater = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ review_later: false })
        .eq("id", id);

      if (error) throw error;

      const item = reviewLaterItems.find(n => n.id === id);
      if (item) {
        setReviewLaterItems(prev => prev.filter(n => n.id !== id));
        setNotifications(prev => [{ ...item, review_later: false }, ...prev].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }
      toast.success("Notification restored");
    } catch (err) {
      console.error("Error restoring notification:", err);
      toast.error("Failed to restore");
    }
  };

  // Group notifications by date
  const groupNotificationsByDate = (items: NotificationItem[]) => {
    const groups: { label: string; items: NotificationItem[] }[] = [];
    const today = startOfDay(new Date());
    
    const todayItems: NotificationItem[] = [];
    const yesterdayItems: NotificationItem[] = [];
    const thisWeekItems: NotificationItem[] = [];
    const olderItems: NotificationItem[] = [];

    items.forEach(item => {
      const date = parseISO(item.created_at);
      if (isToday(date)) {
        todayItems.push(item);
      } else if (isYesterday(date)) {
        yesterdayItems.push(item);
      } else if (isThisWeek(date)) {
        thisWeekItems.push(item);
      } else {
        olderItems.push(item);
      }
    });

    if (todayItems.length > 0) {
      groups.push({ label: "Today", items: todayItems });
    }
    if (yesterdayItems.length > 0) {
      groups.push({ label: "Yesterday", items: yesterdayItems });
    }
    if (thisWeekItems.length > 0) {
      groups.push({ label: "Earlier this week", items: thisWeekItems });
    }
    if (olderItems.length > 0) {
      groups.push({ label: "Last 30 days", items: olderItems });
    }

    return groups;
  };

  const notificationGroups = groupNotificationsByDate(notifications);

  if (loading) {
    return (
      <div className="bg-background p-8">
        <div className="max-w-3xl mx-auto">
          <PageHeader
            title="All Notifications"
            subtitle="View your complete notification history"
          />
          <p className="text-muted-foreground">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-background p-8">
        <div className="max-w-3xl mx-auto">
          <PageHeader
            title="All Notifications"
            subtitle="View your complete notification history"
          />

          {/* Info Banner */}
          <Card className="mb-6 bg-muted/30">
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Click any item to jump to its source. Use Delete or Review Later to keep this list tidy.
                </p>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "review-later")}>
            <TabsList className="mb-4">
              <TabsTrigger value="all" className="gap-2">
                <Bell className="h-4 w-4" />
                All ({notifications.length})
              </TabsTrigger>
              <TabsTrigger value="review-later" className="gap-2">
                <Clock className="h-4 w-4" />
                Review Later ({reviewLaterItems.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {notifications.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No notifications yet.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      You'll be notified here when you receive messages, connection requests, or reviews.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {notificationGroups.map((group) => (
                    <div key={group.label}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-semibold text-foreground">{group.label}</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <div className="space-y-2">
                        {group.items.map((notification) => (
                          <NotificationFeedItem
                            key={notification.id}
                            notification={notification}
                            isRep={userRoles.isRep}
                            isVendor={userRoles.isVendor}
                            onDelete={handleDelete}
                            onReviewLater={handleReviewLater}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="review-later">
              {reviewLaterItems.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No items saved for later.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Use the clock icon on any notification to save it here for later review.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {reviewLaterItems.map((notification) => (
                    <Card
                      key={notification.id}
                      className="transition-colors"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs">
                                Saved
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(notification.created_at), "MMM d, yyyy")}
                              </span>
                            </div>
                            <p className="text-sm font-medium">{notification.title}</p>
                            {notification.body && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {notification.body}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreFromReviewLater(notification.id)}
                            >
                              Restore
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(notification.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
