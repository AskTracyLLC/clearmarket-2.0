import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Clock, X, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RepNetworkAlert {
  id: string;
  title: string;
  body: string;
  send_mode: "now" | "scheduled";
  scheduled_at: string | null;
  target_scope: "all_connected" | "by_state";
  target_state_codes: string[] | null;
  status: "pending" | "scheduled" | "sending" | "sent" | "cancelled" | "failed";
  created_at: string;
  sent_at: string | null;
  recipient_count: number | null;
  error_message: string | null;
}

interface Props {
  vendorId: string;
}

interface RecipientCounts {
  connected: number;
  offline: number;
  total: number;
  skippedOffline: number;
}

export function VendorNetworkAlertsCard({ vendorId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [alerts, setAlerts] = useState<RepNetworkAlert[]>([]);
  const [recipientCounts, setRecipientCounts] = useState<RecipientCounts>({
    connected: 0,
    offline: 0,
    total: 0,
    skippedOffline: 0,
  });
  const [cancellingAlertId, setCancellingAlertId] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendMode, setSendMode] = useState<"now" | "scheduled">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get connected rep count and their emails for deduplication
      const { data: connections } = await supabase
        .from("vendor_connections")
        .select("field_rep_id")
        .eq("vendor_id", vendorId)
        .eq("status", "connected");

      const connectedRepIds = connections?.map(c => c.field_rep_id) || [];
      
      // Fetch emails for connected reps for deduplication
      let connectedEmails: Set<string> = new Set();
      let connectedPhones: Set<string> = new Set();
      
      if (connectedRepIds.length > 0) {
        const { data: repProfiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", connectedRepIds);
        
        repProfiles?.forEach(p => {
          if (p.email) connectedEmails.add(p.email.toLowerCase().trim());
        });
      }

      // Get active offline rep contacts
      const { data: offlineContacts } = await supabase
        .from("vendor_offline_rep_contacts")
        .select("id, email, phone")
        .eq("vendor_id", vendorId)
        .eq("status", "active");

      // Count offline contacts that have deliverable info and aren't duplicates
      let offlineWithContact = 0;
      let skippedOffline = 0;
      
      offlineContacts?.forEach(c => {
        const hasEmail = c.email && c.email.trim() !== "";
        const hasPhone = c.phone && c.phone.trim() !== "";
        
        if (!hasEmail && !hasPhone) {
          skippedOffline++;
          return;
        }

        // Check for duplicates
        const emailNorm = hasEmail ? c.email!.toLowerCase().trim() : null;
        const phoneNorm = hasPhone ? c.phone!.replace(/\D/g, "") : null;
        
        const isDuplicateEmail = emailNorm && connectedEmails.has(emailNorm);
        const isDuplicatePhone = phoneNorm && connectedPhones.has(phoneNorm);
        
        if (!isDuplicateEmail && !isDuplicatePhone) {
          offlineWithContact++;
        }
      });

      const total = connectedRepIds.length + offlineWithContact;

      setRecipientCounts({
        connected: connectedRepIds.length,
        offline: offlineWithContact,
        total,
        skippedOffline,
      });

      // Load recent alerts
      const { data: alertsData, error } = await supabase
        .from("rep_network_alerts")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setAlerts((alertsData || []) as RepNetworkAlert[]);
    } catch (error) {
      console.error("Error loading alerts data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendAlert = async () => {
    if (!title.trim() || !body.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide both a title and message.",
        variant: "destructive",
      });
      return;
    }

    if (sendMode === "scheduled" && !scheduledDate) {
      toast({
        title: "Validation Error",
        description: "Please select a date for scheduled alerts.",
        variant: "destructive",
      });
      return;
    }

    if (recipientCounts.total === 0) {
      toast({
        title: "No Recipients",
        description: "You don't have any connected Field Reps or active offline contacts to send alerts to.",
        variant: "default",
      });
      return;
    }

    setSending(true);
    try {
      // Calculate scheduled_at if scheduled
      let scheduledAt: string | null = null;
      if (sendMode === "scheduled") {
        scheduledAt = `${scheduledDate}T${scheduledTime}:00`;
      }

      // Insert alert
      const { data: newAlert, error: insertError } = await supabase
        .from("rep_network_alerts")
        .insert({
          vendor_id: vendorId,
          title: title.trim(),
          body: body.trim(),
          send_mode: sendMode,
          scheduled_at: scheduledAt,
          target_scope: "all_connected",
          status: sendMode === "scheduled" ? "scheduled" : "pending",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (sendMode === "now") {
        // Send immediately via edge function
        const { data, error: sendError } = await supabase.functions.invoke(
          "send-vendor-network-alerts",
          { body: { alertId: newAlert.id } }
        );

        if (sendError) throw sendError;

        toast({
          title: "Alert Sent",
          description: `Notification sent to ${data?.results?.[0]?.recipientCount || recipientCounts.total} recipient${recipientCounts.total !== 1 ? 's' : ''}.`,
        });
      } else {
        toast({
          title: "Alert Scheduled",
          description: `Your alert will be sent on ${format(parseISO(scheduledAt!), "MMM d, yyyy 'at' h:mm a")}.`,
        });
      }

      // Reset form
      setTitle("");
      setBody("");
      setSendMode("now");
      setScheduledDate("");
      setScheduledTime("09:00");

      // Reload alerts
      loadData();
    } catch (error: any) {
      console.error("Error sending alert:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send alert.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleCancelAlert = async () => {
    if (!cancellingAlertId) return;

    try {
      const { error } = await supabase
        .from("rep_network_alerts")
        .update({ status: "cancelled" })
        .eq("id", cancellingAlertId)
        .in("status", ["pending", "scheduled"]);

      if (error) throw error;

      toast({
        title: "Alert Cancelled",
        description: "The scheduled alert has been cancelled.",
      });

      loadData();
    } catch (error: any) {
      console.error("Error cancelling alert:", error);
      toast({
        title: "Error",
        description: "Failed to cancel alert.",
        variant: "destructive",
      });
    } finally {
      setCancellingAlertId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case "scheduled":
        return <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case "pending":
        return <Badge variant="outline" className="bg-muted text-muted-foreground"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Pending</Badge>;
      case "sending":
        return <Badge variant="outline" className="bg-blue-500/20 text-blue-500 border-blue-500/30"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Sending</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-muted text-muted-foreground"><X className="h-3 w-3 mr-1" />Cancelled</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            <CardTitle>Network Alerts</CardTitle>
          </div>
          <CardDescription>
            Send important updates to your connected Field Reps now or on a future date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p>Connected recipients: {recipientCounts.connected} • Offline recipients: {recipientCounts.offline} • <strong>Total: {recipientCounts.total}</strong></p>
                {recipientCounts.skippedOffline > 0 && (
                  <p className="text-xs text-muted-foreground">Some offline contacts were skipped because they have no deliverable contact info.</p>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Composer Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="alert-title">Alert Title</Label>
              <Input
                id="alert-title"
                placeholder="e.g., Pay Schedule Update, New Coverage Opportunity"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="alert-body">Message</Label>
              <Textarea
                id="alert-body"
                placeholder="Write your message to all connected Field Reps..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="mb-3 block">When to send?</Label>
              <RadioGroup value={sendMode} onValueChange={(val) => setSendMode(val as "now" | "scheduled")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="now" id="send-now" />
                  <Label htmlFor="send-now" className="cursor-pointer">Send now</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="scheduled" id="send-scheduled" />
                  <Label htmlFor="send-scheduled" className="cursor-pointer">Schedule for later</Label>
                </div>
              </RadioGroup>

              {sendMode === "scheduled" && (
                <div className="flex items-center gap-3 mt-3 ml-6">
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-44"
                  />
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-32"
                  />
                </div>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              This will be sent to ~{recipientCounts.total} recipient{recipientCounts.total !== 1 ? 's' : ''}.
            </div>

            <Button onClick={handleSendAlert} disabled={sending || recipientCounts.total === 0} className="w-full">
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Sending..." : sendMode === "now" ? "Send Now" : "Schedule Alert"}
            </Button>
          </div>

          {/* Alert History */}
          {alerts.length > 0 && (
            <div className="pt-4 border-t border-border">
              <h4 className="font-medium text-foreground mb-3">Recent Alerts</h4>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-lg border border-border bg-card"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(alert.status)}
                        {alert.recipient_count !== null && alert.status === "sent" && (
                          <span className="text-xs text-muted-foreground">
                            {alert.recipient_count} recipient{alert.recipient_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {(alert.status === "pending" || alert.status === "scheduled") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCancellingAlertId(alert.id)}
                          className="h-7 px-2 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="font-medium text-sm text-foreground">{alert.title}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{alert.body}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      {alert.status === "scheduled" && alert.scheduled_at ? (
                        <span>Scheduled: {format(parseISO(alert.scheduled_at), "MMM d, yyyy 'at' h:mm a")}</span>
                      ) : alert.sent_at ? (
                        <span>Sent: {format(parseISO(alert.sent_at), "MMM d, yyyy 'at' h:mm a")}</span>
                      ) : (
                        <span>Created: {format(parseISO(alert.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                      )}
                    </div>
                    {alert.status === "failed" && alert.error_message && (
                      <p className="text-xs text-destructive mt-1">Error: {alert.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancellingAlertId} onOpenChange={() => setCancellingAlertId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Scheduled Alert?</AlertDialogTitle>
            <AlertDialogDescription>
              This alert will not be sent to your connected Field Reps. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Alert</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelAlert}>Cancel Alert</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
