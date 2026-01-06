import { useRef, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook for playing notification sounds with user preference support.
 * Preloads the audio file and respects the user's sound_enabled preference.
 * 
 * Includes "arming" behavior for autoplay restrictions - audio is armed
 * after first user interaction (pointerdown/keydown).
 */
export function useNotificationSound() {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isArmed, setIsArmed] = useState(false);
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

    // Arm audio after first user interaction to satisfy autoplay restrictions
    const armAudio = () => {
      if (!isArmed && audioRef.current) {
        // Play and immediately pause to "unlock" audio context
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
          audioRef.current!.currentTime = 0;
          setIsArmed(true);
        }).catch(() => {
          // Still mark as armed attempt - browser may allow later
          setIsArmed(true);
        });
      }
    };

    // Listen for first user interaction
    document.addEventListener("pointerdown", armAudio, { once: true });
    document.addEventListener("keydown", armAudio, { once: true });

    return () => {
      document.removeEventListener("pointerdown", armAudio);
      document.removeEventListener("keydown", armAudio);
    };
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
      // If no row exists, default to true (already set in useState)
    } catch (error) {
      console.error("Error loading sound preference:", error);
    }
  };

  /**
   * Play the notification sound if enabled.
   * Includes throttling to prevent rapid-fire sounds (min 800ms between plays).
   */
  const playNotificationSound = useCallback(() => {
    const now = Date.now();
    const timeSinceLastPlay = now - lastPlayedRef.current;
    const THROTTLE_MS = 800; // Minimum 800ms between sounds

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
   * Play a test sound (bypasses throttling, respects enabled state).
   * This is used in NotificationSettings to let users preview the sound.
   */
  const playTestSound = useCallback(() => {
    if (!audioRef.current) return;

    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {
      // Silent catch - user will see no sound plays
    });
  }, []);

  /**
   * Update the sound preference in state (for optimistic UI updates).
   * The actual DB update should be handled by NotificationSettings.
   */
  const updateSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabled(enabled);
  }, []);

  return {
    playNotificationSound,
    playTestSound,
    soundEnabled,
    isArmed,
    updateSoundEnabled,
    refetchPreference: loadSoundPreference,
  };
}
