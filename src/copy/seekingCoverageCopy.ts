// src/copy/seekingCoverageCopy.ts

export const seekingCoverageCopy = {
  vendor: {
    sectionTitle: "Seeking Coverage",
    sectionSubtitle:
      "Post the areas where you need coverage so reps can raise their hand.",
    createButton: "New Seeking Coverage Post",
    editButton: "Edit Post",
    deleteButton: "Delete Post",
    emptyState:
      "You don't have any active Seeking Coverage posts. Create one to find reps in a specific area.",
    form: {
      headerNew: "Create Seeking Coverage Post",
      headerEdit: "Edit Seeking Coverage Post",
      areaLabel: "Coverage area",
      workTypesLabel: "Inspection types needed",
      notesLabel: "Notes for reps",
      notesPlaceholder:
        "Example: Looking for 5-day turnaround. Must be familiar with loss drafts.",
      saveButton: "Save Post",
      cancelButton: "Cancel",
    },
    interestedRepsSectionTitle: "Interested Field Reps",
    interestedRepsEmpty:
      "No reps have marked themselves as interested yet.",
    interestedRepsHelper:
      "Review rep profiles and agreements before assigning work.",
    yourOfferLabel: "Your offer",
    rateMatchLabel: "Rate match",
    rateMatchNote:
      "Reps will see whether the rate matches, not the exact dollar amount.",
  },

  fieldRep: {
    sectionTitle: "Coverage Opportunities",
    sectionSubtitle:
      "Review open coverage requests and mark yourself as interested where you can help.",
    emptyState:
      "No coverage opportunities match your current coverage areas. Check back later or update your coverage.",
    interestButton: "I'm interested",
    withdrawInterestButton: "Withdraw interest",
    interestNotesLabel: "Optional message to vendor",
    interestNotesPlaceholder:
      "Add a short note if there's anything the vendor should know (availability, experience, etc.).",
    interestSuccessToast:
      "Your interest has been sent to the vendor.",
    withdrawSuccessToast:
      "Your interest has been withdrawn.",
  },

  validation: {
    missingArea: "Please select at least one coverage area.",
    missingWorkTypes: "Please select at least one inspection type or leave blank if any type is okay.",
  },

  toasts: {
    saveSuccess: "Seeking Coverage post saved.",
    saveError: "Unable to save Seeking Coverage post. Please try again.",
    deleteSuccess: "Seeking Coverage post deleted.",
    deleteError: "Unable to delete Seeking Coverage post. Please try again.",
  },
};
