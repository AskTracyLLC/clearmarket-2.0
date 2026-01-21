import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, ClipboardList, FileSearch } from "lucide-react";
import { Link } from "react-router-dom";
import { useCurrentUserRoles } from "@/hooks/useCurrentUserRoles";

type ToolModule = "clearbooking" | "cleartrack" | "clearqueue" | null;

const Tools = () => {
  const [openModal, setOpenModal] = useState<ToolModule>(null);
  const { flags } = useCurrentUserRoles();
  const isSuperAdmin = flags?.is_super_admin === true;

  const modules = [
    {
      id: "clearbooking" as const,
      title: "ClearBooking",
      subtitle: "Scheduling + appointment execution accountability",
      icon: Calendar,
      helpSlug: "/help/clearbooking",
      description: "ClearBooking is designed to bring appointment communication and follow-ups into one place, so you're not scrambling across multiple systems to figure out what's happening on an order. ClearBooking is not a dispatching program or service — orders will still be worked and updated in the vendor's required system. This is simply a streamlined command center to improve efficiency and accountability. More details coming soon.",
    },
    {
      id: "cleartrack" as const,
      title: "ClearTrack",
      subtitle: "Completed work + payment reconciliation",
      icon: DollarSign,
      helpSlug: "/help/cleartrack",
      description: "ClearTrack helps you keep track of completed work and whether or not it's been paid. More details coming soon.",
    },
    {
      id: "clearqueue" as const,
      title: "ClearQueue",
      subtitle: "Update queue + Pulse analytics + Watchlist",
      icon: ClipboardList,
      helpSlug: "/help/clearqueue",
      description: "ClearQueue helps you manage your update queue, monitor order activity with Pulse analytics, and keep tabs on important orders with Watchlist. More details coming soon.",
    },
  ];

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Tools</h1>
          <p className="text-muted-foreground mt-2">
            The Clear ecosystem — additional modules to streamline your workflow.
          </p>
        </div>

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <Card
              key={module.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setOpenModal(module.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <module.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{module.title}</CardTitle>
                      <CardDescription className="mt-1">{module.subtitle}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">Coming soon</Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* ClearCheck - Super Admin Only (Development) */}
        {isSuperAdmin && (
          <Card className="mt-6 border-primary/30 bg-primary/5">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileSearch className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">ClearCheck</CardTitle>
                    <CardDescription className="mt-1">
                      Order status tracking, avg turnaround times, contact chasing
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 border-primary/50 text-primary">
                  Dev Only
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button asChild size="sm">
                <Link to="/ops/clearcheck">Dashboard</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/ops/import">Import</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-sm text-muted-foreground mt-6 text-center">
          Have an idea for a helpful tool?{" "}
          <Link
            to="/support?category=feature"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Submit it here
          </Link>
          .
        </p>

        {/* ClearBooking Modal */}
        <Dialog open={openModal === "clearbooking"} onOpenChange={(open) => !open && setOpenModal(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <DialogTitle>ClearBooking</DialogTitle>
                  <DialogDescription>Scheduling + appointment execution accountability</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4">
              <Badge variant="secondary">Coming soon</Badge>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {modules[0].description}
              </p>
              <div className="pt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/help/clearbooking">Learn more</Link>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ClearTrack Modal */}
        <Dialog open={openModal === "cleartrack"} onOpenChange={(open) => !open && setOpenModal(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <DialogTitle>ClearTrack</DialogTitle>
                  <DialogDescription>Completed work + payment reconciliation</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4">
              <Badge variant="secondary">Coming soon</Badge>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {modules[1].description}
              </p>
              <div className="pt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/help/cleartrack">Learn more</Link>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ClearQueue Modal */}
        <Dialog open={openModal === "clearqueue"} onOpenChange={(open) => !open && setOpenModal(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ClipboardList className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <DialogTitle>ClearQueue</DialogTitle>
                  <DialogDescription>Update queue + Pulse analytics + Watchlist</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4">
              <Badge variant="secondary">Coming soon</Badge>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {modules[2].description}
              </p>
              <div className="pt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/help/clearqueue">Learn more</Link>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default Tools;
