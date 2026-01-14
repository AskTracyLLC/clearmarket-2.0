import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface MimickedUser {
  id: string;
  full_name: string | null;
  email: string;
  is_fieldrep: boolean;
  is_vendor_admin: boolean;
  is_vendor_staff: boolean;
}

interface MimicContextType {
  mimickedUser: MimickedUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  startMimic: (userId: string) => Promise<void>;
  stopMimic: () => void;
  /** Returns the effective user ID - mimicked user if in mimic mode, otherwise the authenticated user */
  effectiveUserId: string | null;
}

const MimicContext = createContext<MimicContextType | undefined>(undefined);

const MIMIC_STORAGE_KEY = "clearmarket_mimic_user_id";

/** Clear mimic state from storage - exported for use in auth signOut */
export function clearMimicState() {
  sessionStorage.removeItem(MIMIC_STORAGE_KEY);
}

export function MimicProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mimickedUser, setMimickedUser] = useState<MimickedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastCheckedUserId, setLastCheckedUserId] = useState<string | null>(null);

  // Check if current user is admin
  const checkAdminStatus = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .single();

      if (error || !data) {
        console.error("Error checking admin status:", error);
        return false;
      }

      return data.is_admin === true;
    } catch (err) {
      console.error("Error checking admin status:", err);
      return false;
    }
  }, []);

  const loadMimickedUser = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, is_fieldrep, is_vendor_admin, is_vendor_staff")
        .eq("id", userId)
        .single();

      if (error || !data) {
        console.error("Error loading mimicked user:", error);
        clearMimicState();
        setMimickedUser(null);
      } else {
        setMimickedUser({
          id: data.id,
          full_name: data.full_name,
          email: data.email,
          is_fieldrep: data.is_fieldrep,
          is_vendor_admin: data.is_vendor_admin,
          is_vendor_staff: data.is_vendor_staff ?? false,
        });
      }
    } catch (err) {
      console.error("Error loading mimicked user:", err);
      clearMimicState();
      setMimickedUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // CRITICAL: Validate admin status and clear mimic state for non-admins
  useEffect(() => {
    const initializeMimicState = async () => {
      // If no user is logged in, clear everything
      if (!user?.id) {
        clearMimicState();
        setMimickedUser(null);
        setIsAdmin(false);
        setLastCheckedUserId(null);
        setIsLoading(false);
        return;
      }

      // If user changed, we need to re-validate
      if (user.id !== lastCheckedUserId) {
        setLastCheckedUserId(user.id);
        setIsLoading(true);

        // Check if current user is an admin
        const adminStatus = await checkAdminStatus(user.id);
        setIsAdmin(adminStatus);

        // SECURITY: If not admin, forcefully clear any mimic state
        if (!adminStatus) {
          clearMimicState();
          setMimickedUser(null);
          setIsLoading(false);
          return;
        }

        // User is admin - check for stored mimic session
        const storedUserId = sessionStorage.getItem(MIMIC_STORAGE_KEY);
        if (storedUserId) {
          await loadMimickedUser(storedUserId);
        } else {
          setIsLoading(false);
        }
      }
    };

    initializeMimicState();
  }, [user?.id, lastCheckedUserId, checkAdminStatus, loadMimickedUser]);

  const startMimic = async (userId: string) => {
    // SECURITY: Only allow admins to start mimic
    if (!isAdmin) {
      console.error("Attempted to start mimic mode without admin privileges");
      return;
    }
    sessionStorage.setItem(MIMIC_STORAGE_KEY, userId);
    await loadMimickedUser(userId);
  };

  const stopMimic = () => {
    clearMimicState();
    setMimickedUser(null);
  };

  // Effective user ID - mimicked user takes precedence (only if admin)
  const effectiveUserId = (isAdmin && mimickedUser?.id) || user?.id || null;

  return (
    <MimicContext.Provider value={{ mimickedUser, isLoading, isAdmin, startMimic, stopMimic, effectiveUserId }}>
      {children}
    </MimicContext.Provider>
  );
}

export function useMimic() {
  const context = useContext(MimicContext);
  if (context === undefined) {
    throw new Error("useMimic must be used within a MimicProvider");
  }
  return context;
}
