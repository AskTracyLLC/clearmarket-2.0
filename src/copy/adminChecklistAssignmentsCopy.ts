// src/copy/adminChecklistAssignmentsCopy.ts

export const adminChecklistAssignmentsCopy = {
  tabTitle: "Assign Checklist",
  tabHelper: "Select a template, then choose users to assign it to. Users who already have this checklist will be skipped.",

  noTemplateSelected: {
    title: "Select a Template First",
    description: "Choose a checklist template from the Templates tab to assign it to users.",
  },

  fieldReps: {
    sectionTitle: "Field Reps",
    sectionHelper: "Select field reps to assign this checklist. Filter by state, status, or search by name/email.",
    filters: {
      stateLabel: "State",
      statePlaceholder: "All states",
      activeOnlyLabel: "Only show active reps",
      searchPlaceholder: "Search by name or email...",
    },
    columns: {
      name: "Name",
      email: "Email",
      coverageAreas: "Coverage Area(s)",
      status: "Status",
      assigned: "Assigned",
    },
    emptyState: "No field reps match your filters.",
  },

  vendors: {
    sectionTitle: "Vendors",
    sectionHelper: "Select vendors to assign this checklist. Use the state grouping to quickly assign by region.",
    filters: {
      stateLabel: "State",
      statePlaceholder: "All states",
      groupByStateLabel: "Group by State",
      activeOnlyLabel: "Only show active vendors",
      searchPlaceholder: "Search by company or email...",
    },
    columns: {
      companyName: "Company Name",
      email: "Email",
      focusAreas: "Focus Areas",
      status: "Status",
      assigned: "Assigned",
    },
    emptyState: "No vendors match your filters.",
  },

  bulkControls: {
    selectAll: "Select All",
    clearSelection: "Clear Selection",
    selectAllInState: "Select all",
    clearInState: "Clear",
    selectedCount: "{count} user(s) selected",
    noSelection: "No users selected",
  },

  assignButton: {
    label: "Assign Checklist",
    labelAssigning: "Assigning...",
    disabled: "Select at least one user to assign",
  },

  actions: {
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
