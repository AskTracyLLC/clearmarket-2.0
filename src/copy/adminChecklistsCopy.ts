// src/copy/adminChecklistsCopy.ts

export const adminChecklistsCopy = {
  dashboardCard: {
    title: "Checklists",
    subtitle:
      "Track beta user onboarding progress. View templates and identify stuck steps.",
    buttonLabel: "Manage Checklists",
  },

  pageHeader: {
    title: "Checklists & Onboarding",
    subtitle:
      "Manage platform checklists, vendor templates, and see where users are getting stuck.",
  },

  tabs: {
    templatesAndItems: "Templates & Items",
    completionInsights: "Completion Insights",
    feedback: "Feedback",
    assignToUsers: "Assign to Users",
  },

  assignSection: {
    title: "Assign Checklist to Users",
    helper: "Select a checklist template, filter users, and assign in bulk.",
    templateLabel: "Checklist template",
    templatePlaceholder: "Select a template",
    roleLabel: "User type",
    roleFieldReps: "Field Reps",
    roleVendors: "Vendors",
    stateLabel: "Vendor state",
    stateAll: "All states",
    noUsersMatch: "No users match your filters.",
    selectAll: "Select all",
    clearSelection: "Clear selection",
    selectAllInState: "Select all in this state",
    clearInState: "Clear selection in this state",
    assignButton: "Assign Checklist",
    assigningButton: "Assigning...",
    successToast: "Checklist assigned to selected users.",
    errorToast: "Unable to assign checklist. Please try again.",
    validationNoSelection: "Select at least one user to assign this checklist.",
    alreadyAssignedNote: "Already assigned",
    columns: {
      name: "Name",
      email: "Email",
      role: "Role",
      state: "State",
      status: "Status",
    },
  },

  templatesSection: {
    title: "Checklist Templates",
    helper:
      "These templates control what users see in their Getting Started checklist. System templates apply to all users.",
    emptyTemplates: "No templates yet.",
    emptySelection: "Select a template to view and edit its items.",
    addTemplateButton: "Add Template",
  },

  templateEditor: {
    headerPrefix: "Editing template:",
    helper:
      "Changes here affect all users assigned to this checklist.",
    emptyItems:
      "This template does not have any steps yet. Add items to define the checklist.",
    fields: {
      titleLabel: "Step title",
      descriptionLabel: "Helper text (shown under the step)",
      requiredLabel: "Required step",
    },
    autoBadge: {
      label: "Auto",
      tooltip:
        "This step completes automatically when the related action happens in the app.",
    },
    saveButton: "Save Changes",
  },

  completionInsights: {
    title: "Completion Overview",
    helper:
      "See how far users progress and which steps may need improvement.",
    emptyNoUsers:
      "No users are assigned to this checklist yet.",
    perItemEmpty: "No completions yet.",
    columns: {
      step: "Step",
      completion: "Completion",
      feedback: "Feedback",
    },
  },

  feedbackSection: {
    title: "Checklist Feedback",
    helper:
      "Review issues and screenshots submitted by users for each checklist step.",
    empty: "No feedback has been submitted yet.",
    columns: {
      step: "Step",
      user: "User",
      type: "Feedback type",
      message: "Comment",
      submitted: "Date",
    },
    detail: {
      header: "Feedback details",
      typeLabel: "Feedback type",
      messageLabel: "Comment",
      attachmentsLabel: "Attachments",
      noAttachments: "No attachments added.",
    },
  },
};
