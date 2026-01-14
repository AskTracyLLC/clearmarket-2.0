import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Activity, Users, UserPlus, Unlock, Mail } from "lucide-react";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

interface VendorActivityEvent {
  id: string;
  actor_user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Json;
  created_at: string;
}

interface StaffMember {
  id: string;
  name: string;
  staffCode: string;
}

interface StaffMetricsSummary {
  userId: string;
  name: string;
  staffCode: string;
  totalActions: number;
  invitesSent: number;
  invitesAccepted: number;
  unlocks: number;
}

export default function VendorStaffMetrics() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isVendorAdmin, setIsVendorAdmin] = useState(false);
  const [dateRange, setDateRange] = useState<"7" | "30">("7");
  const [events, setEvents] = useState<VendorActivityEvent[]>([]);
  const [staffMembers, setStaffMembers] = useState<Map<string, StaffMember>>(new Map());
  const [staffMetrics, setStaffMetrics] = useState<StaffMetricsSummary[]>([]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/signin");
      return;
    }

    checkAccess();
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (isVendorAdmin && user) {
      loadData();
    }
  }, [isVendorAdmin, user, dateRange]);

  const checkAccess = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_vendor_admin, is_vendor_staff")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_vendor_admin) {
      toast.error("Access denied", {
        description: "Only vendor owners can view staff metrics.",
      });
      navigate("/dashboard");
      return;
    }

    setIsVendorAdmin(true);
  };

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const startDate = subDays(new Date(), parseInt(dateRange)).toISOString();

      // Load activity events for this vendor
      const { data: eventData, error: eventsError } = await supabase
        .from("vendor_activity_events")
        .select("*")
        .eq("vendor_owner_user_id", user.id)
        .gte("created_at", startDate)
        .order("created_at", { ascending: false })
        .limit(100);

      if (eventsError) {
        console.error("Error loading events:", eventsError);
      }

      setEvents(eventData || []);

      // Get unique actor IDs
      const actorIds = [...new Set((eventData || []).map((e) => e.actor_user_id))];

      // Load staff info for all actors
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, staff_anonymous_id")
          .in("id", actorIds);

        const { data: vendorStaff } = await supabase
          .from("vendor_staff")
          .select("staff_user_id, staff_code")
          .in("staff_user_id", actorIds);

        const staffMap = new Map<string, StaffMember>();

        profiles?.forEach((p) => {
          const staffRecord = vendorStaff?.find((vs) => vs.staff_user_id === p.id);
          staffMap.set(p.id, {
            id: p.id,
            name: p.full_name || "Unknown",
            staffCode: staffRecord?.staff_code || p.staff_anonymous_id || "—",
          });
        });

        // Add self (vendor owner)
        if (!staffMap.has(user.id)) {
          staffMap.set(user.id, {
            id: user.id,
            name: "You (Owner)",
            staffCode: "Owner",
          });
        }

        setStaffMembers(staffMap);

        // Compute metrics per staff member
        const metricsMap = new Map<string, StaffMetricsSummary>();

        (eventData || []).forEach((event) => {
          const actor = staffMap.get(event.actor_user_id);
          if (!actor) return;

          if (!metricsMap.has(event.actor_user_id)) {
            metricsMap.set(event.actor_user_id, {
              userId: event.actor_user_id,
              name: actor.name,
              staffCode: actor.staffCode,
              totalActions: 0,
              invitesSent: 0,
              invitesAccepted: 0,
              unlocks: 0,
            });
          }

          const metrics = metricsMap.get(event.actor_user_id)!;
          metrics.totalActions++;

          // Handle both old format (vendor_staff.invited) and new format (staff_invite_sent)
          if (event.action === "staff_invite_sent" || event.action === "vendor_staff.invited") {
            metrics.invitesSent++;
          } else if (event.action === "staff_invite_accepted" || event.action === "vendor_staff.invite_accepted") {
            metrics.invitesAccepted++;
          } else if (event.action === "rep_contact_unlocked") {
            metrics.unlocks++;
          }
        });

        setStaffMetrics(Array.from(metricsMap.values()).sort((a, b) => b.totalActions - a.totalActions));
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "staff_invite_sent":
      case "vendor_staff.invited":
        return <Mail className="w-4 h-4 text-blue-500" />;
      case "staff_invite_accepted":
      case "vendor_staff.invite_accepted":
        return <UserPlus className="w-4 h-4 text-green-500" />;
      case "rep_contact_unlocked":
        return <Unlock className="w-4 h-4 text-amber-500" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatAction = (action: string) => {
    return action
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/vendor/staff">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Staff
                </Link>
              </Button>
              <h1 className="text-xl font-semibold">Staff Metrics</h1>
            </div>
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as "7" | "30")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{events.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Staff Invites Sent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {events.filter((e) => e.action === "staff_invite_sent").length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Invites Accepted</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {events.filter((e) => e.action === "staff_invite_accepted").length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Contacts Unlocked</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {events.filter((e) => e.action === "rep_contact_unlocked").length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Staff Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Staff Activity Breakdown
              </CardTitle>
              <CardDescription>Actions per team member in the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {staffMetrics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No activity recorded in this period.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead className="text-center">Total Actions</TableHead>
                      <TableHead className="text-center">Invites Sent</TableHead>
                      <TableHead className="text-center">Invites Accepted</TableHead>
                      <TableHead className="text-center">Unlocks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffMetrics.map((staff) => (
                      <TableRow key={staff.userId}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{staff.name}</p>
                            <p className="text-xs text-muted-foreground">{staff.staffCode}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">{staff.totalActions}</TableCell>
                        <TableCell className="text-center">{staff.invitesSent}</TableCell>
                        <TableCell className="text-center">{staff.invitesAccepted}</TableCell>
                        <TableCell className="text-center">{staff.unlocks}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest 20 events from your team</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No activity recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.slice(0, 20).map((event) => {
                    const actor = staffMembers.get(event.actor_user_id);
                    return (
                      <div key={event.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                        <div className="mt-0.5">{getActionIcon(event.action)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{actor?.name || "Unknown"}</span>
                            {" · "}
                            <span className="text-muted-foreground">{formatAction(event.action)}</span>
                          </p>
                          {typeof event.metadata === "object" && event.metadata !== null && !Array.isArray(event.metadata) && (
                            <p className="text-xs text-muted-foreground truncate">
                              {(event.metadata as Record<string, unknown>).email && `Email: ${(event.metadata as Record<string, unknown>).email}`}
                              {(event.metadata as Record<string, unknown>).target_type && ` · ${(event.metadata as Record<string, unknown>).target_type}`}
                            </p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(event.created_at), "MMM d, h:mm a")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
