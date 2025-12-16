export const checklistUserProgressCopy = {
  tabTitle: "Users",
  tabHelper:
    "See who has this checklist, how far along they are, and where they might be getting stuck.",

  table: {
    columns: {
      user: "User",
      role: "Role",
      completion: "Completion",
      steps: "Steps",
      lastUpdated: "Last updated",
      feedback: "Feedback",
    },
    completionFormat: "{percent}% complete",
    stepsFormat: "{completed} of {total} steps",
    noAssignments:
      "This checklist hasn't been assigned to anyone yet.",
  },

  feedback: {
    none: "No feedback",
    hasFeedback: "Feedback submitted",
    tooltip:
      "This user submitted feedback on one or more steps in this checklist.",
  },

  filters: {
    searchPlaceholder: "Search by name…",
    showOnlyIncomplete: "Show only incomplete",
  },
};
