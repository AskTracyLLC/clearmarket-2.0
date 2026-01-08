/**
 * Proposal Debug Panel
 * Collapsible panel showing debug info for proposal actions
 * Only visible when debug mode is enabled
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DebugState,
  isDebugModeEnabled,
  loadDebugState,
  clearDebugState,
  copyDebugToClipboard,
  getAuthUserId,
  isRlsError,
} from "@/lib/proposalDebug";
import { useAuth } from "@/hooks/useAuth";
import { useMimic } from "@/hooks/useMimic";
import { ChevronDown, ChevronUp, Copy, Trash2, Bug, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface ProposalDebugPanelProps {
  proposalId?: string | null;
  debugState: DebugState;
  onClear: () => void;
}

export function ProposalDebugPanel({ proposalId, debugState, onClear }: ProposalDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const { user } = useAuth();
  const { effectiveUserId, mimickedUser, isAdmin } = useMimic();
  
  // Derive effective role from mimic context or default to vendor
  const effectiveRole = mimickedUser?.is_vendor_admin ? "vendor" : mimickedUser?.is_fieldrep ? "rep" : "vendor";

  useEffect(() => {
    getAuthUserId().then(setAuthUserId);
  }, []);

  // Don't render if debug mode is not enabled
  if (!isDebugModeEnabled()) {
    return null;
  }

  const handleCopy = () => {
    const fullState: DebugState = {
      ...debugState,
      authUserId,
      effectiveRole: effectiveRole || "vendor",
      effectiveUserId: effectiveUserId || user?.id || null,
      proposalId: proposalId || null,
    };
    copyDebugToClipboard(fullState);
    toast.success("Debug info copied to clipboard");
  };

  const handleClear = () => {
    clearDebugState();
    onClear();
    toast.success("Debug state cleared");
  };

  const hasError = !!debugState.lastError;
  const isRls = debugState.lastError ? isRlsError(debugState.lastError) : false;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-3 rounded-none hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium">Debug Panel</span>
              {hasError && (
                <Badge variant="destructive" className="text-xs">
                  Error Captured
                </Badge>
              )}
            </div>
            {isOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
            {/* Context Info */}
            <Card className="bg-muted/30">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Context</CardTitle>
              </CardHeader>
              <CardContent className="py-2 space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">authUserId:</span>
                  <span>{authUserId || "null"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">effectiveRole:</span>
                  <span>{effectiveRole || "vendor"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">effectiveUserId:</span>
                  <span>{effectiveUserId || user?.id || "null"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">proposalId:</span>
                  <span>{proposalId || "null"}</span>
                </div>
                {debugState.timestamp && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">lastAction:</span>
                    <span>{new Date(debugState.timestamp).toLocaleTimeString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Last Operation */}
            {debugState.lastOperationName && (
              <Card className="bg-muted/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Operation: {debugState.lastOperationName}
                    {hasError && <Badge variant="destructive">Failed</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  {debugState.lastPayload && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Payload:</p>
                      <ScrollArea className="h-32">
                        <pre className="text-xs font-mono bg-black/50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(debugState.lastPayload, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Error Details */}
            {debugState.lastError && (
              <Card className="bg-destructive/10 border-destructive/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-4 h-4" />
                    Supabase Error
                    {isRls && (
                      <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
                        RLS Issue
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2 space-y-3">
                  <ScrollArea className="h-40">
                    <pre className="text-xs font-mono bg-black/50 p-2 rounded overflow-x-auto text-red-300">
                      {JSON.stringify(debugState.lastError, null, 2)}
                    </pre>
                  </ScrollArea>
                  {isRls && (
                    <div className="text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded">
                      💡 This looks like an auth/RLS issue. Confirm vendor_user_id uses auth user id.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Debug
              </Button>
              <Button variant="outline" size="sm" onClick={handleClear}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Debug
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
