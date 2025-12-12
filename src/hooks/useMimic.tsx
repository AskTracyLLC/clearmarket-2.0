import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface MimickedUser {
  id: string;
  full_name: string | null;
  email: string;
  is_fieldrep: boolean;
  is_vendor_admin: boolean;
}

interface MimicContextType {
  mimickedUser: MimickedUser | null;
  isLoading: boolean;
  startMimic: (userId: string) => Promise<void>;
  stopMimic: () => void;
  /** Returns the effective user ID - mimicked user if in mimic mode, otherwise the authenticated user */
  effectiveUserId: string | null;
}

const MimicContext = createContext<MimicContextType | undefined>(undefined);

const MIMIC_STORAGE_KEY = "clearmarket_mimic_user_id";

export function MimicProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mimickedUser, setMimickedUser] = useState<MimickedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check sessionStorage for existing mimic session
  useEffect(() => {
    const storedUserId = sessionStorage.getItem(MIMIC_STORAGE_KEY);
    if (storedUserId) {
      loadMimickedUser(storedUserId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadMimickedUser = async (userId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, is_fieldrep, is_vendor_admin")
        .eq("id", userId)
        .single();

      if (error || !data) {
        console.error("Error loading mimicked user:", error);
        sessionStorage.removeItem(MIMIC_STORAGE_KEY);
        setMimickedUser(null);
      } else {
        setMimickedUser({
          id: data.id,
          full_name: data.full_name,
          email: data.email,
          is_fieldrep: data.is_fieldrep,
          is_vendor_admin: data.is_vendor_admin,
        });
      }
    } catch (err) {
      console.error("Error loading mimicked user:", err);
      sessionStorage.removeItem(MIMIC_STORAGE_KEY);
      setMimickedUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const startMimic = async (userId: string) => {
    sessionStorage.setItem(MIMIC_STORAGE_KEY, userId);
    await loadMimickedUser(userId);
  };

  const stopMimic = () => {
    sessionStorage.removeItem(MIMIC_STORAGE_KEY);
    setMimickedUser(null);
  };

  // Effective user ID - mimicked user takes precedence
  const effectiveUserId = mimickedUser?.id || user?.id || null;

  return (
    <MimicContext.Provider value={{ mimickedUser, isLoading, startMimic, stopMimic, effectiveUserId }}>
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
