import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CommunityTab } from "@/components/CommunityTab";
import { NetworkAlertsFeed } from "@/components/NetworkAlertsFeed";
import { CountBadge } from "@/components/CountBadge";
import { PageHeader } from "@/components/PageHeader";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { Users, Megaphone } from "lucide-react";

const CommunityBoard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [isVendor, setIsVendor] = useState(false);
  const [isRep, setIsRep] = useState(false);
  const [communityUnread, setCommunityUnread] = useState(0);
  const [networkUnread, setNetworkUnread] = useState(0);

  // Get tab from URL or default to "community"
  const activeTab = searchParams.get("tab") || "community";

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      loadUserProfile();
      loadUnreadCounts();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_vendor_admin, is_fieldrep")
      .eq("id", user.id)
      .single();

    if (profile) {
      setIsVendor(profile.is_vendor_admin);
      setIsRep(profile.is_fieldrep);
    }
  };

  const loadUnreadCounts = async () => {
    if (!user) return;

    try {
      // Community-related unread notifications
      const { count: communityCount } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
        .in("type", ["community_comment_on_post", "community_post_resolved"]);

      setCommunityUnread(communityCount || 0);

      // Network-related unread notifications
      const { count: networkCount } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
        .in("type", ["vendor_network_alert", "vendor_alert", "new_coverage_opportunity"]);

      setNetworkUnread(networkCount || 0);
    } catch (error) {
      console.error("Error loading unread counts:", error);
    }
  };

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <PageHeader
          title="Community"
          subtitle="Community posts from the industry, plus alerts from your own network."
          showBackToDashboard
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="community" className="gap-2">
              <Users className="w-4 h-4" />
              Community
              {communityUnread > 0 && <CountBadge count={communityUnread} />}
            </TabsTrigger>
            <TabsTrigger value="network" className="gap-2">
              <Megaphone className="w-4 h-4" />
              Network & Alerts
              {networkUnread > 0 && <CountBadge count={networkUnread} />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="community">
            <CommunityTab userId={user.id} />
          </TabsContent>

          <TabsContent value="network">
            <NetworkAlertsFeed 
              userId={user.id} 
              isVendor={isVendor} 
              isRep={isRep} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </AuthenticatedLayout>
  );
};

export default CommunityBoard;
