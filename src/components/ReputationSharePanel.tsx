import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Share2 } from "lucide-react";
import { createShareLink, getMyShareLink, toggleShareLinkEnabled } from "@/lib/reputationSharing";
import { formatDistanceToNow } from "date-fns";

interface ReputationSharePanelProps {
  roleType: 'rep' | 'vendor';
}

export function ReputationSharePanel({ roleType }: ReputationSharePanelProps) {
  const [shareLink, setShareLink] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadShareLink();
  }, [roleType]);

  async function loadShareLink() {
    try {
      const link = await getMyShareLink(roleType);
      setShareLink(link);
    } catch (error) {
      console.error('Error loading share link:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateLink() {
    setCreating(true);
    try {
      const newLink = await createShareLink(roleType);
      setShareLink(newLink);
      toast({
        title: "Share link created",
        description: "Your public reputation snapshot is now available to share."
      });
    } catch (error) {
      console.error('Error creating share link:', error);
      toast({
        title: "Failed to create link",
        description: "Please try again.",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleEnabled(enabled: boolean) {
    if (!shareLink) return;
    try {
      await toggleShareLinkEnabled(shareLink.id, enabled);
      setShareLink({ ...shareLink, is_enabled: enabled });
      toast({
        title: enabled ? "Snapshot enabled" : "Snapshot disabled",
        description: enabled
          ? "Your public snapshot is now visible."
          : "Your public snapshot is now hidden from public view."
      });
    } catch (error) {
      console.error('Error toggling share link:', error);
      toast({
        title: "Update failed",
        description: "Please try again.",
        variant: "destructive"
      });
    }
  }

  function handleCopyLink() {
    if (!shareLink) return;
    const url = `${window.location.origin}/snapshot/${shareLink.slug}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Share this link with potential partners."
    });
  }

  function handlePreview() {
    if (!shareLink) return;
    window.open(`/snapshot/${shareLink.slug}`, '_blank');
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Snapshot
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!shareLink) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Snapshot
          </CardTitle>
          <CardDescription>
            Share your ClearMarket Reputation Snapshot with potential partners.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCreateLink} disabled={creating}>
            {creating ? "Generating..." : "Generate share link"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const shareUrl = `${window.location.origin}/snapshot/${shareLink.slug}`;
  const lastViewed = shareLink.last_viewed_at
    ? formatDistanceToNow(new Date(shareLink.last_viewed_at), { addSuffix: true })
    : 'Never';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Share Snapshot
        </CardTitle>
        <CardDescription>
          Share your public reputation snapshot with anyone, even outside ClearMarket.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="enable-snapshot"
            checked={shareLink.is_enabled}
            onCheckedChange={handleToggleEnabled}
          />
          <Label htmlFor="enable-snapshot">Enable public snapshot</Label>
        </div>

        {shareLink.is_enabled && (
          <>
            <div className="space-y-2">
              <Label>Share URL</Label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border"
                />
                <Button size="icon" variant="outline" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={handlePreview}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Last viewed {lastViewed} • {shareLink.view_count} total views
            </div>
          </>
        )}

        {!shareLink.is_enabled && (
          <p className="text-sm text-muted-foreground">
            Your snapshot is currently disabled. Enable it to share with potential partners.
          </p>
        )}
      </CardContent>
    </Card>
  );
}