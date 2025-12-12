import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { Megaphone, Calendar, DollarSign, Building2, User, ExternalLink, Send, Inbox } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertKudosButton } from "@/components/AlertKudosButton";

interface NetworkAlert {
  id: string;
  type: "vendor_network_alert" | "vendor_alert" | "pay_day" | "office_closed";
  title: string;
  body: string | null;
  created_at: string;
  sender_name: string | null;
  sender_role: "vendor" | "rep";
  sender_id: string;
  is_read: boolean;
  ref_id?: string | null;
}

interface VendorAlertDetail {
  id: string;
  alert_type: string;
  message: string;
  created_at: string;
  rep_user_id: string;
  route_date: string | null;
  route_state: string | null;
  route_counties: string[] | null;
  rep_name: string;
}

interface Props {
  userId: string;
  isVendor: boolean;
  isRep: boolean;
}

export function NetworkAlertsFeed({ userId, isVendor, isRep }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<NetworkAlert[]>([]);
  const [filterType, setFilterType] = useState("all");
  const [viewMode, setViewMode] = useState<"received" | "sent">("received");
  const [selectedAlert, setSelectedAlert] = useState<NetworkAlert | null>(null);
  const [detailVendorAlert, setDetailVendorAlert] = useState<VendorAlertDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, [userId, viewMode]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const allAlerts: NetworkAlert[] = [];

      if (isRep && viewMode === "received") {
        // Reps receive alerts from vendors via notifications
        const { data: notifications, error: notifError } = await supabase
          .from("notifications")
          .select("id, type, title, body, created_at, is_read, ref_id")
          .eq("user_id", userId)
          .in("type", ["vendor_network_alert", "vendor_alert"])
          .order("created_at", { ascending: false })
          .limit(50);

        if (notifError) throw notifError;

        for (const notif of notifications || []) {
          allAlerts.push({
            id: notif.id,
            type: notif.type as NetworkAlert["type"],
            title: notif.title,
            body: notif.body,
            created_at: notif.created_at,
            sender_name: null, // Could fetch from ref_id if needed
            sender_role: "vendor",
            sender_id: "",
            is_read: notif.is_read,
            ref_id: notif.ref_id,
          });
        }
      }

      if (isVendor && viewMode === "received") {
        // Vendors receive alerts from reps via notifications
        const { data: notifications, error: notifError } = await supabase
          .from("notifications")
          .select("id, type, title, body, created_at, is_read, ref_id")
          .eq("user_id", userId)
          .in("type", ["vendor_alert"])
          .order("created_at", { ascending: false })
          .limit(50);

        if (notifError) throw notifError;

        for (const notif of notifications || []) {
          allAlerts.push({
            id: notif.id,
            type: notif.type as NetworkAlert["type"],
            title: notif.title,
            body: notif.body,
            created_at: notif.created_at,
            sender_name: null,
            sender_role: "rep",
            sender_id: "",
            is_read: notif.is_read,
            ref_id: notif.ref_id,
          });
        }
      }

      if (isVendor && viewMode === "sent") {
        // Vendors sent alerts - from rep_network_alerts
        const { data: sentAlerts, error: sentError } = await supabase
          .from("rep_network_alerts")
          .select("id, title, body, created_at, status, sent_at")
          .eq("vendor_id", userId)
          .in("status", ["sent", "scheduled", "pending"])
          .order("created_at", { ascending: false })
          .limit(50);

        if (sentError) throw sentError;

        for (const alert of sentAlerts || []) {
          allAlerts.push({
            id: alert.id,
            type: "vendor_network_alert",
            title: alert.title,
            body: alert.body,
            created_at: alert.sent_at || alert.created_at,
            sender_name: "You",
            sender_role: "vendor",
            sender_id: userId,
            is_read: true,
          });
        }
      }

      if (isRep && viewMode === "sent") {
        // Reps sent alerts - from vendor_alerts
        const { data: sentAlerts, error: sentError } = await supabase
          .from("vendor_alerts")
          .select("id, alert_type, message, created_at")
          .eq("rep_user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (sentError) throw sentError;

        for (const alert of sentAlerts || []) {
          allAlerts.push({
            id: alert.id,
            type: "vendor_alert",
            title: getAlertTypeLabel(alert.alert_type),
            body: alert.message,
            created_at: alert.created_at,
            sender_name: "You",
            sender_role: "rep",
            sender_id: userId,
            is_read: true,
          });
        }
      }

      // Sort by created_at desc
      allAlerts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setAlerts(allAlerts);
    } catch (error) {
      console.error("Error loading network alerts:", error);
      toast({
        title: "Error",
        description: "Failed to load network alerts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAlertTypeLabel = (type: string): string => {
    switch (type) {
      case "time_off_start":
        return "Time Off Notice";
      case "emergency":
        return "Emergency Alert";
      case "availability":
        return "Availability Update";
      case "scheduled":
        return "Scheduled Alert";
      case "planned_route":
        return "Planned Route";
      default:
        return "Network Alert";
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "pay_day":
        return <DollarSign className="h-4 w-4" />;
      case "office_closed":
        return <Building2 className="h-4 w-4" />;
      case "vendor_network_alert":
        return <Megaphone className="h-4 w-4" />;
      case "vendor_alert":
        return <User className="h-4 w-4" />;
      default:
        return <Megaphone className="h-4 w-4" />;
    }
  };

  // Light mode: light tint bg + dark text for WCAG AA contrast
  // Dark mode: darker tint bg + colored text
  const getTypeBadge = (type: string) => {
    switch (type) {
      case "vendor_network_alert":
        return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400">Vendor Alert</Badge>;
      case "vendor_alert":
        return <Badge variant="secondary" className="text-xs bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-400">Rep Alert</Badge>;
      case "pay_day":
        return <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400">Pay Day</Badge>;
      case "office_closed":
        return <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400">Office Closed</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Alert</Badge>;
    }
  };

  const handleAlertClick = async (alert: NetworkAlert) => {
    // Mark as read if unread
    if (!alert.is_read) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", alert.id);

      setAlerts(prev => prev.map(a => 
        a.id === alert.id ? { ...a, is_read: true } : a
      ));
    }

    // For rep alerts, open a detail drawer instead of navigating away
    if (alert.type === "vendor_alert") {
      await openVendorAlertDetail(alert);
      return;
    }

    // Navigate based on sender role for other alert types
    if (alert.sender_role === "vendor") {
      navigate("/rep/my-vendors");
    } else {
      navigate("/vendor/my-reps");
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filterType === "all") return true;
    return alert.type === filterType;
  });

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading network alerts...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {(isVendor || isRep) && (
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "received" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setViewMode("received")}
              className="gap-2"
            >
              <Inbox className="h-4 w-4" />
              Received
            </Button>
            <Button
              variant={viewMode === "sent" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setViewMode("sent")}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Sent
            </Button>
          </div>
        )}

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="vendor_network_alert">Vendor Alerts</SelectItem>
            <SelectItem value="vendor_alert">Rep Alerts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts List */}
      {filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {viewMode === "sent" 
                ? "You haven't sent any network alerts yet."
                : "No network alerts yet."}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {viewMode === "received"
                ? "Alerts from your connected vendors and reps will appear here."
                : isVendor 
                  ? "Send alerts to your connected Field Reps from the Office & Pay Calendar page."
                  : "Send alerts to your connected Vendors from the Availability page."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <Card
              key={alert.id}
              className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                !alert.is_read ? "border-primary" : ""
              }`}
              onClick={() => handleAlertClick(alert)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-muted-foreground">
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {getTypeBadge(alert.type)}
                      <Badge variant="outline" className="text-xs">
                        {alert.sender_role === "vendor" ? "Vendor" : "Field Rep"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                      </span>
                      {!alert.is_read && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className={`text-sm ${!alert.is_read ? "font-semibold" : "font-medium"}`}>
                      {alert.title}
                    </p>
                    {alert.body && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {alert.body}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
