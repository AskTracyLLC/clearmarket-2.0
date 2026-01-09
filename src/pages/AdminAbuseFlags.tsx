import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertTriangle, Info, RefreshCw, ShieldAlert } from "lucide-react";

interface AbuseFlag {
  vendor_user_id: string;
  vendor_code: string;
  total_accesses_24h: number;
  unique_reps_24h: number;
  export_count_24h: number;
  accesses_last_hour: number;
  flag_reason: string | null;
}

const THRESHOLD_EXPLANATIONS = [
  { flag: "HIGH_EXPORT_VOLUME", desc: "> 50 exports in 24h", severity: "high" },
  { flag: "MANY_UNIQUE_REPS", desc: "> 100 unique reps accessed in 24h", severity: "high" },
  { flag: "HIGH_HOURLY_RATE", desc: "> 30 actions in the last hour", severity: "medium" },
  { flag: "HIGH_DAILY_VOLUME", desc: "> 200 total actions in 24h", severity: "medium" },
];

export default function AdminAbuseFlags() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permLoading } = useStaffPermissions();
  const { toast } = useToast();

  const [flags, setFlags] = useState<AbuseFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !permLoading) {
      if (!user || !permissions.canViewAuditLog) {
        navigate("/dashboard");
        return;
      }
      loadFlags();
    }
  }, [user, authLoading, permLoading, permissions]);

  const loadFlags = async () => {
    try {
      const { data, error } = await supabase.rpc("get_contact_access_abuse_flags");
      if (error) throw error;
      setFlags((data || []) as AbuseFlag[]);
    } catch (err: any) {
      console.error("Error loading abuse flags:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to load abuse flags.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFlags();
  };

  const getFlagBadge = (flag: string | null) => {
    if (!flag) return null;
    const info = THRESHOLD_EXPLANATIONS.find((t) => t.flag === flag);
    const severity = info?.severity || "medium";
    return (
      <Badge 
        variant={severity === "high" ? "destructive" : "secondary"}
        className="font-mono text-xs"
      >
        {flag}
      </Badge>
    );
  };

  if (authLoading || permLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/admin/audit">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Audit Log
          </Button>
        </Link>
      </div>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            Abuse Detection
          </h1>
          <p className="text-muted-foreground">
            Monitor vendors with unusual contact access patterns
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Threshold Explanation */}
      <Card className="p-4 mb-6 bg-muted/30 border-border">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <h3 className="font-semibold mb-2">Detection Thresholds</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {THRESHOLD_EXPLANATIONS.map((t) => (
                <div key={t.flag} className="flex items-center gap-2">
                  <Badge 
                    variant={t.severity === "high" ? "destructive" : "secondary"} 
                    className="font-mono text-xs"
                  >
                    {t.flag}
                  </Badge>
                  <span className="text-muted-foreground">{t.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Flags Table */}
      <Card className="p-0 overflow-hidden">
        {flags.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Abuse Flags Detected</h3>
            <p className="text-muted-foreground">
              All vendor contact access patterns are within normal thresholds.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor Code</TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger className="cursor-help underline decoration-dotted">
                      24h Total
                    </TooltipTrigger>
                    <TooltipContent>Total contact accesses in last 24 hours</TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger className="cursor-help underline decoration-dotted">
                      Unique Reps
                    </TooltipTrigger>
                    <TooltipContent>Unique rep contacts accessed in 24h</TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger className="cursor-help underline decoration-dotted">
                      Exports
                    </TooltipTrigger>
                    <TooltipContent>Contact exports in 24h</TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger className="cursor-help underline decoration-dotted">
                      Last Hour
                    </TooltipTrigger>
                    <TooltipContent>Accesses in the last hour</TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead>Flag</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((flag) => (
                <TableRow key={flag.vendor_user_id}>
                  <TableCell className="font-mono font-semibold">
                    {flag.vendor_code}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {flag.total_accesses_24h.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {flag.unique_reps_24h.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {flag.export_count_24h.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {flag.accesses_last_hour.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {getFlagBadge(flag.flag_reason)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/users?search=${flag.vendor_code}`)}
                    >
                      View Vendor
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {flags.length > 0 && (
        <Alert className="mt-6 border-secondary/50 bg-secondary/10">
          <AlertTriangle className="h-4 w-4 text-secondary" />
          <AlertDescription>
            <strong>{flags.length} vendor(s)</strong> flagged for unusual activity. 
            Review their contact access logs to determine if action is needed.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
