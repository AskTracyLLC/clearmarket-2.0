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
 * - Sets realtime auth token to ensure RLS-filtered events are delivered
 * - Uses refs for sound callbacks to prevent channel churn
 * - Respects user's sound_enabled preference
 * - Throttles sounds to prevent rapid-fire notifications
 * - Does not play sounds for messages sent by the current user
 */
export function GlobalMessageListener() {
  const { user } = useAuth();
  const { effectiveUserId } = useMimic();
  const { playNotificationSound, soundEnabled } = useNotificationSound();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // The user ID to listen for (supports mimic mode)
  const targetUserId = effectiveUserId || user?.id;

  // Use refs so the channel callback always has current values without recreating the channel
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const playRef = useRef<() => void>(() => {});
  useEffect(() => {
    playRef.current = playNotificationSound;
  }, [playNotificationSound]);

  // Set realtime auth token whenever session changes
  useEffect(() => {
    let isMounted = true;

    async function initRealtimeAuth() {
      const { data, error } = await supabase.auth.getSession();
      
      if (!isMounted) return;
      
      if (error) {
        console.warn("[GML] error fetching session for realtime:", error.message);
        return;
      }

      const token = data.session?.access_token;
      if (token) {
        supabase.realtime.setAuth(token);
        console.log("[GML] realtime auth set");
      } else {
        console.warn("[GML] no session token for realtime");
      }
    }

    initRealtimeAuth();

    return () => {
      isMounted = false;
    };
  }, [user?.id]); // Re-run when user changes

  // Subscribe to messages - only depends on targetUserId
  useEffect(() => {
    if (!targetUserId) {
      console.log("[GML] No targetUserId, skipping subscription");
      return;
    }

    // Clean up any existing subscription
    if (channelRef.current) {
      console.log("[GML] Cleaning up existing channel");
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    console.log("[GML] Creating channel for user:", targetUserId);

    // Create a new channel with a unique name for this user
    const channel = supabase
      .channel(`global-messages-${targetUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          // TEMP: no filter to test if realtime works at all
        },
        (payload) => {
          // Log FIRST before any conditions
          console.log("[GML] INSERT payload received:", payload);
          
          const msg = payload.new as {
            id: string;
            sender_id: string;
            recipient_id: string;
          };

          console.log("[GML] message check:", {
            sender_id: msg.sender_id,
            recipient_id: msg.recipient_id,
            currentUserId: targetUserId,
          });

          // Don't play sound for messages sent by the current user
          if (msg.sender_id === targetUserId) {
            console.log("[GML] Skipping - sender is self");
            return;
          }

          // Play sound if enabled
          if (soundEnabledRef.current) {
            console.log("[GML] Playing notification sound");
            playRef.current();
          } else {
            console.log("[GML] Sound disabled, skipping");
          }
        }
      )
      .subscribe((status, err) => {
        console.log("[GML] subscribe status:", status, err);
        if (status === "CHANNEL_ERROR") {
          console.error("[GML] Failed to subscribe to messages channel:", err);
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount or targetUserId change
    return () => {
      if (channelRef.current) {
        console.log("[GML] Unmounting - removing channel");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [targetUserId]); // Only recreate channel when targetUserId changes

  // This component renders nothing - it's purely for side effects
  return null;
}
