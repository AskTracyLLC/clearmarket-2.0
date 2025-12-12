import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface MimicBannerProps {
  mimickedUserName: string;
  mimickedUserEmail: string;
  mimickedUserId: string;
}

export const MimicBanner = ({ mimickedUserName, mimickedUserEmail, mimickedUserId }: MimicBannerProps) => {
  const navigate = useNavigate();

  const handleExitMimic = () => {
    navigate("/admin/users");
  };

  return (
    <div className="bg-amber-600 text-white px-4 py-2 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span className="text-sm font-medium">
          Viewing as: <span className="font-bold">{mimickedUserName || mimickedUserEmail}</span>
        </span>
        <span className="text-xs opacity-80">({mimickedUserId.slice(0, 8)}...)</span>
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
