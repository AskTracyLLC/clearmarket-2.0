import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { SYSTEM_MESSAGE_TEMPLATES, MessageTemplate } from "@/lib/systemMessageTemplates";
import { toast } from "@/hooks/use-toast";

interface TemplateSelectorProps {
  vendorId: string;
  onTemplateSelect: (body: string) => void;
}

interface VendorTemplate extends MessageTemplate {
  id: string;
  created_at: string;
  updated_at: string;
}

export function TemplateSelector({ vendorId, onTemplateSelect }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [vendorTemplates, setVendorTemplates] = useState<VendorTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && vendorTemplates.length === 0) {
      loadVendorTemplates();
    }
  }, [open]);

  async function loadVendorTemplates() {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendor_message_templates")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("scope", "seeking_coverage")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading templates:", error);
      toast({
        title: "Error",
        description: "Failed to load templates",
        variant: "destructive",
      });
    } else {
      setVendorTemplates(data || []);
    }
    setLoading(false);
  }

  function handleTemplateClick(template: MessageTemplate) {
    onTemplateSelect(template.body);
    setOpen(false);
    toast({
      title: "Template Inserted",
      description: "You can edit the message before sending",
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          <FileText className="w-4 h-4 mr-2" />
          Insert Template
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-4">
            {/* Vendor's Custom Templates */}
            {vendorTemplates.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  Your Templates
                  <Badge variant="secondary" className="text-xs">
                    {vendorTemplates.length}
                  </Badge>
                </h4>
                <div className="space-y-2">
                  {vendorTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateClick(template)}
                      className="w-full text-left p-3 rounded-md border border-border hover:bg-accent transition-colors"
                    >
                      <p className="font-medium text-sm">{template.name}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.body}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            {vendorTemplates.length > 0 && (
              <div className="border-t border-border" />
            )}

            {/* System Recommended Templates */}
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                Recommended Templates
                <Badge variant="outline" className="text-xs">
                  System
                </Badge>
              </h4>
              <div className="space-y-2">
                {SYSTEM_MESSAGE_TEMPLATES.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => handleTemplateClick(template)}
                    className="w-full text-left p-3 rounded-md border border-dashed border-border hover:bg-accent transition-colors"
                  >
                    <p className="font-medium text-sm">{template.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {template.body}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {loading && (
              <p className="text-center text-sm text-muted-foreground">
                Loading templates...
              </p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
