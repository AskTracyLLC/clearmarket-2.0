import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2 } from "lucide-react";
import { ProfileSharePanel } from "@/components/ProfileSharePanel";
import { SeekingCoverageToggle } from "@/components/SeekingCoverageToggle";
import { Separator } from "@/components/ui/separator";

export default function VendorShareProfilePage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
          <Share2 className="h-8 w-8" />
          Share Profile
        </h1>
        <p className="text-muted-foreground">
          Create a shareable link to showcase your vendor profile outside ClearMarket
        </p>
      </div>

      <ProfileSharePanel roleType="vendor" />

      <Separator className="my-6" />

      {/* Seeking Coverage Areas Toggle */}
      <div className="p-4 bg-muted/30 rounded-lg border border-border">
        <h3 className="font-semibold mb-3">Public Profile Options</h3>
        <SeekingCoverageToggle />
      </div>

      <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border">
        <h3 className="font-semibold mb-2">How to use your share link</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Add it to your company website or email signature</li>
          <li>• Include it in proposals to potential field reps</li>
          <li>• Share on LinkedIn or industry forums</li>
          <li>• Use in recruiting materials to build trust</li>
        </ul>
      </div>
    </div>
  );
}
