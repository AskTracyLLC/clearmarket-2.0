import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye, ShieldAlert, Bell, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { unblockUser } from "@/lib/blocks";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { Database } from "@/integrations/supabase/types";

type NotificationPreferences = Database["public"]["Tables"]["notification_preferences"]["Row"];

interface BlockedUser {
  id: string;
  blocked_user_id: string;
  created_at: string;
  anonymous_id: string | null;
  full_name: string | null;
  role_type: "rep" | "vendor" | null;
}

interface UserReport {
  id: string;
  reported_user_id: string;
  conversation_id: string | null;
  reason_category: string;
  reason_details: string | null;
  status: string;
  created_at: string;
  reported_user_anonymous_id: string | null;
  reported_user_name: string | null;
  reported_user_role: "rep" | "vendor" | null;
}

export default function SafetyCenter() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/signin");
      return;
    }

    loadData();
  }, [user, authLoading, navigate]);

  async function loadData() {
    if (!user) return;

    setLoading(true);
    try {
      await Promise.all([loadBlockedUsers(), loadUserReports(), loadNotificationPreferences()]);
    } catch (error) {
      console.error("Error loading safety data:", error);
      toast.error("Failed to load safety data");
    } finally {
      setLoading(false);
    }
  }

  async function loadNotificationPreferences() {
    if (!user) return;

    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error loading notification preferences:", error);
      return;
    }

    if (!data) {
      // Create default preferences
      const { data: inserted, error: insertError } = await supabase
        .from("notification_preferences")
        .insert({ user_id: user.id })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating notification preferences:", insertError);
        return;
      }

      setPreferences(inserted);
    } else {
      setPreferences(data);
    }
  }

  async function handleTogglePreference(
    field: keyof Omit<NotificationPreferences, "user_id" | "created_at" | "updated_at">,
    value: boolean
  ) {
    if (!preferences || !user) return;

    const optimisticUpdate = { ...preferences, [field]: value };
    setPreferences(optimisticUpdate);

    const { error } = await supabase
      .from("notification_preferences")
      .update({ [field]: value })
      .eq("user_id", user.id);

    if (error) {
      // Revert on error
      setPreferences(preferences);
      toast.error("Failed to update notification settings");
    } else {
      toast.success("Notification settings updated");
    }
  }

  async function loadBlockedUsers() {
    if (!user) return;

    const { data: blocks, error } = await supabase
      .from("user_blocks")
      .select("id, blocked_user_id, created_at")
      .eq("blocker_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading blocked users:", error);
      return;
    }

    if (!blocks || blocks.length === 0) {
      setBlockedUsers([]);
      return;
    }

    // Load profile info for blocked users
    const blockedUserIds = blocks.map(b => b.blocked_user_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, is_fieldrep, is_vendor_admin")
      .in("id", blockedUserIds);

    const { data: repProfiles } = await supabase
      .from("rep_profile")
      .select("user_id, anonymous_id")
      .in("user_id", blockedUserIds);

    const { data: vendorProfiles } = await supabase
      .from("vendor_profile")
      .select("user_id, anonymous_id")
      .in("user_id", blockedUserIds);

    const blockedUsersData: BlockedUser[] = blocks.map(block => {
      const profile = profiles?.find(p => p.id === block.blocked_user_id);
      const repProfile = repProfiles?.find(r => r.user_id === block.blocked_user_id);
      const vendorProfile = vendorProfiles?.find(v => v.user_id === block.blocked_user_id);

      return {
        id: block.id,
        blocked_user_id: block.blocked_user_id,
        created_at: block.created_at,
        anonymous_id: repProfile?.anonymous_id || vendorProfile?.anonymous_id || null,
        full_name: profile?.full_name || null,
        role_type: profile?.is_fieldrep ? "rep" : profile?.is_vendor_admin ? "vendor" : null,
      };
    });

    setBlockedUsers(blockedUsersData);
  }

  async function loadUserReports() {
    if (!user) return;

    const { data: reports, error } = await supabase
      .from("user_reports")
      .select("id, reported_user_id, conversation_id, reason_category, reason_details, status, created_at")
      .eq("reporter_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading user reports:", error);
      return;
    }

    if (!reports || reports.length === 0) {
      setUserReports([]);
      return;
    }

    // Load profile info for reported users
    const reportedUserIds = reports.map(r => r.reported_user_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, is_fieldrep, is_vendor_admin")
      .in("id", reportedUserIds);

    const { data: repProfiles } = await supabase
      .from("rep_profile")
      .select("user_id, anonymous_id")
      .in("user_id", reportedUserIds);

    const { data: vendorProfiles } = await supabase
      .from("vendor_profile")
      .select("user_id, anonymous_id")
      .in("user_id", reportedUserIds);

    const reportsData: UserReport[] = reports.map(report => {
      const profile = profiles?.find(p => p.id === report.reported_user_id);
      const repProfile = repProfiles?.find(r => r.user_id === report.reported_user_id);
      const vendorProfile = vendorProfiles?.find(v => v.user_id === report.reported_user_id);

      return {
        ...report,
        reported_user_anonymous_id: repProfile?.anonymous_id || vendorProfile?.anonymous_id || null,
        reported_user_name: profile?.full_name || null,
        reported_user_role: profile?.is_fieldrep ? "rep" : profile?.is_vendor_admin ? "vendor" : null,
      };
    });

    setUserReports(reportsData);
  }

  async function handleUnblock(blockedUserId: string, blockId: string) {
    setUnblocking(blockId);
    try {
      await unblockUser(blockedUserId);
      
      setBlockedUsers(prev => prev.filter(b => b.id !== blockId));
      
      toast.success("Unblocked. You may start receiving messages or requests from this user again.");
    } catch (error) {
      console.error("Error unblocking user:", error);
      toast.error("Failed to unblock user");
    } finally {
      setUnblocking(null);
    }
  }

  function getStatusBadgeVariant(status: string) {
    switch (status) {
      case "open":
        return "default";
      case "reviewed":
        return "secondary";
      case "dismissed":
        return "outline";
      case "action_taken":
        return "default";
      default:
        return "secondary";
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "open":
        return "bg-amber-500/10 text-amber-500 border-amber-500/30";
      case "reviewed":
        return "bg-blue-500/10 text-blue-500 border-blue-500/30";
      case "dismissed":
        return "bg-muted text-muted-foreground";
      case "action_taken":
        return "bg-green-500/10 text-green-500 border-green-500/30";
      default:
        return "";
    }
  }

  function openProfile(userId: string) {
    setSelectedUserId(userId);
    setProfileDialogOpen(true);
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldAlert className="h-8 w-8" />
            Safety Center
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your blocked users and view reports you've submitted
          </p>
        </div>

        <Tabs defaultValue="blocked" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="blocked">Blocked Users</TabsTrigger>
            <TabsTrigger value="reports">Your Reports</TabsTrigger>
            <TabsTrigger value="notifications">Notification Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="blocked" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Blocked Users</CardTitle>
                <CardDescription>
                  You won't receive messages or new connection requests from blocked users. You can unblock them at any time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {blockedUsers.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      You haven't blocked any users yet.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {blockedUsers.map((blocked) => (
                      <div
                        key={blocked.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <button
                            onClick={() => openProfile(blocked.blocked_user_id)}
                            className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
                          >
                            <span className="font-semibold">
                              {blocked.anonymous_id || "User"}
                            </span>
                            <Eye className="h-4 w-4" />
                          </button>
                          {blocked.role_type && (
                            <Badge variant="outline">
                              {blocked.role_type === "rep" ? "Field Rep" : "Vendor"}
                            </Badge>
                          )}
                          <span className="text-sm text-muted-foreground">
                            Blocked since {format(new Date(blocked.created_at), "MM/dd/yyyy")}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnblock(blocked.blocked_user_id, blocked.id)}
                          disabled={unblocking === blocked.id}
                        >
                          {unblocking === blocked.id ? "Unblocking..." : "Unblock"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Reports</CardTitle>
                <CardDescription>
                  These are reports you have submitted to ClearMarket. Our team may take action based on our community guidelines. You won't always receive a direct follow-up for every report.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userReports.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      You haven't submitted any reports yet.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {userReports.map((report) => (
                      <div
                        key={report.id}
                        className="p-4 border border-border rounded-lg bg-card space-y-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => openProfile(report.reported_user_id)}
                                className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                              >
                                {report.reported_user_anonymous_id || "User"}
                                <Eye className="h-4 w-4" />
                              </button>
                              {report.reported_user_role && (
                                <Badge variant="outline" className="text-xs">
                                  {report.reported_user_role === "rep" ? "Field Rep" : "Vendor"}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {report.reason_category.replace(/_/g, " ")}
                              </Badge>
                              <Badge className={`text-xs ${getStatusColor(report.status)}`}>
                                {report.status.replace(/_/g, " ")}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(report.created_at), "MMM dd, yyyy")}
                              </span>
                            </div>

                            {report.reason_details && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {report.reason_details}
                              </p>
                            )}
                          </div>

                          {report.conversation_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/messages/${report.conversation_id}`)}
                            >
                              View Conversation
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Settings
                </CardTitle>
                <CardDescription>
                  Choose which in-app notifications you'd like to receive. Critical safety alerts may still be sent.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!preferences ? (
                  <p className="text-sm text-muted-foreground">Loading preferences...</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="notify_new_message" className="text-sm font-medium">
                          New messages
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Show a notification when someone sends you a new message.
                        </p>
                      </div>
                      <Switch
                        id="notify_new_message"
                        checked={preferences.notify_new_message}
                        onCheckedChange={(value) =>
                          handleTogglePreference("notify_new_message", value)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="notify_connection_request" className="text-sm font-medium">
                          Connection requests
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Show a notification when someone wants to connect with you.
                        </p>
                      </div>
                      <Switch
                        id="notify_connection_request"
                        checked={preferences.notify_connection_request}
                        onCheckedChange={(value) =>
                          handleTogglePreference("notify_connection_request", value)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="notify_connection_accepted" className="text-sm font-medium">
                          Connection accepted
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Show a notification when your connection request is accepted.
                        </p>
                      </div>
                      <Switch
                        id="notify_connection_accepted"
                        checked={preferences.notify_connection_accepted}
                        onCheckedChange={(value) =>
                          handleTogglePreference("notify_connection_accepted", value)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="notify_review_received" className="text-sm font-medium">
                          Reviews received
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Show a notification when you receive a new review.
                        </p>
                      </div>
                      <Switch
                        id="notify_review_received"
                        checked={preferences.notify_review_received}
                        onCheckedChange={(value) =>
                          handleTogglePreference("notify_review_received", value)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="notify_credits_events" className="text-sm font-medium">
                          Credits & billing updates
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Notifications about credits, low balance, and purchases.
                        </p>
                      </div>
                      <Switch
                        id="notify_credits_events"
                        checked={preferences.notify_credits_events}
                        onCheckedChange={(value) =>
                          handleTogglePreference("notify_credits_events", value)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="notify_system_updates" className="text-sm font-medium">
                          System updates & announcements
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Important announcements and updates about ClearMarket.
                        </p>
                      </div>
                      <Switch
                        id="notify_system_updates"
                        checked={preferences.notify_system_updates}
                        onCheckedChange={(value) =>
                          handleTogglePreference("notify_system_updates", value)
                        }
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {selectedUserId && (
        <PublicProfileDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
          targetUserId={selectedUserId}
        />
      )}
    </div>
  );
}
