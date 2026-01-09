import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MessageSquare, Building2 } from "lucide-react";
import { format } from "date-fns";
import { getOrCreateConversation } from "@/lib/conversations";
import { useToast } from "@/hooks/use-toast";

interface ConnectedVendor {
  vendorUserId: string;
  anonymousId: string;
  companyName: string;
  city: string | null;
  state: string | null;
  connectedAt?: string | null;
  conversationId?: string;
  hasActiveWorkingTerms?: boolean;
  trustScore?: number | null;
  reviewCount?: number;
}

interface Props {
  vendors: ConnectedVendor[];
  currentUserId: string;
}

export function ConnectedVendorsTable({ vendors, currentUserId }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleMessage = async (vendor: ConnectedVendor) => {
    if (vendor.conversationId) {
      navigate(`/messages/${vendor.conversationId}`);
      return;
    }

    const result = await getOrCreateConversation(currentUserId, vendor.vendorUserId);
    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    navigate(`/messages/${result.id}`);
  };

  if (vendors.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No connected vendors yet</h3>
        <p className="text-muted-foreground mb-4">
          When you express interest and accept vendor connection requests, they'll appear here.
        </p>
        <Button onClick={() => navigate("/rep/find-work")}>
          Find Work
        </Button>
      </div>
    );
  }

  const getTrustScoreColor = (score: number) => {
    if (score >= 4.5) return "text-green-500";
    if (score >= 4.0) return "text-blue-500";
    if (score >= 3.0) return "text-yellow-500";
    return "text-muted-foreground";
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor</TableHead>
            <TableHead>Trust Score</TableHead>
            <TableHead>Working Terms</TableHead>
            <TableHead>Connected Since</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors.map((vendor) => (
            <TableRow key={vendor.vendorUserId}>
              {/* Vendor Name (clickable) */}
              <TableCell>
                <button
                  onClick={() => navigate(`/rep/my-vendors/${vendor.vendorUserId}`)}
                  className="text-left hover:underline text-primary font-medium"
                >
                  {vendor.companyName}
                </button>
                {(vendor.city || vendor.state) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {vendor.city && vendor.state 
                      ? `${vendor.city}, ${vendor.state}` 
                      : vendor.city || vendor.state}
                  </p>
                )}
              </TableCell>

              {/* Trust Score */}
              <TableCell>
                {vendor.trustScore != null && vendor.trustScore > 0 ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`font-medium ${getTrustScoreColor(vendor.trustScore)}`}>
                          {vendor.trustScore.toFixed(1)}
                          {vendor.reviewCount != null && vendor.reviewCount > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({vendor.reviewCount})
                            </span>
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-[200px]">
                          Trust Score fluctuates based on verified reviews and platform activity.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>

              {/* Working Terms */}
              <TableCell>
                {vendor.hasActiveWorkingTerms ? (
                  <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    None
                  </Badge>
                )}
              </TableCell>

              {/* Connected Since */}
              <TableCell>
                {vendor.connectedAt ? (
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(vendor.connectedAt), "MM/dd/yyyy")}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>

              {/* Actions - Only Messages */}
              <TableCell>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMessage(vendor)}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Messages</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default ConnectedVendorsTable;
