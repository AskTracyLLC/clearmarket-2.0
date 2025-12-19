import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  UserPlus,
  Star,
  Briefcase,
  Users,
  CheckCircle,
  ClipboardCheck,
  Megaphone,
  Bell,
  AlertCircle,
  FileText,
  Trash2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { getNotificationTargetUrlSync } from "@/lib/notificationNavigation";

export interface NotificationItem {
  id: string;
  created_at: string;
  type: string;
  ref_id: string | null;
  title: string;
  body: string | null;
  is_read: boolean;
  is_deleted: boolean;
  review_later: boolean;
}

interface NotificationFeedItemProps {
  notification: NotificationItem;
  isRep: boolean;
  isVendor: boolean;
  onDelete: (id: string) => void;
  onReviewLater: (id: string) => void;
  showActions?: boolean;
}

export function NotificationFeedItem({
  notification,
  isRep,
  isVendor,
  onDelete,
  onReviewLater,
  showActions = true,
}: NotificationFeedItemProps) {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSnoozing, setIsSnoozing] = useState(false);

  const targetInfo = getNotificationTargetUrlSync(
    notification.type,
    notification.ref_id,
    isRep,
    isVendor
  );

  const handleClick = async () => {
    if (!targetInfo.canNavigate) return;

    // Mark as read if unread
    if (!notification.is_read) {
      await supabase
        .from("notifications")
        .update({ 
          is_read: true,
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq("id", notification.id);
    }

    navigate(targetInfo.url);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_deleted: true })
        .eq("id", notification.id);

      if (error) throw error;
      
      onDelete(notification.id);
      toast.success("Notification removed");
    } catch (err) {
      console.error("Error deleting notification:", err);
      toast.error("Failed to remove notification");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReviewLater = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSnoozing(true);
    
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ 
          review_later: true,
          status: 'snoozed'
        })
        .eq("id", notification.id);

      if (error) throw error;
      
      onReviewLater(notification.id);
      toast.success("Saved to Review Later");
    } catch (err) {
      console.error("Error snoozing notification:", err);
      toast.error("Failed to save for later");
    } finally {
      setIsSnoozing(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "message":
      case "new_message":
      case "admin_message":
        return <MessageSquare className="h-4 w-4" />;
      case "connection_request":
      case "connection_accepted":
      case "connection_declined":
        return <UserPlus className="h-4 w-4" />;
      case "review":
      case "review_received":
        return <Star className="h-4 w-4" />;
      case "review_reminder":
        return <ClipboardCheck className="h-4 w-4" />;
      case "new_coverage_opportunity":
      case "seeking_coverage_interest":
        return <Briefcase className="h-4 w-4" />;
      case "community_comment_on_post":
      case "community_post_resolved":
        return <Users className="h-4 w-4" />;
      case "announcement":
      case "admin_broadcast":
        return <Megaphone className="h-4 w-4" />;
      case "working_terms_request":
      case "working_terms_submitted":
      case "working_terms_confirmed":
        return <FileText className="h-4 w-4" />;
      case "territory_assignment":
      case "territory_assignment_pending":
      case "territory_assignment_accepted":
      case "territory_assignment_declined":
        return <AlertCircle className="h-4 w-4" />;
      case "vendor_network_alert":
      case "vendor_alert":
        return <Megaphone className="h-4 w-4" />;
      case "checklist_assigned":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getBadgeLabel = (type: string) => {
    switch (type) {
      case "message":
      case "new_message":
        return "Message";
      case "admin_message":
        return "Admin";
      case "connection_request":
      case "connection_accepted":
      case "connection_declined":
        return "Connection";
      case "review":
      case "review_received":
        return "Review";
      case "review_reminder":
        return "Review Request";
      case "new_coverage_opportunity":
        return "Opportunity";
      case "seeking_coverage_interest":
        return "Interest";
      case "community_comment_on_post":
        return "Community";
      case "community_post_resolved":
        return "Post Update";
      case "announcement":
        return "Announcement";
      case "admin_broadcast":
        return "Feedback Request";
      case "working_terms_request":
      case "working_terms_submitted":
      case "working_terms_confirmed":
        return "Terms";
      case "territory_assignment":
      case "territory_assignment_pending":
        return "Assignment";
      case "territory_assignment_accepted":
      case "territory_assignment_declined":
        return "Assignment";
      case "vendor_network_alert":
        return "Vendor Alert";
      case "vendor_alert":
        return "Rep Alert";
      case "checklist_assigned":
        return "Checklist";
      default:
        return "Update";
    }
  };

  return (
    <Card
      className={`transition-colors ${
        targetInfo.canNavigate 
          ? "cursor-pointer hover:bg-accent/50" 
          : "cursor-default"
      } ${!notification.is_read ? "border-primary" : ""}`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 text-muted-foreground">
            {getIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                {getBadgeLabel(notification.type)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </span>
              {!notification.is_read && (
                <div className="h-2 w-2 rounded-full bg-primary" />
              )}
              {targetInfo.canNavigate && (
                <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
              )}
            </div>
            <p className={`text-sm ${!notification.is_read ? "font-semibold" : "font-medium"}`}>
              {notification.title}
            </p>
            {notification.body && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {notification.body}
              </p>
            )}
          </div>
          
          {showActions && (
            <div className="flex items-center gap-1 ml-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleReviewLater}
                      disabled={isSnoozing}
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Save and hide for now</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Remove from my notifications</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
