import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { checklist } from "@/lib/checklistTracking";

type NotificationPreferences = {
  user_id: string;
  created_at: string;
  updated_at: string;
  notify_new_message: boolean;
  notify_connection_request: boolean;
  notify_connection_accepted: boolean;
  notify_review_received: boolean;
  notify_credits_events: boolean;
  notify_system_updates: boolean;
  email_messages: boolean;
  email_connections: boolean;
  email_reviews: boolean;
  email_system: boolean;
  digest_messages: boolean;
  digest_connections: boolean;
  digest_reviews: boolean;
  digest_system: boolean;
  sound_enabled: boolean;
};

export default function NotificationSettings() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const hasTrackedSave = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/signin");
      return;
    }

    loadNotificationPreferences();
  }, [user, authLoading, navigate]);

  async function loadNotificationPreferences() {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading notification preferences:", error);
        toast.error("Failed to load notification preferences");
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
          toast.error("Failed to create notification preferences");
          return;
        }

        setPreferences(inserted);
      } else {
        setPreferences(data);
      }
    } finally {
      setLoading(false);
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
      // Track checklist event (only once per session)
      if (!hasTrackedSave.current) {
        hasTrackedSave.current = true;
        checklist.notificationSettingsSaved(user.id);
      }
    }
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
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="h-8 w-8" />
            Notification Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Control how you receive notifications for different types of activities
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>
              Choose how you'd like to receive notifications. You can enable or disable in-app, real-time email, and daily digest notifications for each category.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {!preferences ? (
              <p className="text-sm text-muted-foreground">Loading preferences...</p>
            ) : (
              <>
                {/* Sound Settings */}
                <div className="space-y-4 border-b pb-6">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-base font-semibold">Sound</h3>
                  </div>
                  <div className="flex items-center justify-between pl-4">
                    <div className="space-y-1">
                      <Label htmlFor="sound_enabled" className="text-sm font-medium">
                        Notification sound
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Play a sound when you receive new messages
                      </p>
                    </div>
                    <Switch
                      id="sound_enabled"
                      checked={preferences.sound_enabled}
                      onCheckedChange={(value) =>
                        handleTogglePreference("sound_enabled", value)
                      }
                    />
                  </div>
                </div>

                <div className="mb-6 p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm space-y-1">
                    <span className="block"><strong>In-app:</strong> Notifications appear in your ClearMarket inbox.</span>
                    <span className="block"><strong>Real-time email:</strong> Sends you an email as events happen.</span>
                    <span className="block"><strong>Daily digest:</strong> Sends one summary email per day (8am Central) with events from the last 24 hours.</span>
                  </p>
                </div>

                {/* Messages */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold mb-1">Messages</h3>
                    <p className="text-xs text-muted-foreground">Get notified when you receive messages</p>
                  </div>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="notify_new_message" className="text-sm font-medium">
                          In-app notifications
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Show notifications in the app
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
                        <Label htmlFor="email_messages" className="text-sm font-medium">
                          Real-time email
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Send email immediately when you receive a new message or reply
                        </p>
                      </div>
                      <Switch
                        id="email_messages"
                        checked={preferences.email_messages}
                        onCheckedChange={(value) =>
                          handleTogglePreference("email_messages", value)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="digest_messages" className="text-sm font-medium">
                          Daily digest email
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Include message notifications in daily summary email
                        </p>
                      </div>
                      <Switch
                        id="digest_messages"
                        checked={preferences.digest_messages}
                        onCheckedChange={(value) =>
                          handleTogglePreference("digest_messages", value)
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Connections */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold mb-1">Connections</h3>
                    <p className="text-xs text-muted-foreground">Get notified about connection requests and updates</p>
                  </div>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="notify_connection_request" className="text-sm font-medium">
                          In-app notifications
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Show notifications for connection requests
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
                        <Label htmlFor="email_connections" className="text-sm font-medium">
                          Real-time email
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Send email immediately for connection requests and changes
                        </p>
                      </div>
                      <Switch
                        id="email_connections"
                        checked={preferences.email_connections}
                        onCheckedChange={(value) =>
                          handleTogglePreference("email_connections", value)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="digest_connections" className="text-sm font-medium">
                          Daily digest email
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Include connection notifications in daily summary email
                        </p>
                      </div>
                      <Switch
                        id="digest_connections"
                        checked={preferences.digest_connections}
                        onCheckedChange={(value) =>
                          handleTogglePreference("digest_connections", value)
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Reviews */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold mb-1">Reviews</h3>
                    <p className="text-xs text-muted-foreground">Get notified when you receive reviews</p>
                  </div>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="notify_review_received" className="text-sm font-medium">
                          In-app notifications
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Show notifications when you receive a review
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
                        <Label htmlFor="email_reviews" className="text-sm font-medium">
                          Real-time email
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Send email immediately when you receive a new review
                        </p>
                      </div>
                      <Switch
                        id="email_reviews"
                        checked={preferences.email_reviews}
                        onCheckedChange={(value) =>
                          handleTogglePreference("email_reviews", value)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="digest_reviews" className="text-sm font-medium">
                          Daily digest email
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Include review notifications in daily summary email
                        </p>
                      </div>
                      <Switch
                        id="digest_reviews"
                        checked={preferences.digest_reviews}
                        onCheckedChange={(value) =>
                          handleTogglePreference("digest_reviews", value)
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* System & Safety */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold mb-1">System & Safety</h3>
                    <p className="text-xs text-muted-foreground">Get notified about credits, safety alerts, and system updates</p>
                  </div>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="notify_credits_events" className="text-sm font-medium">
                          In-app notifications
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Credits, safety alerts, and system updates
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
                        <Label htmlFor="email_system" className="text-sm font-medium">
                          Real-time email
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Send email immediately for important system notices (credits, safety, account)
                        </p>
                      </div>
                      <Switch
                        id="email_system"
                        checked={preferences.email_system}
                        onCheckedChange={(value) =>
                          handleTogglePreference("email_system", value)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="digest_system" className="text-sm font-medium">
                          Daily digest email
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Include system notifications in daily summary email
                        </p>
                      </div>
                      <Switch
                        id="digest_system"
                        checked={preferences.digest_system}
                        onCheckedChange={(value) =>
                          handleTogglePreference("digest_system", value)
                        }
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}
