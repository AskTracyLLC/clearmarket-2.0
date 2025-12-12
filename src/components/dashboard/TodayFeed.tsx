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
import { formatDistanceToNow, parseISO, isToday, isYesterday, format, startOfDay } from "date-fns";
import { doesPostMatchRepRate } from "@/lib/rateMatching";

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
        } else if (notif.type === 'admin_message' && notif.ref_id) {
          link = `/messages/${notif.ref_id}`;
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
        } else if (notif.type.includes('alert') || notif.type.includes('working_terms') || notif.type === 'admin_message') {
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

      // 3. Get new opportunities for reps (recent seeking coverage posts matching coverage)
      if (isRep) {
        // First, get the rep's coverage areas with inspection types AND base_price for rate matching
        const { data: repCoverage } = await supabase
          .from("rep_coverage_areas")
          .select("state_code, county_id, covers_entire_state, inspection_types, base_price")
          .eq("user_id", userId);

        // Also get rep's profile-level inspection types as fallback
        const { data: repProfile } = await supabase
          .from("rep_profile")
          .select("id, inspection_types")
          .eq("user_id", userId)
          .single();

        const profileInspectionTypes = repProfile?.inspection_types || [];

        // Get rep's existing interest records to filter out already-interacted opportunities
        let interestSet = new Set<string>();
        if (repProfile?.id) {
          const { data: interests } = await supabase
            .from("rep_interest")
            .select("post_id, status")
            .eq("rep_id", repProfile.id);
          
          // Exclude posts where rep has already acted (interested, not_interested, declined_by_vendor)
          for (const int of interests || []) {
            interestSet.add(int.post_id);
          }
        }

        // Get opportunities from last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: opportunities } = await supabase
          .from("seeking_coverage_posts")
          .select("id, title, state_code, county_id, covers_entire_state, created_at, pay_min, pay_max, inspection_type_ids")
          .eq("status", "active")
          .is("deleted_at", null)
          .gte("created_at", sevenDaysAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(30); // Fetch more, we'll filter client-side

        // Filter opportunities by coverage match, inspection type match, AND rate match
        const matchedOpportunities = (opportunities || []).filter(opp => {
          // Skip if rep has already interacted with this post
          if (interestSet.has(opp.id)) return false;
          
          if (!repCoverage || repCoverage.length === 0) return false;
          
          // Find matching coverage areas for this post
          const matchingCoverageAreas = repCoverage.filter(coverage => {
            // Must match state first
            if (opp.state_code !== coverage.state_code) return false;
            
            // If post covers entire state, any rep in that state matches
            if (opp.covers_entire_state) return true;
            
            // If rep covers entire state, they match any post in that state
            if (coverage.covers_entire_state) return true;
            
            // If post is county-specific, rep must have that county
            if (opp.county_id && coverage.county_id) {
              return opp.county_id === coverage.county_id;
            }
            
            // If no county specified on post but rep has state coverage, match
            if (!opp.county_id) return true;
            
            return false;
          });

          // If no area matches, skip this opportunity
          if (matchingCoverageAreas.length === 0) return false;

          // RATE MATCHING: Check if at least one matching coverage area has a rate that works
          const hasRateMatch = matchingCoverageAreas.some(coverage => {
            const repBaseRate = coverage.base_price;
            // Use the shared rate matching function
            return doesPostMatchRepRate(repBaseRate, opp.pay_min, opp.pay_max);
          });

          // If no rate match, skip this opportunity
          if (!hasRateMatch) return false;

          // Check inspection type matching
          const vendorRequestedTypes = opp.inspection_type_ids || [];
          
          // If vendor didn't specify types, accept any rep whose area matches
          if (vendorRequestedTypes.length === 0) return true;

          // Get rep's active inspection types for the matching coverage areas
          // Use coverage-area-specific types if set, otherwise fall back to profile-level types
          const repTypesForRegion = new Set<string>();
          
          for (const coverage of matchingCoverageAreas) {
            const coverageTypes = coverage.inspection_types || [];
            if (coverageTypes.length > 0) {
              // Use coverage-area-specific types
              coverageTypes.forEach((t: string) => repTypesForRegion.add(t));
            } else {
              // Fall back to profile-level types
              profileInspectionTypes.forEach((t: string) => repTypesForRegion.add(t));
            }
          }

          // Check for intersection (any-of logic)
          const hasIntersection = vendorRequestedTypes.some((vt: string) => repTypesForRegion.has(vt));
          return hasIntersection;
        });

        for (const opp of matchedOpportunities.slice(0, 5)) {
          // Don't show vendor rate to reps - just show location and that it matches
          items.push({
            id: `opp-${opp.id}`,
            type: 'opportunity',
            title: opp.title,
            description: `${opp.state_code || 'Location TBD'} · Matches your rate`,
            timestamp: opp.created_at,
            isUnread: true, // New opportunities are unread
            link: `/rep/seeking-coverage/${opp.id}`,
            metadata: { postId: opp.id, isNew: true },
          });
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

  const getFilterDescription = (filter: ActivityFilter): React.ReactNode => {
    switch (filter) {
      case 'all':
        return 'This view shows every alert, opportunity, and update in one list.';
      case 'alerts':
        return 'Alerts are time-sensitive items or things that may need a response from you, like coverage & pricing requests, working terms changes, or office/network alerts.';
      case 'opportunities':
        return (
          <>
            These are posts from vendors looking for help in your work areas. You'll see opportunities based on the coverage you saved in your profile.{' '}
            <Link to="/rep/pending-opportunities" className="underline hover:text-primary">View opportunities you've applied to →</Link>
          </>
        );
      case 'updates':
        return "Updates keep you in the loop on things that usually don't need a response, like ClearMarket announcements, FAQ changes, and comments on your posts.";
    }
  };

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
      {/* Filter chips */}
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

      {/* Inline description for active filter */}
      <p className="text-sm text-muted-foreground py-2 px-1">
        {getFilterDescription(activityFilter)}
      </p>

      {/* Filtered items grouped by date */}
      {filteredItems.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-6 text-center">
            <p className="text-muted-foreground text-sm">
              {activityFilter === 'opportunities' 
                ? "No new opportunities in your coverage area yet. Try expanding your coverage or check back later."
                : `No ${activityFilter === 'all' ? 'activity' : activityFilter} to show.`
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(() => {
            // Group items by date
            const groupedItems: { [dateKey: string]: FeedItem[] } = {};
            
            filteredItems.forEach((item) => {
              const itemDate = parseISO(item.timestamp);
              const dateKey = startOfDay(itemDate).toISOString();
              if (!groupedItems[dateKey]) {
                groupedItems[dateKey] = [];
              }
              groupedItems[dateKey].push(item);
            });

            // Sort date keys descending (newest first)
            const sortedDateKeys = Object.keys(groupedItems).sort(
              (a, b) => new Date(b).getTime() - new Date(a).getTime()
            );

            const getDateHeader = (dateKey: string): string => {
              const date = new Date(dateKey);
              if (isToday(date)) return "Today";
              if (isYesterday(date)) return "Yesterday";
              return format(date, "MMM d, yyyy");
            };

            return sortedDateKeys.map((dateKey, groupIndex) => (
              <div key={dateKey}>
                {/* Date header */}
                <div className={`flex items-center gap-2 ${groupIndex > 0 ? 'mt-4 pt-4 border-t border-border' : ''}`}>
                  <span className="text-sm font-semibold text-foreground">
                    {getDateHeader(dateKey)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                
                {/* Items for this date */}
                <div className="space-y-2 mt-2">
                  {groupedItems[dateKey].map((item) => (
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
              </div>
            ));
          })()}
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
