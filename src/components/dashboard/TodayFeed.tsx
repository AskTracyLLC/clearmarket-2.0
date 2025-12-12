import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  MessageSquare, 
  Bell, 
  Star, 
  Briefcase, 
  Users,
  AlertCircle,
  ChevronRight,
  Clock,
  Megaphone,
  X,
  ExternalLink,
  MessageCircle,
  MapPin,
  Loader2
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NotInterestedDialog } from "@/components/NotInterestedDialog";
import { formatDistanceToNow, parseISO, isToday, isYesterday, format, startOfDay } from "date-fns";
import { doesPostMatchRepRate, getRelativeRateMatchLabel, getRateMatchStatusText } from "@/lib/rateMatching";
import { getOrCreateConversation } from "@/lib/conversations";
import { createNotification } from "@/lib/notifications";

interface OpportunityMetadata {
  postId: string;
  isNew: boolean;
  vendorId: string;
  stateCode: string | null;
  countyName: string | null;
  description: string | null;
  rateLabel: string;
  payMin: number | null;
  payMax: number | null;
}

interface FeedItem {
  id: string;
  type: 'message' | 'notification' | 'review' | 'opportunity' | 'connection_request' | 'alert' | 'announcement';
  title: string;
  description: string;
  timestamp: string;
  isUnread?: boolean;
  link?: string;
  metadata?: Record<string, unknown> | OpportunityMetadata;
}

interface PendingOpportunity {
  id: string;
  postId: string;
  postTitle: string;
  vendorName: string;
  location: string;
  inspectionTypes: string[];
  systemsRequired: string[];
  status: 'interested' | 'in_conversation' | 'assignment_pending';
  interestDate: string;
  conversationId?: string;
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
  
  // Opportunities-specific state
  const [pendingOpportunities, setPendingOpportunities] = useState<PendingOpportunity[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [repProfileId, setRepProfileId] = useState<string | null>(null);
  const [repProfileData, setRepProfileData] = useState<{
    user_id: string;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    systems_used: string[] | null;
    inspection_types: string[] | null;
    is_accepting_new_vendors: boolean | null;
    willing_to_travel_out_of_state: boolean | null;
  } | null>(null);
  const [repCoverageData, setRepCoverageData] = useState<{
    state_code: string;
    county_id: string | null;
    county_name: string | null;
    covers_entire_state: boolean;
    base_price: number | null;
  }[]>([]);
  const [notInterestedPost, setNotInterestedPost] = useState<{ id: string; title: string } | null>(null);
  const [expressingInterest, setExpressingInterest] = useState<string | null>(null);

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
  
  // Load pending opportunities when filter is 'opportunities' and user is a rep
  useEffect(() => {
    if (activityFilter === 'opportunities' && isRep && repProfileId) {
      loadPendingOpportunities();
    }
  }, [activityFilter, isRep, repProfileId]);

  const loadPendingOpportunities = async () => {
    if (!repProfileId) return;
    setLoadingPending(true);
    
    try {
      // Get all opportunities where rep has expressed interest and is waiting on vendor
      const { data: interests } = await supabase
        .from("rep_interest")
        .select(`
          id, post_id, status, created_at,
          seeking_coverage_posts!inner(
            id, title, state_code, county_id, covers_entire_state,
            inspection_type_ids, systems_required_array, vendor_id,
            us_counties(county_name),
            profiles!seeking_coverage_posts_vendor_id_fkey(full_name)
          )
        `)
        .eq("rep_id", repProfileId)
        .eq("status", "interested")
        .order("created_at", { ascending: false });

      // Get vendor profiles for names
      const vendorIds = [...new Set((interests || []).map(i => 
        (i.seeking_coverage_posts as { vendor_id: string })?.vendor_id
      ).filter(Boolean))];

      let vendorMap: Record<string, string> = {};
      if (vendorIds.length > 0) {
        const { data: vendors } = await supabase
          .from("vendor_profile")
          .select("user_id, company_name, anonymous_id")
          .in("user_id", vendorIds);
        
        for (const v of vendors || []) {
          vendorMap[v.user_id] = v.company_name || v.anonymous_id || 'Vendor';
        }
      }

      // Check for existing conversations for each post
      const postIds = (interests || []).map(i => i.post_id);
      let conversationMap: Record<string, string> = {};
      if (postIds.length > 0) {
        const { data: convs } = await supabase
          .from("conversations")
          .select("id, origin_post_id")
          .in("origin_post_id", postIds)
          .or(`participant_one.eq.${userId},participant_two.eq.${userId}`);
        
        for (const c of convs || []) {
          if (c.origin_post_id) {
            conversationMap[c.origin_post_id] = c.id;
          }
        }
      }

      // Check for pending territory assignments
      let assignmentPendingPosts = new Set<string>();
      if (postIds.length > 0) {
        const { data: assignments } = await supabase
          .from("territory_assignments")
          .select("seeking_coverage_post_id, status")
          .in("seeking_coverage_post_id", postIds)
          .eq("rep_id", userId)
          .eq("status", "pending_rep");
        
        for (const a of assignments || []) {
          if (a.seeking_coverage_post_id) {
            assignmentPendingPosts.add(a.seeking_coverage_post_id);
          }
        }
      }

      const pending: PendingOpportunity[] = (interests || []).map(interest => {
        const post = interest.seeking_coverage_posts as {
          id: string;
          title: string;
          state_code: string | null;
          county_id: string | null;
          covers_entire_state: boolean;
          inspection_type_ids: string[] | null;
          systems_required_array: string[];
          vendor_id: string;
          us_counties: { county_name: string } | null;
          profiles: { full_name: string | null } | null;
        };
        
        const countyName = post.us_counties?.county_name;
        const location = post.covers_entire_state 
          ? `All counties, ${post.state_code}`
          : countyName 
            ? `${countyName}, ${post.state_code}`
            : post.state_code || 'Location TBD';

        let status: PendingOpportunity['status'] = 'interested';
        if (assignmentPendingPosts.has(post.id)) {
          status = 'assignment_pending';
        } else if (conversationMap[post.id]) {
          status = 'in_conversation';
        }

        return {
          id: interest.id,
          postId: post.id,
          postTitle: post.title,
          vendorName: vendorMap[post.vendor_id] || 'Vendor',
          location,
          inspectionTypes: post.inspection_type_ids || [],
          systemsRequired: post.systems_required_array || [],
          status,
          interestDate: interest.created_at,
          conversationId: conversationMap[post.id],
        };
      });

      setPendingOpportunities(pending);
    } catch (error) {
      console.error("Error loading pending opportunities:", error);
    } finally {
      setLoadingPending(false);
    }
  };

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

      // Pre-fetch conversation IDs for territory assignment notifications
      const territoryAssignmentRefIds = (notifications || [])
        .filter(n => n.type === 'territory_assignment' && n.ref_id)
        .map(n => n.ref_id as string);
      
      let assignmentConversationMap: Record<string, string> = {};
      if (territoryAssignmentRefIds.length > 0) {
        const { data: assignments } = await supabase
          .from("territory_assignments")
          .select("id, conversation_id")
          .in("id", territoryAssignmentRefIds);
        
        for (const a of assignments || []) {
          if (a.conversation_id) {
            assignmentConversationMap[a.id] = a.conversation_id;
          }
        }
      }

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
        } else if (notif.type === 'territory_assignment' && notif.ref_id) {
          // Territory assignment pending - link to the conversation where they can accept/decline
          const conversationId = assignmentConversationMap[notif.ref_id];
          link = conversationId ? `/messages/${conversationId}` : '/messages';
        } else if (notif.type === 'territory_assignment_accepted' || notif.type === 'territory_assignment_declined') {
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
        } else if (
          notif.type.includes('alert') || 
          notif.type.includes('working_terms') || 
          notif.type === 'admin_message' ||
          notif.type === 'territory_assignment' ||
          notif.type === 'territory_assignment_accepted' ||
          notif.type === 'territory_assignment_declined'
        ) {
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
          metadata: notif.type === 'territory_assignment' ? { assignmentId: notif.ref_id } : undefined,
        });
      }

      // 3. Get new opportunities for reps (recent seeking coverage posts matching coverage)
      if (isRep) {
        // First, get the rep's coverage areas with inspection types AND base_price for rate matching
        const { data: repCoverage } = await supabase
          .from("rep_coverage_areas")
          .select(`
            state_code, county_id, covers_entire_state, inspection_types, base_price,
            us_counties:county_id(county_name)
          `)
          .eq("user_id", userId);

        // Store coverage data for use in handleExpressInterest
        const normalizedCoverage = (repCoverage || []).map(c => ({
          state_code: c.state_code,
          county_id: c.county_id,
          county_name: (c.us_counties as { county_name: string } | null)?.county_name || null,
          covers_entire_state: c.covers_entire_state,
          base_price: c.base_price,
        }));
        setRepCoverageData(normalizedCoverage);

        // Also get rep's profile-level info for Coverage Snapshot
        const { data: repProfile } = await supabase
          .from("rep_profile")
          .select("id, user_id, city, state, zip_code, systems_used, inspection_types, is_accepting_new_vendors, willing_to_travel_out_of_state")
          .eq("user_id", userId)
          .single();

        // Store rep profile ID and data for pending opportunities loading and Coverage Snapshot
        if (repProfile) {
          setRepProfileId(repProfile.id);
          setRepProfileData({
            user_id: repProfile.user_id,
            city: repProfile.city,
            state: repProfile.state,
            zip_code: repProfile.zip_code,
            systems_used: repProfile.systems_used,
            inspection_types: repProfile.inspection_types,
            is_accepting_new_vendors: repProfile.is_accepting_new_vendors,
            willing_to_travel_out_of_state: repProfile.willing_to_travel_out_of_state,
          });
        }

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
          .select(`
            id, title, state_code, county_id, covers_entire_state, created_at, 
            pay_min, pay_max, inspection_type_ids, description, vendor_id,
            us_counties:county_id(county_name)
          `)
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
          // Get rate match label for this opportunity
          const matchingCoverage = (repCoverage || []).find(c => {
            if (c.state_code !== opp.state_code) return false;
            if (opp.covers_entire_state || c.covers_entire_state) return true;
            if (opp.county_id && c.county_id) return opp.county_id === c.county_id;
            return !opp.county_id;
          });
          const repBaseRate = matchingCoverage?.base_price;
          const rateLabel = getRelativeRateMatchLabel(repBaseRate, opp.pay_min, opp.pay_max);
          const rateLabelText = getRateMatchStatusText(rateLabel);
          
          // Build location display
          const countyData = opp.us_counties as { county_name: string } | null;
          const countyName = countyData?.county_name || null;
          const location = countyName 
            ? `${countyName}, ${opp.state_code}`
            : opp.state_code || 'Location TBD';
          
          // Get description snippet (first 100 chars)
          const descSnippet = opp.description 
            ? (opp.description.length > 100 ? opp.description.substring(0, 100) + '...' : opp.description)
            : '';

          items.push({
            id: `opp-${opp.id}`,
            type: 'opportunity',
            title: opp.title,
            description: `${location} · ${rateLabelText.label}`,
            timestamp: opp.created_at,
            isUnread: true,
            link: `/rep/seeking-coverage/${opp.id}`,
            metadata: {
              postId: opp.id,
              isNew: true,
              vendorId: opp.vendor_id,
              stateCode: opp.state_code,
              countyName,
              description: descSnippet,
              rateLabel: rateLabelText.label,
              payMin: opp.pay_min,
              payMax: opp.pay_max,
            } as OpportunityMetadata,
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

  const getFilterDescription = (filter: ActivityFilter): string => {
    switch (filter) {
      case 'all':
        return 'This view shows every alert, opportunity, and update in one list.';
      case 'alerts':
        return 'Alerts are time-sensitive items or things that may need a response from you, like coverage & pricing requests, working terms changes, or office/network alerts.';
      case 'opportunities':
        return 'These are posts from vendors looking for help in your work areas. New opportunities appear first, followed by opportunities you\'ve already applied to.';
      case 'updates':
        return "Updates keep you in the loop on things that usually don't need a response, like ClearMarket announcements, FAQ changes, and comments on your posts.";
    }
  };

  const handleExpressInterest = async (postId: string, metadata?: OpportunityMetadata) => {
    if (!repProfileId || !repProfileData || !userId) return;
    
    setExpressingInterest(postId);
    
    try {
      // Find the opportunity item to get vendor info
      const oppItem = feedItems.find(item => item.id === `opp-${postId}`);
      const oppMeta = (oppItem?.metadata as OpportunityMetadata) || metadata;
      
      if (!oppMeta?.vendorId) {
        // Fallback: fetch the post to get vendor_id
        const { data: post } = await supabase
          .from("seeking_coverage_posts")
          .select("vendor_id, title, state_code, county_id, us_counties:county_id(county_name)")
          .eq("id", postId)
          .single();
          
        if (!post) {
          toast.error("Could not find this opportunity");
          return;
        }
        
        // Use this post data
        const countyData = post.us_counties as { county_name: string } | null;
        await expressInterestWithSnapshot(
          postId, 
          post.vendor_id, 
          post.title,
          post.state_code || null,
          countyData?.county_name || null
        );
      } else {
        // Find the post title from the feed item
        const title = oppItem?.title || '';
        await expressInterestWithSnapshot(
          postId, 
          oppMeta.vendorId, 
          title,
          oppMeta.stateCode,
          oppMeta.countyName
        );
      }
      
      toast.success("Interest sent with your coverage details!");
      
      // Reload feed and pending opportunities
      loadFeed();
      if (activityFilter === 'opportunities') {
        loadPendingOpportunities();
      }
    } catch (error: any) {
      console.error("Error expressing interest:", error);
      toast.error("Failed to express interest. Please try again.");
    } finally {
      setExpressingInterest(null);
    }
  };

  const expressInterestWithSnapshot = async (
    postId: string,
    vendorId: string,
    postTitle: string,
    stateCode: string | null,
    countyName: string | null
  ) => {
    if (!repProfileId || !repProfileData || !userId) return;
    
    // 1. Mark interest (upsert to avoid duplicates)
    const { error: interestError } = await supabase
      .from("rep_interest")
      .upsert(
        {
          post_id: postId,
          rep_id: repProfileId,
          status: "interested",
        },
        { onConflict: "post_id,rep_id" }
      );

    if (interestError) throw interestError;

    // 2. Create or get existing conversation
    const { id: conversationId, error: convError } = await getOrCreateConversation(
      userId,
      vendorId,
      { type: "seeking_coverage", postId }
    );

    if (convError || !conversationId) {
      throw new Error(convError || "Failed to create conversation");
    }

    // 3. Find matching coverage for this post
    const matchingCoverage = repCoverageData.find(c => {
      if (c.state_code !== stateCode) return false;
      if (c.covers_entire_state) return true;
      if (countyName && c.county_name === countyName) return true;
      return !countyName;
    });

    // 4. Build the Coverage Snapshot message
    const locationDisplay = countyName 
      ? `${countyName}, ${stateCode}`
      : stateCode || "Location not specified";

    const lines: string[] = [];
    
    // Rep's location
    const repLocation = [repProfileData.city, repProfileData.state, repProfileData.zip_code]
      .filter(Boolean)
      .join(", ");
    if (repLocation) {
      lines.push(`Location: ${repLocation}`);
    }

    // Systems
    if (repProfileData.systems_used?.length) {
      lines.push(`Systems I Use: ${repProfileData.systems_used.join(", ")}`);
    }

    // Inspection Types
    if (repProfileData.inspection_types?.length) {
      lines.push(`Inspection Types: ${repProfileData.inspection_types.join(", ")}`);
    }

    // Coverage for this request
    if (matchingCoverage) {
      const coverageArea = matchingCoverage.county_name 
        ? `${matchingCoverage.county_name}, ${matchingCoverage.state_code}`
        : `${matchingCoverage.state_code} (entire state)`;
      lines.push(`Coverage for this request: ${coverageArea}`);
      
      // Base rate
      if (matchingCoverage.base_price !== null) {
        lines.push(`Base Rate in this area: $${matchingCoverage.base_price}`);
      } else {
        lines.push(`Base Rate in this area: Not set`);
      }
    }

    // Availability preferences
    lines.push(`Accepting New Vendors: ${repProfileData.is_accepting_new_vendors !== false ? "Yes" : "No"}`);
    lines.push(`Willing to Travel Out of State: ${repProfileData.willing_to_travel_out_of_state ? "Yes" : "No"}`);

    let messageBody = `I'm interested in your request: ${postTitle} – ${locationDisplay}.\n\n`;
    messageBody += `Coverage Snapshot:\n${lines.map(line => `• ${line}`).join("\n")}`;

    // 5. Send the message
    const { error: msgError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      recipient_id: vendorId,
      subject: "Interest in Seeking Coverage Post",
      body: messageBody,
    });

    if (msgError) throw msgError;

    // 6. Update conversation last_message
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: messageBody.substring(0, 100) + (messageBody.length > 100 ? "..." : ""),
        hidden_for_one: false,
        hidden_for_two: false,
      })
      .eq("id", conversationId);

    // 7. Create notification for vendor
    await createNotification(
      supabase,
      vendorId,
      "seeking_coverage_interest",
      "Field Rep interested in your coverage request",
      `A field rep has expressed interest in "${postTitle}" and sent you a message with their coverage details.`,
      conversationId
    );
  };

  const handleNotInterestedConfirm = async (reason?: string) => {
    if (!repProfileId || !notInterestedPost) return;
    
    try {
      const { error } = await supabase
        .from("rep_interest")
        .insert({
          rep_id: repProfileId,
          post_id: notInterestedPost.id,
          status: "not_interested",
          not_interested_reason: reason || null
        });

      if (error) throw error;
      
      setNotInterestedPost(null);
      loadFeed();
    } catch (error) {
      console.error("Error marking not interested:", error);
    }
  };

  const getStatusLabel = (status: PendingOpportunity['status']) => {
    switch (status) {
      case 'interested':
        return 'Interest sent – waiting on vendor';
      case 'in_conversation':
        return 'In conversation';
      case 'assignment_pending':
        return 'Assignment pending';
    }
  };

  const getStatusColor = (status: PendingOpportunity['status']) => {
    switch (status) {
      case 'interested':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400';
      case 'in_conversation':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400';
      case 'assignment_pending':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400';
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

      {/* Special two-section layout for Opportunities filter when user is a rep */}
      {activityFilter === 'opportunities' && isRep ? (
        <div className="space-y-6">
          {/* Section 1: New Opportunities */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-foreground">New opportunities</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            
            {filteredItems.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    No new opportunities in your coverage area yet. Try expanding your coverage or check back later.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => {
                  const oppMeta = item.metadata as OpportunityMetadata | undefined;
                  const postId = oppMeta?.postId || item.id.replace('opp-', '');
                  const isExpressing = expressingInterest === postId;
                  
                  return (
                    <Card 
                      key={item.id} 
                      className="bg-card border-border border-l-2 border-l-primary"
                    >
                      <CardContent className="py-4 px-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${getTypeColor(item.type)} flex-shrink-0 mt-0.5`}>
                            {getIcon(item.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Title row */}
                            <div className="flex items-center gap-2 mb-1">
                              <span 
                                className="text-sm font-semibold text-foreground cursor-pointer hover:underline"
                                onClick={() => item.link && navigate(item.link)}
                              >
                                {item.title}
                              </span>
                              <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400">
                                New
                              </Badge>
                            </div>
                            
                            {/* Location + Rate match label */}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>{item.description}</span>
                            </div>
                            
                            {/* Description snippet if available */}
                            {oppMeta?.description && (
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-2 bg-muted/30 p-2 rounded-md italic">
                                "{oppMeta.description}"
                              </p>
                            )}
                            
                            {/* Action buttons */}
                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm" 
                                disabled={isExpressing}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExpressInterest(postId, oppMeta);
                                }}
                              >
                                {isExpressing ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                    Sending...
                                  </>
                                ) : (
                                  "I'm interested"
                                )}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                disabled={isExpressing}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNotInterestedPost({ id: postId, title: item.title });
                                }}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Not interested
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Pending Opportunities (Table) */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-foreground">Pending opportunities</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              These are opportunities you've applied to and are waiting on vendor review.
            </p>
            
            {loadingPending ? (
              <Card className="animate-pulse">
                <CardContent className="py-4">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </CardContent>
              </Card>
            ) : pendingOpportunities.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-4 text-center">
                  <p className="text-muted-foreground text-sm">
                    You haven't applied to any opportunities yet. When you click "I'm interested", they'll appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Opportunity</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Interest Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingOpportunities.map((opp) => (
                      <TableRow key={opp.id}>
                        <TableCell>
                          <span 
                            className="font-medium text-foreground hover:underline cursor-pointer"
                            onClick={() => navigate(`/rep/seeking-coverage/${opp.postId}`)}
                          >
                            {opp.postTitle}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {opp.vendorName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {opp.location}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getStatusColor(opp.status)}`}
                          >
                            {getStatusLabel(opp.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(parseISO(opp.interestDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {opp.conversationId && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/messages/${opp.conversationId}`)}
                                title="Open conversation"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/rep/seeking-coverage/${opp.postId}`)}
                              title="View opportunity"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Standard grouped-by-date view for other filters */
        <>
          {filteredItems.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-6 text-center">
                <p className="text-muted-foreground text-sm">
                  {`No ${activityFilter === 'all' ? 'activity' : activityFilter} to show.`}
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
                                <div className="flex items-center justify-between mt-2">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {formatDistanceToNow(parseISO(item.timestamp), { addSuffix: true })}
                                  </div>
                                  {(item.metadata as Record<string, unknown>)?.assignmentId && (
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        item.link && navigate(item.link);
                                      }}
                                    >
                                      Review assignment
                                    </Button>
                                  )}
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
        </>
      )}
      
      <div className="pt-2 text-center">
        <Button variant="ghost" size="sm" onClick={() => navigate('/notifications')}>
          View all activity
        </Button>
      </div>

      {/* Not Interested Dialog */}
      {notInterestedPost && repProfileId && (
        <NotInterestedDialog
          open={!!notInterestedPost}
          onOpenChange={(open) => !open && setNotInterestedPost(null)}
          postId={notInterestedPost.id}
          postTitle={notInterestedPost.title}
          repProfileId={repProfileId}
          onConfirmed={() => {
            setNotInterestedPost(null);
            loadFeed();
          }}
        />
      )}
    </div>
  );
}
