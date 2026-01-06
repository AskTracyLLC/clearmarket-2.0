import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMimic } from "@/hooks/useMimic";
import { useNotificationSound } from "@/hooks/useNotificationSound";

/**
 * Global listener for new messages across the app.
 * Plays notification sounds when the current user receives a new message.
 * 
 * Features:
 * - Uses realtime filter to only receive messages for the current user
 * - Respects user's sound_enabled preference
 * - Throttles sounds to prevent rapid-fire notifications
 * - Does not play sounds for messages sent by the current user
 */
export function GlobalMessageListener() {
  const { user } = useAuth();
  const { effectiveUserId } = useMimic();
  const { playNotificationSound } = useNotificationSound();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // The user ID to listen for (supports mimic mode)
  const targetUserId = effectiveUserId || user?.id;

  useEffect(() => {
    if (!targetUserId) return;

    // Clean up any existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create a new channel with a unique name for this user
    const channel = supabase
      .channel(`global-messages-${targetUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${targetUserId}`,
        },
        (payload) => {
          const newMessage = payload.new as {
            id: string;
            sender_id: string;
            recipient_id: string;
          };

          // Double-check: only play sound if this message is for us
          // and not sent by us (shouldn't happen with the filter, but safety check)
          if (
            newMessage.recipient_id === targetUserId &&
            newMessage.sender_id !== targetUserId
          ) {
            playNotificationSound();
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("GlobalMessageListener: Failed to subscribe to messages channel");
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount or user change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [targetUserId, playNotificationSound]);

  // This component renders nothing - it's purely for side effects
  return null;
}
