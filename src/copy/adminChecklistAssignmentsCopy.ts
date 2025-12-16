// src/copy/adminChecklistAssignmentsCopy.ts

export const adminChecklistAssignmentsCopy = {
  tabTitle: "Assign Checklist",
  tabHelper: "Select a template, then choose users to assign it to. Users who already have this checklist will be skipped.",

  noTemplateSelected: {
    title: "Select a Template First",
    description: "Choose a checklist template from the Templates tab to assign it to users.",
  },

  fieldReps: {
    header: "Field Reps",
    helper: "Select field reps to assign this checklist.",
    searchPlaceholder: "Search by name...",
    masterLabel: "Select all field reps",
    empty: {
      noUsers: "No field reps found.",
      noMatches: "No field reps match your search.",
    },
    footer: {
      noneSelected: "No field reps selected",
      someSelected: "{count} field rep(s) selected",
    },
  },

  vendors: {
    header: "Vendors",
    helper: "Select vendors to assign this checklist.",
    searchPlaceholder: "Search by vendor name...",
    masterLabel: "Select all vendors",
    empty: {
      noUsers: "No vendors found.",
      noMatches: "No vendors match your search.",
    },
    footer: {
      noneSelected: "No vendors selected",
      someSelected: "{count} vendor(s) selected",
    },
  },

  actions: {
    assignButton: "Assign Checklist",
    assignDisabled: "Select at least one user to assign",
    confirm: {
      title: "Confirm Assignment",
      description: "You are about to assign this checklist to {count} user(s). They will see it in their Getting Started section.",
      confirmButton: "Yes, Assign",
      cancelButton: "Cancel",
    },
    toast: {
      success: "Checklist assigned successfully",
      error: "Failed to assign checklist. Please try again.",
    },
  },

  badges: {
    alreadyAssigned: "Already assigned",
    active: "Active",
    inactive: "Inactive",
  },
};
