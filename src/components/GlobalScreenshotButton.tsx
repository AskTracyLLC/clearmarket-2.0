import { useState, useCallback, useEffect } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type DialogState = "none" | "success" | "clipboard-failed";

export function GlobalScreenshotButton() {
  const [userId, setUserId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>("none");
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);

  // Get user ID directly from supabase to avoid circular auth context issues
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const captureScreenshot = useCallback(async () => {
    setCapturing(true);
    toast.info("Capturing screenshot…");

    try {
      // Lazy load html2canvas
      const html2canvas = (await import("html2canvas")).default;

      // Capture the entire document body to include modals/dialogs
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        scale: window.devicePixelRatio || 1,
        logging: false,
        // Ignore the screenshot button itself
        ignoreElements: (element) => {
          return element.hasAttribute("data-screenshot-button");
        },
      });

      // Convert to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png", 1.0);
      });

      if (!blob) {
        toast.error("Failed to capture screenshot");
        setCapturing(false);
        return;
      }

      setScreenshotBlob(blob);

      // Try to copy to clipboard
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        // Copy succeeded - show success dialog
        setDialogState("success");
      } catch (clipboardError) {
        console.error("Clipboard write failed:", clipboardError);
        // Clipboard failed - show fallback dialog
        setDialogState("clipboard-failed");
      }
    } catch (error) {
      console.error("Screenshot capture failed:", error);
      toast.error("Failed to capture screenshot. Please try again.");
    } finally {
      setCapturing(false);
    }
  }, []);

  const uploadScreenshotAndOpenSupport = useCallback(async () => {
    if (!screenshotBlob) {
      // Open support page without attachment
      window.location.href = "/support";
      return;
    }

    if (!userId) {
      // Not logged in - just open support page
      window.location.href = "/support";
      return;
    }

    toast.info("Uploading screenshot…");

    try {
      const fileName = `${userId}/${Date.now()}-screenshot.png`;

      const { error: uploadError } = await supabase.storage
        .from("support-attachments")
        .upload(fileName, screenshotBlob, {
          cacheControl: "3600",
          upsert: false,
          contentType: "image/png",
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("Upload failed — paste or upload manually.");
        // Open support page without attachment
        window.location.href = "/support";
        return;
      }

      const { data: urlData } = supabase.storage
        .from("support-attachments")
        .getPublicUrl(fileName);

      const publicUrl = urlData?.publicUrl;
      const currentPath = window.location.pathname;

      // Store the screenshot data in sessionStorage for the Support page to pick up
      if (publicUrl) {
        sessionStorage.setItem(
          "prefill-support-screenshot",
          JSON.stringify({
            imageUrl: publicUrl,
            prefillMessage: `URL: ${currentPath}\nTimestamp: ${new Date().toISOString()}`,
          })
        );
      }

      // Navigate to support page
      window.location.href = "/support";
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed — paste or upload manually.");
      window.location.href = "/support";
    }
  }, [screenshotBlob, userId]);

  const downloadScreenshot = useCallback(() => {
    if (!screenshotBlob) return;

    const url = URL.createObjectURL(screenshotBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `screenshot-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Screenshot downloaded");
  }, [screenshotBlob]);

  const handleClose = useCallback(() => {
    setDialogState("none");
    setScreenshotBlob(null);
  }, []);

  const handleCreateTicket = useCallback(() => {
    setDialogState("none");
    uploadScreenshotAndOpenSupport();
  }, [uploadScreenshotAndOpenSupport]);

  return (
    <>
      {/* Floating Screenshot Button */}
      <div
        data-screenshot-button
        className="fixed right-4 bottom-[88px] z-[9999]"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={captureScreenshot}
              disabled={capturing}
              className="h-10 w-10 rounded-full bg-card border-border shadow-lg hover:bg-accent"
              aria-label="Screenshot"
            >
              {capturing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Camera className="h-5 w-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Screenshot</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Success Dialog - Screenshot copied */}
      <Dialog
        open={dialogState === "success"}
        onOpenChange={(open) => !open && handleClose()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Screenshot copied</DialogTitle>
            <DialogDescription>
              Do you want to create a Support Ticket and attach it?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleClose}>
              Not now
            </Button>
            <Button onClick={handleCreateTicket}>Create Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clipboard Failed Dialog */}
      <Dialog
        open={dialogState === "clipboard-failed"}
        onOpenChange={(open) => !open && handleClose()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Couldn't copy screenshot</DialogTitle>
            <DialogDescription>
              Your browser doesn't support copying images to clipboard. You can
              download the screenshot or create a Support Ticket anyway.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={downloadScreenshot}>
              Download
            </Button>
            <Button variant="outline" onClick={handleClose}>
              Not now
            </Button>
            <Button onClick={handleCreateTicket}>Create Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
