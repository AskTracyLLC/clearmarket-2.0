import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { 
  MessageSquare, 
  Search, 
  User,
  Users,
  PlusCircle
} from "lucide-react";

interface QuickActionsProps {
  isRep: boolean;
  isVendor: boolean;
}

interface ActionItem {
  icon: React.ReactNode;
  label: string;
  description: string;
  link: string;
  color: string;
}

export function QuickActions({ isRep, isVendor }: QuickActionsProps) {
  const navigate = useNavigate();

  const repActions: ActionItem[] = [
    {
      icon: <MessageSquare className="h-5 w-5" />,
      label: "Messages",
      description: "View conversations",
      link: "/messages",
      color: "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20",
    },
    {
      icon: <Search className="h-5 w-5" />,
      label: "Find Work",
      description: "Browse opportunities",
      link: "/rep/find-work",
      color: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
    },
    {
      icon: <User className="h-5 w-5" />,
      label: "Profile",
      description: "Edit your profile",
      link: "/rep/profile",
      color: "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20",
    },
  ];

  const vendorActions: ActionItem[] = [
    {
      icon: <MessageSquare className="h-5 w-5" />,
      label: "Messages",
      description: "View conversations",
      link: "/messages",
      color: "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20",
    },
    {
      icon: <PlusCircle className="h-5 w-5" />,
      label: "Seeking Coverage",
      description: "Post new request",
      link: "/vendor/seeking-coverage",
      color: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: "My Reps",
      description: "Manage connections",
      link: "/vendor/my-reps",
      color: "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20",
    },
  ];

  const actions = isRep ? repActions : isVendor ? vendorActions : [];

  if (actions.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      {actions.map((action) => (
        <Card 
          key={action.link}
          className={`bg-card border-border cursor-pointer transition-all ${action.color}`}
          onClick={() => navigate(action.link)}
        >
          <CardContent className="p-4 text-center">
            <div className="flex justify-center mb-2">
              {action.icon}
            </div>
            <p className="text-sm font-medium text-foreground">{action.label}</p>
            <p className="text-xs text-muted-foreground">{action.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
