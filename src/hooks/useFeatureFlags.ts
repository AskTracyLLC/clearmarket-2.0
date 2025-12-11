import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  is_paid: boolean;
  beta_note: string | null;
  created_at: string;
  updated_at: string;
}

export type FeatureFlagsMap = Record<string, FeatureFlag>;

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlagsMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFlags();
  }, []);

  const loadFlags = async () => {
    try {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("*");

      if (error) throw error;

      const flagsMap: FeatureFlagsMap = {};
      (data || []).forEach((flag) => {
        flagsMap[flag.key] = flag as FeatureFlag;
      });
      setFlags(flagsMap);
    } catch (error) {
      console.error("Error loading feature flags:", error);
    } finally {
      setLoading(false);
    }
  };

  const isEnabled = (key: string): boolean => {
    return !!flags[key]?.is_enabled;
  };

  const isPaid = (key: string): boolean => {
    return !!flags[key]?.is_paid;
  };

  const getFlag = (key: string): FeatureFlag | null => {
    return flags[key] || null;
  };

  return {
    flags,
    loading,
    isEnabled,
    isPaid,
    getFlag,
    refetch: loadFlags,
  };
}
