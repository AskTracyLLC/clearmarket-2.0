// src/copy/vendorChecklistAssignmentsCopy.ts

export const vendorChecklistAssignmentsCopy = {
  tabTitle: "Assign to Reps",
  tabHelper: "Select the reps you want to assign this checklist to.",
  selectTemplatePrompt: "Select a template from the Templates tab to assign to your reps.",

  yourReps: {
    header: "Your Reps",
    helper: "Select the reps you want to assign this checklist to.",
    searchPlaceholder: "Search by rep name...",
    masterLabel: "All reps",
    footer: {
      noneSelected: "No reps selected.",
      someSelected: "{count} rep(s) selected.",
    },
    empty: {
      noUsers: "You don't have any connected reps yet.",
      noMatches: "No reps match your search.",
    },
  },

  badges: {
    alreadyAssigned: "Already assigned",
  },

  actions: {
    assignButton: "Assign Checklist",
    assignDisabled: "Select at least one rep to assign this checklist.",
    confirm: {
      title: "Assign Checklist",
      description: "You're about to assign \"{templateName}\" to {count} rep(s). They will see this checklist on their dashboard immediately.",
      cancel: "Cancel",
      confirm: "Assign Now",
    },
    toast: {
      success: "Checklist assigned successfully to {count} rep(s).",
      error: "Failed to assign checklist. Please try again.",
    },
  },

  templateType: {
    header: "Checklist Type",
    onboarding: {
      label: "Onboarding (Auto-assign to new reps)",
      description: "This checklist will automatically assign to any rep you connect in the future.",
    },
    manual: {
      label: "Manual assignment only",
      description: "This checklist will only be sent when you assign it manually.",
    },
  },
};
