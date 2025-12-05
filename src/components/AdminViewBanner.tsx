import { ShieldAlert } from "lucide-react";

const AdminViewBanner = () => (
  <div className="mb-3 rounded-md bg-amber-900/40 border border-amber-500/40 px-3 py-2 text-xs text-amber-100 flex items-center gap-2">
    <ShieldAlert className="h-4 w-4 flex-shrink-0" />
    <span>
      You are viewing this page with <span className="font-semibold">Admin</span> access. 
      Some actions may affect other users.
    </span>
  </div>
);

export default AdminViewBanner;
