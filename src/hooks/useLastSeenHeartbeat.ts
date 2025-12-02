import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY = "cm_last_seen_ping";

/**
 * Auto-updates user's last_seen_at timestamp in profiles table.
 * Throttles to max once per 15 minutes per session using localStorage.
 */
export function useLastSeenHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const updateLastSeen = async () => {
      const now = Date.now();
      const lastPing = localStorage.getItem(STORAGE_KEY);
      const lastPingTime = lastPing ? parseInt(lastPing, 10) : 0;

      // Only update if 15+ minutes have passed since last ping
      if (now - lastPingTime < HEARTBEAT_INTERVAL_MS) {
        return;
      }

      try {
        await supabase
          .from("profiles")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", user.id);

        localStorage.setItem(STORAGE_KEY, now.toString());
      } catch (error) {
        console.error("Error updating last_seen_at:", error);
      }
    };

    // Update immediately on mount
    updateLastSeen();
  }, [user]);
}
