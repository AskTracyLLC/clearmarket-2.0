import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, MessageSquare, UserPlus, Star, Briefcase, Users, CheckCircle, ClipboardCheck, Megaphone, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  created_at: string;
  type: string;
  ref_id: string | null;
  title: string;
  body: string | null;
  is_read: boolean;
}

export function NotificationsDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadUnreadCount();
    }
  }, [user]);

  useEffect(() => {
    if (open && user) {
      loadNotifications();
    }
  }, [open, user]);

  async function loadUnreadCount() {
    if (!user) return;
    
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    
    setUnreadCount(count || 0);
  }

  async function loadNotifications() {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      setNotifications((data || []) as Notification[]);

      // Mark all as read after loading
      if (data && data.some(n => !n.is_read)) {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", user.id)
          .eq("is_read", false);
        
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case "message":
        return <MessageSquare className="h-3.5 w-3.5" />;
      case "connection_request":
        return <UserPlus className="h-3.5 w-3.5" />;
      case "review":
        return <Star className="h-3.5 w-3.5" />;
      case "review_reminder":
        return <ClipboardCheck className="h-3.5 w-3.5" />;
      case "new_coverage_opportunity":
        return <Briefcase className="h-3.5 w-3.5" />;
      case "community_comment_on_post":
        return <Users className="h-3.5 w-3.5" />;
      case "community_post_resolved":
        return <CheckCircle className="h-3.5 w-3.5" />;
      case "vendor_network_alert":
      case "vendor_alert":
        return <Megaphone className="h-3.5 w-3.5" />;
      case "working_terms_request":
      case "working_terms_submitted":
      case "working_terms_confirmed":
        return <FileText className="h-3.5 w-3.5" />;
      case "review_marked_feedback":
        return <Star className="h-3.5 w-3.5" />;
      default:
        return <Bell className="h-3.5 w-3.5" />;
    }
  }

  async function handleNotificationClick(notification: Notification) {
    setOpen(false);
    
    if (notification.type === "message" && notification.ref_id) {
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
      navigate("/messages");
    } else if (notification.type === "review") {
      navigate("/notifications");
    } else if (notification.type === "new_coverage_opportunity") {
      navigate("/rep/find-work");
    } else if (notification.type === "community_comment_on_post" && notification.ref_id) {
      navigate(`/community/${notification.ref_id}`);
    } else if (notification.type === "community_post_resolved" && notification.ref_id) {
      navigate(`/community/${notification.ref_id}`);
    } else if (notification.type === "review_reminder") {
      navigate("/notifications");
    } else if (notification.type === "vendor_network_alert") {
      navigate("/rep/my-vendors");
    } else if (notification.type === "vendor_alert") {
      navigate("/vendor/my-reps");
    } else if (notification.type === "working_terms_request" && notification.ref_id) {
      navigate(`/rep/working-terms-request/${notification.ref_id}`);
    } else if (notification.type === "working_terms_submitted" && notification.ref_id) {
      navigate(`/vendor/working-terms-review/${notification.ref_id}`);
    } else if (notification.type === "working_terms_confirmed") {
      navigate("/rep/my-vendors");
    } else {
      navigate("/notifications");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-orange-500 hover:bg-orange-500"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 bg-background border-border z-50" 
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Notifications</h3>
        </div>
        
        <ScrollArea className="max-h-80">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-muted-foreground">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{notification.title}</p>
                      {notification.body && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {notification.body}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="border-t border-border p-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-xs"
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
