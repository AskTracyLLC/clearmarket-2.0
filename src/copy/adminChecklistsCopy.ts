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
