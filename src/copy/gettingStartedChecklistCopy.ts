// src/copy/gettingStartedChecklistCopy.ts

export const gettingStartedChecklistCopy = {
  widget: {
    completeBadge: "Complete",
    progressLabel: "required items completed",
    progressCount: "{completed} of {total}",
    emptyItems: "No steps in this checklist yet.",
  },

  reward: {
    title: "Complete required onboarding → Earn 5 credits",
    pendingDescription: "Finish the required steps above to claim your reward.",
    earnedBadge: "Earned",
    earnedDescription: "5 credits added to your wallet!",
    claimButton: "Claim Reward",
    claimingButton: "Claiming...",
  },

  itemRow: {
    completed: "Completed",
    completedOn: "Completed {date}",
    autoTrackedSuffix: "(auto-tracked)",
    autoBadge: "Auto",
    autoTooltip:
      "This step completes automatically when the related action happens in the app.",
    requiredBadge: "Required",
    feedbackTooltip: "Report an issue with this step",
    markDoneButton: "Mark Done",
    markDoneLoading: "...",
    ctas: {
      openProfile: "Open Profile",
      setCoverage: "Set Coverage & Pricing",
      goToCommunity: "Go to Community",
      viewConnections: "View Connections",
    },
  },

  feedbackDialog: {
    title: "Send feedback about this step",
    subtitle: "Let us know what went wrong or what could be clearer.",
    feedbackTypeLabel: "What's the issue?",
    feedbackTypePlaceholder: "Select feedback type",
    feedbackTypes: {
      bug: "Something is broken",
      confusing: "This step is confusing",
      completed_not_marked: "I completed this but it didn't mark done",
      suggestion: "I have a suggestion",
      other: "Other",
    },
    messageLabel: "Your feedback",
    messagePlaceholder: "Describe the issue or your suggestion...",
    attachmentsLabel: "Screenshots (optional)",
    uploadButton: "Upload screenshot",
    uploadingButton: "Uploading...",
    cancelButton: "Cancel",
    submitButton: "Submit Feedback",
    submittingButton: "Submitting...",
    toasts: {
      selectType: "Please select a feedback type",
      enterMessage: "Please enter your feedback",
      uploadFailed: "Could not upload {filename}",
      successTitle: "Thanks!",
      successDescription: "Your feedback for this step has been submitted.",
      errorTitle: "Error",
      errorDescription: "Failed to submit feedback",
    },
  },
};
