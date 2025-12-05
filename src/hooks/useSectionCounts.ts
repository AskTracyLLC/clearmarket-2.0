import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";

interface SectionCounts {
  loading: boolean;
  unreadMessages: number;
  openSupportTickets: number;
  adminOpenTickets: number;
  adminOpenReports: number;
}

export function useSectionCounts(): SectionCounts {
  const { user, loading: authLoading } = useAuth();
  const { loading: permsLoading, permissions } = useStaffPermissions();
  const [loading, setLoading] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [openSupportTickets, setOpenSupportTickets] = useState(0);
  const [adminOpenTickets, setAdminOpenTickets] = useState(0);
  const [adminOpenReports, setAdminOpenReports] = useState(0);

  useEffect(() => {
    if (authLoading || permsLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    loadCounts();
  }, [user, authLoading, permsLoading, permissions]);

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
  };
}
