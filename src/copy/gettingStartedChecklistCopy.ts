// src/copy/gettingStartedChecklistCopy.ts

export const gettingStartedChecklistCopy = {
  widget: {
    completeBadge: "Complete",
    progressLabel: "required items completed",
    progressCount: "{completed} of {total}",
    emptyItems: "No steps in this checklist yet.",
  },

  reward: {
    // Generic (rep) reward copy
    title: "Complete required onboarding → Earn 5 credits",
    pendingDescription: "Finish the required steps above to claim your reward.",
    earnedBadge: "Earned",
    earnedDescription: "5 credits added to your wallet!",
    claimButton: "Claim Reward",
    claimingButton: "Claiming...",
  },

  vendorReward: {
    // Milestone tier (2 credits)
    milestoneTitle: "Complete profile + verification → Earn 2 credits",
    milestonePending: "Finish your profile and submit verification to claim.",
    milestoneEarned: "2 credits earned!",
    milestoneClaimButton: "Claim 2 Credits",
    // Full onboarding tier (3 more credits)
    fullTitle: "Complete all onboarding → Earn 3 more credits",
    fullPending: "Finish the remaining steps to claim your bonus.",
    fullEarned: "3 credits earned!",
    fullClaimButton: "Claim 3 Credits",
    // Total earned
    totalEarned: "{count} of 5 credits earned",
    maxEarned: "All 5 credits earned!",
    // Applied state (credits awarded before checklist complete)
    appliedBadge: "Applied",
    milestoneApplied: "2 credits already applied to your wallet.",
    fullApplied: "3 credits already applied. {stepsRemaining} required steps remaining.",
    totalApplied: "5 credits already applied",
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
