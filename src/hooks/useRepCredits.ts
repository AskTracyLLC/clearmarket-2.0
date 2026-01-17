/**
 * useRepCredits Hook
 * 
 * Fetches and manages rep credit balance and transaction history from user_wallet + user_wallet_transactions.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMimic } from "@/hooks/useMimic";
import { useActiveRole } from "@/hooks/useActiveRole";

export interface RepWalletTransaction {
  id: string;
  user_id: string;
  actor_user_id: string | null;
  txn_type: string;
  delta: number;
  metadata: unknown;
  created_at: string;
}

export interface UseRepCreditsResult {
  balance: number | null;
  transactions: RepWalletTransaction[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useRepCredits(): UseRepCreditsResult {
  const { user } = useAuth();
  const { effectiveUserId } = useMimic();
  const { effectiveRole } = useActiveRole();

  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<RepWalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!effectiveUserId || effectiveRole !== "rep") {
      setBalance(null);
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch balance from user_wallet
      const { data: walletData, error: walletError } = await supabase
        .from("user_wallet")
        .select("credits")
        .eq("user_id", effectiveUserId)
        .maybeSingle();

      if (walletError) {
        console.error("Error fetching rep wallet:", walletError);
        setBalance(0);
      } else {
        setBalance(walletData?.credits ?? 0);
      }

      // Fetch recent transactions
      const { data: txData, error: txError } = await supabase
        .from("user_wallet_transactions")
        .select("*")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (txError) {
        console.error("Error fetching rep transactions:", txError);
        setTransactions([]);
      } else {
        setTransactions(txData || []);
      }
    } catch (err) {
      console.error("Error in useRepCredits:", err);
      setBalance(0);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, effectiveRole]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    balance,
    transactions,
    loading,
    refresh: fetchData,
  };
}
