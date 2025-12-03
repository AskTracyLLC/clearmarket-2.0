import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  accountStatus: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  accountStatus: null,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const { toast } = useToast();

  // Check account status after user is set
  const checkAccountStatus = useCallback(async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_status')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        setAccountStatus(profile.account_status);
        
        // If account is not active, sign out the user
        if (profile.account_status !== 'active') {
          toast({
            title: "Account Deactivated",
            description: "Your ClearMarket account has been deactivated. Please contact support if you believe this is an error.",
            variant: "destructive",
          });
          
          // Sign out after a brief delay to show the toast
          setTimeout(async () => {
            await supabase.auth.signOut();
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error checking account status:', error);
    }
  }, [toast]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Check account status when user signs in
        if (session?.user) {
          setTimeout(() => {
            checkAccountStatus(session.user.id);
          }, 0);
        } else {
          setAccountStatus(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        setTimeout(() => {
          checkAccountStatus(session.user.id);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkAccountStatus]);

  return (
    <AuthContext.Provider value={{ user, session, loading, accountStatus }}>
      {children}
    </AuthContext.Provider>
  );
};
