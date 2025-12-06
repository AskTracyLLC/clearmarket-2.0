import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowRight } from "lucide-react";
import type { WorkingTermsRequest } from "@/lib/workingTerms";

interface WorkingTermsPendingCardProps {
  request: WorkingTermsRequest;
  vendorName?: string;
  repName?: string;
  role: 'vendor' | 'rep';
}

const WorkingTermsPendingCard: React.FC<WorkingTermsPendingCardProps> = ({
  request,
  vendorName,
  repName,
  role,
}) => {
  const navigate = useNavigate();

  const getStatusBadge = () => {
    switch (request.status) {
      case "pending_rep":
        return role === 'rep' 
          ? <Badge variant="default">Action required</Badge>
          : <Badge variant="secondary">Waiting for rep</Badge>;
      case "pending_vendor":
        return role === 'vendor'
          ? <Badge variant="default">Action required</Badge>
          : <Badge variant="secondary">Waiting for vendor</Badge>;
      case "pending_rep_confirm":
        return role === 'rep'
          ? <Badge variant="default">Review changes</Badge>
          : <Badge variant="secondary">Pending rep confirmation</Badge>;
      default:
        return <Badge variant="secondary">{request.status}</Badge>;
    }
  };

  const getActionText = () => {
    if (role === 'rep') {
      if (request.status === 'pending_rep') return 'Respond';
      if (request.status === 'pending_rep_confirm') return 'Review changes';
    }
    if (role === 'vendor') {
      if (request.status === 'pending_vendor') return 'Review';
    }
    return 'View';
  };

  const handleClick = () => {
    if (role === 'rep') {
      navigate(`/rep/working-terms-request/${request.id}`);
    } else {
      navigate(`/vendor/working-terms-review/${request.id}`);
    }
  };

  const otherPartyName = role === 'rep' ? vendorName : repName;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-foreground">Coverage request</span>
                {getStatusBadge()}
              </div>
              <p className="text-sm text-muted-foreground">
                {role === 'rep' 
                  ? `${vendorName || 'Vendor'} requested your coverage & pricing`
                  : `Waiting on ${repName || 'Field Rep'}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                States: {request.requested_states.join(", ")}
              </p>
              {request.message_from_vendor && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  "{request.message_from_vendor}"
                </p>
              )}
            </div>
          </div>
          <Button size="sm" onClick={handleClick}>
            {getActionText()}
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkingTermsPendingCard;
