import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { useActiveRole } from "@/hooks/useActiveRole";
import { supabase } from "@/integrations/supabase/client";

interface SectionCounts {
  loading: boolean;
  unreadMessages: number;
  openSupportTickets: number;
  adminOpenTickets: number;
  adminOpenReports: number;
  communityUnread: number;
  networkUnread: number;
  // Vendor-specific: posts with interested reps
  vendorPostsWithInterest: number;
  vendorTotalInterestedReps: number;
}

export function useSectionCounts(): SectionCounts {
  const { user, loading: authLoading } = useAuth();
  const { loading: permsLoading, permissions } = useStaffPermissions();
  const { effectiveRole, loading: roleLoading } = useActiveRole();
  const [loading, setLoading] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [openSupportTickets, setOpenSupportTickets] = useState(0);
  const [adminOpenTickets, setAdminOpenTickets] = useState(0);
  const [adminOpenReports, setAdminOpenReports] = useState(0);
  const [communityUnread, setCommunityUnread] = useState(0);
  const [networkUnread, setNetworkUnread] = useState(0);
  const [vendorPostsWithInterest, setVendorPostsWithInterest] = useState(0);
  const [vendorTotalInterestedReps, setVendorTotalInterestedReps] = useState(0);

  useEffect(() => {
    if (authLoading || permsLoading || roleLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    loadCounts();
  }, [user, authLoading, permsLoading, roleLoading, permissions, effectiveRole]);

  async function loadCounts() {
    if (!user) return;

    try {
      // Count unread messages (distinct conversations with unread messages)
      const { data: unreadData } = await supabase
        .from("messages")
        .select("conversation_id")
        .eq("recipient_id", user.id)
        .eq("read", false);

      const uniqueConversations = new Set(
        (unreadData || []).map((m) => m.conversation_id)
      );
      setUnreadMessages(uniqueConversations.size);

      // Count open support tickets for the current user
      const { count: userTicketCount } = await supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["open", "in_progress"]);

      setOpenSupportTickets(userTicketCount || 0);

      // Admin open tickets (for staff with support permissions)
      if (permissions.canViewSupportQueue) {
        const { count: adminTicketCount } = await supabase
          .from("support_tickets")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "in_progress"]);

        setAdminOpenTickets(adminTicketCount || 0);
      } else {
        setAdminOpenTickets(0);
      }

      // Admin open reports (for staff with moderation permissions)
      if (permissions.canViewModeration) {
        const { count: reportCount } = await supabase
          .from("user_reports")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "under_review"]);

        setAdminOpenReports(reportCount || 0);
      } else {
        setAdminOpenReports(0);
      }

      // Community-related unread notifications
      const { count: communityCount } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
        .in("type", ["community_comment_on_post", "community_post_resolved"]);

      setCommunityUnread(communityCount || 0);

      // Network-related unread notifications
      const { count: networkCount } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
        .in("type", ["vendor_network_alert", "vendor_alert", "new_coverage_opportunity"]);

      setNetworkUnread(networkCount || 0);

      // Vendor-specific: posts with interested reps (only if acting as vendor)
      if (effectiveRole === "vendor") {
        // Get all active seeking coverage posts for this vendor
        const { data: posts } = await supabase
          .from("seeking_coverage_posts")
          .select("id")
          .eq("vendor_id", user.id)
          .is("deleted_at", null);

        if (posts && posts.length > 0) {
          const postIds = posts.map((p) => p.id);
          
          // Get all interested reps (not declined) for these posts
          const { data: interestData } = await supabase
            .from("rep_interest")
            .select("post_id")
            .in("post_id", postIds)
            .neq("status", "declined");

          if (interestData && interestData.length > 0) {
            // Count unique posts with interest
            const postsWithInterestSet = new Set(interestData.map((i) => i.post_id));
            setVendorPostsWithInterest(postsWithInterestSet.size);
            // Total interested reps
            setVendorTotalInterestedReps(interestData.length);
          } else {
            setVendorPostsWithInterest(0);
            setVendorTotalInterestedReps(0);
          }
        } else {
          setVendorPostsWithInterest(0);
          setVendorTotalInterestedReps(0);
        }
      } else {
        setVendorPostsWithInterest(0);
        setVendorTotalInterestedReps(0);
      }
    } catch (error) {
      console.error("Error loading section counts:", error);
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    unreadMessages,
    openSupportTickets,
    adminOpenTickets,
    adminOpenReports,
    communityUnread,
    networkUnread,
    vendorPostsWithInterest,
    vendorTotalInterestedReps,
  };
}
