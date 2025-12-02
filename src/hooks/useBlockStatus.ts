import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface BlockStatus {
  isBlocked: boolean;      // current user is blocked BY target
  hasBlocked: boolean;     // current user HAS blocked target
  anyBlock: boolean;       // isBlocked || hasBlocked
  loading: boolean;
}

/**
 * Hook to check bidirectional block status between current user and target user.
 * Reuses existing user_blocks table.
 */
export function useBlockStatus(targetUserId: string | null): BlockStatus {
  const { user } = useAuth();
  const [status, setStatus] = useState<BlockStatus>({
    isBlocked: false,
    hasBlocked: false,
    anyBlock: false,
    loading: true,
  });

  useEffect(() => {
    if (!user || !targetUserId || user.id === targetUserId) {
      setStatus({
        isBlocked: false,
        hasBlocked: false,
        anyBlock: false,
        loading: false,
      });
      return;
    }

    async function checkBlockStatus() {
      try {
        // Check both directions in a single query
        const { data, error } = await supabase
          .from("user_blocks")
          .select("blocker_user_id, blocked_user_id")
          .or(
            `and(blocker_user_id.eq.${user.id},blocked_user_id.eq.${targetUserId}),and(blocker_user_id.eq.${targetUserId},blocked_user_id.eq.${user.id})`
          );

        if (error) {
          console.error("Error checking block status:", error);
          setStatus(prev => ({ ...prev, loading: false }));
          return;
        }

        let hasBlocked = false;
        let isBlocked = false;

        for (const row of data || []) {
          if (row.blocker_user_id === user.id && row.blocked_user_id === targetUserId) {
            hasBlocked = true;
          }
          if (row.blocker_user_id === targetUserId && row.blocked_user_id === user.id) {
            isBlocked = true;
          }
        }

        setStatus({
          isBlocked,
          hasBlocked,
          anyBlock: isBlocked || hasBlocked,
          loading: false,
        });
      } catch (error) {
        console.error("Error in useBlockStatus:", error);
        setStatus(prev => ({ ...prev, loading: false }));
      }
    }

    checkBlockStatus();
  }, [user, targetUserId]);

  return status;
}
