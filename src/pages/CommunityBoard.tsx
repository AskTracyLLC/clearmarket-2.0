import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CommunityTab } from "@/components/CommunityTab";
import { NetworkAlertsFeed } from "@/components/NetworkAlertsFeed";
import { SavedPostsTab } from "@/components/SavedPostsTab";
import { CountBadge } from "@/components/CountBadge";
import { PageHeader } from "@/components/PageHeader";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { Users, Megaphone, Newspaper, Bookmark } from "lucide-react";
import { getSavedPostsCount } from "@/lib/postSaves";
import { communityCopy } from "@/copy/communityCopy";

const CommunityBoard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [isVendor, setIsVendor] = useState(false);
  const [isRep, setIsRep] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [communityUnread, setCommunityUnread] = useState(0);
  const [networkUnread, setNetworkUnread] = useState(0);
  const [announcementsUnread, setAnnouncementsUnread] = useState(0);
  const [savedCount, setSavedCount] = useState(0);

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
      .select("is_vendor_admin, is_fieldrep, is_admin")
      .eq("id", user.id)
      .single();

    if (profile) {
      setIsVendor(profile.is_vendor_admin);
      setIsRep(profile.is_fieldrep);
      setIsAdmin(profile.is_admin);
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

      // Announcements-related unread notifications
      const { count: announcementsCount } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
        .in("type", ["clearmarket_announcement"]);

      setAnnouncementsUnread(announcementsCount || 0);

      // Saved posts count
      const savedPostsCount = await getSavedPostsCount(user.id);
      setSavedCount(savedPostsCount);
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

  const getTabDescription = (tab: string): { line1: string; line2: string; line3?: string } => {
    switch (tab) {
      case 'community':
        return {
          line1: 'This is the main discussion space.',
          line2: 'Ask questions, share tips, and talk with other field reps and vendors.'
        };
      case 'network':
        return {
          line1: 'Use this area for time-sensitive network alerts.',
          line2: "Alerts are not public and no one can see who else is in your network.",
          line3: "When you post here, it's sent only to the vendors or field reps you're connected with, and they can't see each other."
        };
      case 'announcements':
        return {
          line1: 'Official updates from the ClearMarket team.',
          line2: 'New features, FAQs, release notes, and important system news will show here.'
        };
      case 'saved':
        return {
          line1: "Posts you've saved to revisit later.",
          line2: 'Only you can see the items in this list.'
        };
      default:
        return { line1: '', line2: '' };
    }
  };

  const tabDescription = getTabDescription(activeTab);

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <PageHeader
          title={communityCopy.main.sectionTitle}
          subtitle={communityCopy.main.sectionSubtitle}
          showBackToDashboard
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-4 flex-wrap h-auto gap-2">
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
            <TabsTrigger value="announcements" className="gap-2">
              <Newspaper className="w-4 h-4" />
              ClearMarket Announcements
              {announcementsUnread > 0 && <CountBadge count={announcementsUnread} />}
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-2">
              <Bookmark className="w-4 h-4" />
              Saved
              {savedCount > 0 && <CountBadge count={savedCount} />}
            </TabsTrigger>
          </TabsList>

          {/* Inline tab description */}
          <div className="mb-6 px-1">
            <p className="text-sm text-muted-foreground">{tabDescription.line1}</p>
            <p className="text-sm text-muted-foreground">{tabDescription.line2}</p>
            {tabDescription.line3 && <p className="text-sm text-muted-foreground">{tabDescription.line3}</p>}
          </div>

          <TabsContent value="community">
            <CommunityTab userId={user.id} channel="community" canCreate={true} />
          </TabsContent>

          <TabsContent value="network">
            <NetworkAlertsFeed 
              userId={user.id} 
              isVendor={isVendor} 
              isRep={isRep} 
            />
          </TabsContent>

          <TabsContent value="announcements">
            <CommunityTab 
              userId={user.id} 
              channel="announcements" 
              canCreate={isAdmin} 
            />
          </TabsContent>

          <TabsContent value="saved">
            <SavedPostsTab userId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </AuthenticatedLayout>
  );
};

export default CommunityBoard;
