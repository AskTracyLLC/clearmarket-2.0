import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageSquare, 
  Bell, 
  Star, 
  Briefcase, 
  Users,
  AlertCircle,
  ChevronRight,
  Clock,
  Megaphone
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

interface FeedItem {
  id: string;
  type: 'message' | 'notification' | 'review' | 'opportunity' | 'connection_request' | 'alert' | 'announcement';
  title: string;
  description: string;
  timestamp: string;
  isUnread?: boolean;
  link?: string;
  metadata?: Record<string, unknown>;
}

interface TodayFeedProps {
  userId: string;
  isRep: boolean;
  isVendor: boolean;
}

type ActivityFilter = 'all' | 'alerts' | 'opportunities' | 'updates';

export function TodayFeed({ userId, isRep, isVendor }: TodayFeedProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');

  const getFilterCategory = (type: FeedItem['type']): ActivityFilter => {
    if (type === 'alert') return 'alerts';
    if (type === 'opportunity') return 'opportunities';
    // Announcements and notifications fall under 'updates'
    return 'updates';
  };

  const filteredItems = feedItems.filter(item => {
    if (activityFilter === 'all') return true;
    return getFilterCategory(item.type) === activityFilter;
  });

  useEffect(() => {
    loadFeed();
  }, [userId, isRep, isVendor]);

  const loadFeed = async () => {
    if (!userId) return;

    const items: FeedItem[] = [];

    try {
      // 1. Get unread messages (group by conversation)
      const { data: unreadMessages } = await supabase
        .from("messages")
        .select(`
          id, body, created_at, sender_id, conversation_id,
          conversations!inner(id, participant_one, participant_two)
        `)
        .eq("recipient_id", userId)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(10);

      const seenConversations = new Set<string>();
      for (const msg of unreadMessages || []) {
        const convId = msg.conversation_id;
        if (convId && !seenConversations.has(convId)) {
          seenConversations.add(convId);
          items.push({
            id: `msg-${msg.id}`,
            type: 'message',
            title: 'New message',
            description: msg.body.slice(0, 100) + (msg.body.length > 100 ? '...' : ''),
            timestamp: msg.created_at,
            isUnread: true,
            link: `/messages/${convId}`,
          });
        }
      }

      // 2. Get recent notifications
      const { data: notifications } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(15);

      for (const notif of notifications || []) {
        // Skip if already processed as message
        if (notif.type === 'new_message') continue;
        
        // Determine the correct link based on notification type
        let link = '/notifications';
        if (notif.type === 'announcement' && notif.ref_id) {
          link = `/community?tab=announcements&postId=${notif.ref_id}`;
        } else if (notif.type === 'working_terms_request' && notif.ref_id) {
          link = `/rep/working-terms-request/${notif.ref_id}`;
        } else if (notif.type === 'working_terms_submitted' && notif.ref_id) {
          link = `/vendor/working-terms-review/${notif.ref_id}`;
        } else if (notif.type === 'working_terms_confirmed') {
          link = isRep ? '/rep/my-vendors' : '/vendor/my-reps';
        } else if (notif.type.includes('review')) {
          link = isRep ? '/rep/reviews' : '/vendor/reviews';
        } else if (notif.type.includes('connection')) {
          link = '/messages';
        } else if (notif.type.includes('coverage')) {
          link = '/rep/find-work';
        }
        
        // Determine item type
        let itemType: FeedItem['type'] = 'notification';
        if (notif.type === 'announcement') {
          itemType = 'announcement';
        } else if (notif.type.includes('review')) {
          itemType = 'review';
        } else if (notif.type.includes('connection')) {
          itemType = 'connection_request';
        } else if (notif.type.includes('alert') || notif.type.includes('working_terms')) {
          itemType = 'alert';
        }
        
        items.push({
          id: `notif-${notif.id}`,
          type: itemType,
          title: notif.title,
          description: notif.body || '',
          timestamp: notif.created_at,
          isUnread: !notif.is_read,
          link,
        });
      }

      // 3. Get new opportunities for reps (recent seeking coverage posts)
      if (isRep) {
        const { data: opportunities } = await supabase
          .from("seeking_coverage_posts")
          .select("id, title, state_code, created_at, pay_min, pay_max")
          .eq("status", "active")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(5);

        for (const opp of opportunities || []) {
          // Only show opportunities from last 7 days
          const createdAt = new Date(opp.created_at);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          
          if (createdAt >= sevenDaysAgo) {
            const payText = opp.pay_max 
              ? `$${opp.pay_min}–$${opp.pay_max}` 
              : opp.pay_min 
                ? `$${opp.pay_min}` 
                : '';
            items.push({
              id: `opp-${opp.id}`,
              type: 'opportunity',
              title: opp.title,
              description: `${opp.state_code || 'Location TBD'}${payText ? ` · ${payText}` : ''}`,
              timestamp: opp.created_at,
              isUnread: false,
              link: '/rep/find-work',
            });
          }
        }
      }

      // 4. Get pending connection requests for reps
      if (isRep) {
        const { data: pendingConnections } = await supabase
          .from("vendor_connections")
          .select(`
            id, requested_at, vendor_id,
            vendor_profile:vendor_profile!vendor_connections_vendor_id_fkey(anonymous_id, company_name)
          `)
          .eq("field_rep_id", userId)
          .eq("status", "pending")
          .order("requested_at", { ascending: false })
          .limit(5);

        for (const conn of pendingConnections || []) {
          const vendorName = (conn.vendor_profile as { anonymous_id?: string; company_name?: string } | null)?.company_name || 
                           (conn.vendor_profile as { anonymous_id?: string; company_name?: string } | null)?.anonymous_id || 
                           'A vendor';
          items.push({
            id: `conn-${conn.id}`,
            type: 'connection_request',
            title: 'Connection request',
            description: `${vendorName} wants to connect with you`,
            timestamp: conn.requested_at,
            isUnread: true,
            link: '/messages',
          });
        }
      }

      // Sort by timestamp descending and take top 15
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setFeedItems(items.slice(0, 15));
    } catch (error) {
      console.error("Error loading feed:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: FeedItem['type']) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="h-4 w-4" />;
      case 'notification':
        return <Bell className="h-4 w-4" />;
      case 'review':
        return <Star className="h-4 w-4" />;
      case 'opportunity':
        return <Briefcase className="h-4 w-4" />;
      case 'connection_request':
        return <Users className="h-4 w-4" />;
      case 'alert':
        return <AlertCircle className="h-4 w-4" />;
      case 'announcement':
        return <Megaphone className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  // Light mode: light tint bg + dark text for WCAG AA contrast
  // Dark mode: darker tint bg + lighter text
  const getTypeColor = (type: FeedItem['type']) => {
    switch (type) {
      case 'message':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400';
      case 'review':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400';
      case 'opportunity':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400';
      case 'connection_request':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-400';
      case 'alert':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400';
      case 'announcement':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-400';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const getTypeLabel = (type: FeedItem['type']) => {
    switch (type) {
      case 'message':
        return 'Message';
      case 'review':
        return 'Review';
      case 'opportunity':
        return 'Opportunity';
      case 'connection_request':
        return 'Connection';
      case 'alert':
        return 'Alert';
      case 'announcement':
        return 'Update';
      default:
        return 'Update';
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="py-4">
              <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const filterOptions: { value: ActivityFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'alerts', label: 'Alerts' },
    { value: 'opportunities', label: 'Opportunities' },
    { value: 'updates', label: 'Updates' },
  ];

  if (feedItems.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8 text-center">
          <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            You're all caught up! No new activity to show.
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Check back later for messages, reviews, and opportunities.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter chips - dark text for accessibility, active has tinted bg + underline indicator */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setActivityFilter(option.value)}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors border ${
              activityFilter === option.value
                ? 'bg-primary/10 text-foreground font-semibold border-primary/50 underline underline-offset-2 dark:bg-primary/20'
                : 'bg-background text-foreground border-border hover:bg-muted/50 font-medium'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Filtered items */}
      {filteredItems.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-6 text-center">
            <p className="text-muted-foreground text-sm">
              No {activityFilter === 'all' ? 'activity' : activityFilter} to show.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <Card 
              key={item.id} 
              className={`bg-card border-border hover:border-primary/50 transition-colors cursor-pointer ${
                item.isUnread ? 'border-l-2 border-l-primary' : ''
              }`}
              onClick={() => item.link && navigate(item.link)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${getTypeColor(item.type)} flex-shrink-0`}>
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {item.title}
                      </span>
                      <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${getTypeColor(item.type)}`}>
                        {getTypeLabel(item.type)}
                      </Badge>
                      {item.isUnread && (
                        <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(parseISO(item.timestamp), { addSuffix: true })}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <div className="pt-2 text-center">
        <Button variant="ghost" size="sm" onClick={() => navigate('/notifications')}>
          View all activity
        </Button>
      </div>
    </div>
  );
}
