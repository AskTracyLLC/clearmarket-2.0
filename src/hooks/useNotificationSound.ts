import { useRef, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook for playing notification sounds with user preference support.
 * Preloads the audio file and respects the user's sound_enabled preference.
 */
export function useNotificationSound() {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastPlayedRef = useRef<number>(0);

  // Preload audio and fetch user preference
  useEffect(() => {
    // Preload the notification sound
    audioRef.current = new Audio("/sounds/notification.mp3");
    audioRef.current.volume = 0.5;
    audioRef.current.preload = "auto";

    // Load user preference
    if (user?.id) {
      loadSoundPreference();
    }
  }, [user?.id]);

  const loadSoundPreference = async () => {
    if (!user?.id) return;

    try {
      const { data } = await supabase
        .from("notification_preferences")
        .select("sound_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data !== null) {
        setSoundEnabled(data.sound_enabled ?? true);
      }
    } catch (error) {
      console.error("Error loading sound preference:", error);
    }
  };

  /**
   * Play the notification sound if enabled.
   * Includes throttling to prevent rapid-fire sounds (min 1.5s between plays).
   */
  const playNotificationSound = useCallback(() => {
    const now = Date.now();
    const timeSinceLastPlay = now - lastPlayedRef.current;
    const THROTTLE_MS = 1500; // Minimum 1.5 seconds between sounds

    if (!soundEnabled || !audioRef.current || timeSinceLastPlay < THROTTLE_MS) {
      return;
    }

    lastPlayedRef.current = now;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {
      // Handle autoplay restrictions silently - browser may block until user interaction
    });
  }, [soundEnabled]);

  /**
   * Update the sound preference in state (for optimistic UI updates).
   * The actual DB update should be handled by NotificationSettings.
   */
  const updateSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabled(enabled);
  }, []);

  return {
    playNotificationSound,
    soundEnabled,
    updateSoundEnabled,
    refetchPreference: loadSoundPreference,
  };
}
