// src/copy/vendorChecklistsCopy.ts

export const vendorChecklistsCopy = {
  manager: {
    header: "Onboarding Checklists",
    subtitle: "Create custom onboarding checklists for your field reps",
    noTemplates: "No onboarding templates yet",
    noTemplatesHelper:
      "Create a template to start onboarding your field reps with custom checklists.",
    createFirstTemplateButton: "Create Your First Template",
    newTemplateButton: "New Template",
    paidBadge: "Paid Feature",
  },

  templateList: {
    emptyText: "No templates yet.",
    ownedBadge: "Your Template",
    itemsLabel: "items",
    assignedRepsLabel: "assigned reps",
  },

  editor: {
    createDialogTitle: "Create Onboarding Template",
    templateNameLabel: "Template Name",
    templateNamePlaceholder: "e.g., New Rep Onboarding",
    cancelButton: "Cancel",
    createButton: "Create Template",
    creatingButton: "Creating...",
    emptyItems: "This template has no items yet.",
    checklistItemsTab: "Checklist Items",
    assignedRepsTab: "Assigned Reps",
    addItemButton: "Add Item",
  },

  itemEditor: {
    addItemDialogTitle: "Add Checklist Item",
    titleLabel: "Title",
    titlePlaceholder: "e.g., Complete training module",
    descriptionLabel: "Description (optional)",
    descriptionPlaceholder: "Additional instructions or details...",
    requiredToggleLabel: "Required item",
    cancelButton: "Cancel",
    addButton: "Add Item",
    deleteTooltip: "Delete item",
    dragTooltip: "Drag to reorder",
    requiredBadge: "Required",
  },

  assignDialog: {
    title: "Assign Checklist to {repName}",
    description:
      "Select a checklist template to assign to this field rep. They'll see it on their dashboard and can track their progress.",
    emptyNoTemplates: "You haven't created any checklists yet.",
    emptyNoTemplatesHelper:
      "Go to your Vendor Profile to create custom onboarding checklists.",
    emptyAllAssigned: "All your checklists are already assigned to this rep.",
    cancelButton: "Cancel",
    assignButton: "Assign Checklist",
    assigningButton: "Assigning...",
    toasts: {
      assignSuccess: "Checklist assigned",
      assignSuccessDescription: "Successfully assigned checklist to {repName}.",
      assignError: "Failed to assign checklist. It may already be assigned.",
    },
  },

  repStatus: {
    sectionTitle: "Assigned Reps",
    helperText: "View progress for reps assigned to this checklist",
    noAssignments: "No reps assigned yet",
    noAssignmentsHelper:
      "Assign this template from the My Field Reps page",
    viewProgressButton: "View Progress",
    completionLabel: "Progress",
  },

  progressModal: {
    titlePrefix: "Progress for",
    closeButton: "Close",
    requiredLabel: "Required",
    optionalLabel: "Optional",
    completedLabel: "Completed",
    notCompletedLabel: "Not completed",
  },

  toasts: {
    templateCreated: "Template created",
    templateCreatedDescription:
      "Your onboarding checklist template has been created.",
    templateDeleted: "Template deleted",
    itemAdded: "Item added",
    itemAddedDescription: "Checklist item has been added.",
    itemDeleted: "Item deleted",
    error: "Error",
    errorDescription: "Something went wrong. Please try again.",
  },
};
