import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  loadVendorTemplates,
  loadTemplateItems,
  loadTemplateAssignees,
  createVendorTemplate,
  addTemplateItem,
  assignTemplateToRep,
  ChecklistTemplate,
  ChecklistItemDefinition,
} from "@/lib/checklists";

export interface TemplateAssignee {
  userId: string;
  anonymousId: string;
  fullName: string | null;
  completedCount: number;
  totalCount: number;
  percent: number;
}

export function useVendorChecklists() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTemplates = useCallback(async () => {
    if (!user) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const data = await loadVendorTemplates(supabase, user.id);
    setTemplates(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const createTemplate = useCallback(async (name: string) => {
    if (!user) return null;
    const id = await createVendorTemplate(supabase, user.id, name);
    if (id) {
      await loadTemplates();
    }
    return id;
  }, [user, loadTemplates]);

  const addItem = useCallback(async (
    templateId: string,
    title: string,
    description: string,
    sortOrder: number,
    isRequired: boolean
  ) => {
    const id = await addTemplateItem(supabase, templateId, title, description, sortOrder, isRequired);
    return id;
  }, []);

  const getItems = useCallback(async (templateId: string): Promise<ChecklistItemDefinition[]> => {
    return loadTemplateItems(supabase, templateId);
  }, []);

  const getAssignees = useCallback(async (templateId: string): Promise<TemplateAssignee[]> => {
    return loadTemplateAssignees(supabase, templateId, user?.id);
  }, [user]);

  const assignToRep = useCallback(async (templateId: string, repUserId: string) => {
    const id = await assignTemplateToRep(supabase, templateId, repUserId);
    return id;
  }, []);

  const deleteTemplate = useCallback(async (templateId: string) => {
    const { error } = await supabase
      .from("checklist_templates")
      .delete()
      .eq("id", templateId);
    
    if (!error) {
      await loadTemplates();
    }
    return !error;
  }, [loadTemplates]);

  const updateItem = useCallback(async (
    itemId: string,
    updates: { title?: string; description?: string; is_required?: boolean; sort_order?: number }
  ) => {
    const { error } = await supabase
      .from("checklist_items")
      .update(updates)
      .eq("id", itemId);
    
    return !error;
  }, []);

  const deleteItem = useCallback(async (itemId: string) => {
    const { error } = await supabase
      .from("checklist_items")
      .delete()
      .eq("id", itemId);
    
    return !error;
  }, []);

  return {
    templates,
    loading,
    reload: loadTemplates,
    createTemplate,
    addItem,
    getItems,
    getAssignees,
    assignToRep,
    deleteTemplate,
    updateItem,
    deleteItem,
  };
}
