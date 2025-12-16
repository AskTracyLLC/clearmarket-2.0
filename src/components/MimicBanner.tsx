import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useMimic } from "@/hooks/useMimic";

export const MimicBanner = () => {
  const navigate = useNavigate();
  const { mimickedUser, isAdmin, stopMimic } = useMimic();

  // SECURITY: Only show banner if user is admin AND actively mimicking someone
  if (!isAdmin || !mimickedUser) return null;

  const handleExitMimic = () => {
    stopMimic();
    navigate("/admin/users");
  };

  return (
    <div className="bg-amber-600 text-white px-4 py-2 flex items-center justify-between gap-4 sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span className="text-sm font-medium">
          Viewing as: <span className="font-bold">{mimickedUser.full_name || mimickedUser.email}</span>
        </span>
        <span className="text-xs opacity-80">({mimickedUser.id.slice(0, 8)}...)</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExitMimic}
        className="text-white hover:bg-amber-700 hover:text-white gap-1"
      >
        <X className="h-4 w-4" />
        Exit mimic mode
      </Button>
    </div>
  );
};
