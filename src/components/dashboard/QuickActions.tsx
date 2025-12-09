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

  // Light mode: light tint bg + dark icon/text for accessibility
  // Dark mode: darker tint bg + colored icon
  const repActions: ActionItem[] = [
    {
      icon: <MessageSquare className="h-5 w-5" />,
      label: "Messages",
      description: "View conversations",
      link: "/messages",
      color: "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20",
    },
    {
      icon: <Search className="h-5 w-5" />,
      label: "Find Work",
      description: "Browse opportunities",
      link: "/rep/find-work",
      color: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20",
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: "My Vendors",
      description: "Your connections",
      link: "/rep/my-vendors",
      color: "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20",
    },
    {
      icon: <User className="h-5 w-5" />,
      label: "Profile",
      description: "Edit your profile",
      link: "/rep/profile",
      color: "bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:hover:bg-purple-500/20",
    },
  ];

  const vendorActions: ActionItem[] = [
    {
      icon: <MessageSquare className="h-5 w-5" />,
      label: "Messages",
      description: "View conversations",
      link: "/messages",
      color: "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20",
    },
    {
      icon: <PlusCircle className="h-5 w-5" />,
      label: "Seeking Coverage",
      description: "Post new request",
      link: "/vendor/seeking-coverage",
      color: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20",
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: "My Reps",
      description: "Manage connections",
      link: "/vendor/my-reps",
      color: "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20",
    },
    {
      icon: <User className="h-5 w-5" />,
      label: "Profile",
      description: "Edit company profile",
      link: "/vendor/profile",
      color: "bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:hover:bg-purple-500/20",
    },
  ];

  const actions = isRep ? repActions : isVendor ? vendorActions : [];

  if (actions.length === 0) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
      {actions.map((action) => (
        <Card 
          key={action.link}
          className={`border-border cursor-pointer transition-all ${action.color}`}
          onClick={() => navigate(action.link)}
        >
          <CardContent className="p-3 text-center">
            <div className="flex justify-center mb-1">
              {action.icon}
            </div>
            {/* Force dark text in light mode for readability */}
            <p className="text-xs sm:text-sm font-medium text-inherit">{action.label}</p>
            <p className="text-xs opacity-70 hidden lg:block">{action.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
