import { Info } from "lucide-react";

interface ReviewHelperTipsProps {
  isVendorReviewing: boolean;
}

export function ReviewHelperTips({ isVendorReviewing }: ReviewHelperTipsProps) {
  return (
    <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Info className="h-4 w-4 text-muted-foreground" />
        Tips for a helpful review
      </div>
      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside pl-1">
        <li>Keep it short and specific.</li>
        <li>Say if they were on time or if there were delays.</li>
        <li>Mention if the work was done right the first time.</li>
        <li>Share how communication felt — clear, slow, or missing.</li>
      </ul>
    </div>
  );
}
