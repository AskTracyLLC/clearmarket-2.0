/**
 * Verbatim microcopy for Vendor Proposals features
 * DO NOT PARAPHRASE - use these strings exactly as written
 */

export const vendorProposalsCopy = {
  // Share Proposal Button Tooltip
  shareButton: {
    title: "Share Proposal",
    body: "Create a private link your client can view. You control expiration and access.",
  },

  // Share Modal
  shareModal: {
    title: "Share Proposal",
    subtitle: "Create a private link your client can view. You control expiration and access.",
    passcodeToggleLabel: "Require passcode (optional)",
    passcodeHelperText: "Adds an extra layer of protection. You'll need to share the passcode separately.",
    generateLinkButton: "Generate Link",
    linkReadyCallout: "Link ready. Copy and send it to your client.",
    copyLinkButton: "Copy Link",
    expiresNote: (dateStr: string) => `This link expires on ${dateStr}. You can revoke it anytime.`,
    draftWarning: "Draft Warning: This proposal is still a draft. Share only if you're comfortable with changes.",
    activeLinksHeader: "Active Links",
    revokeConfirmTitle: "Revoke link?",
    revokeConfirmBody: "This link will stop working immediately.",
    revokeButton: "Revoke Link",
    cancelButton: "Cancel",
    expirationOptions: [
      { value: 1, label: "1 day" },
      { value: 3, label: "3 days" },
      { value: 7, label: "7 days" },
      { value: 14, label: "14 days" },
      { value: 30, label: "30 days" },
    ],
  },

  // Public Proposal Page
  publicPage: {
    header: "Proposal Preview",
    subheader: "Shared via ClearMarket. This page is private.",
    footer: "Powered by ClearMarket",
    passcodeRequired: {
      title: "Enter Passcode",
      body: "This proposal is protected. Enter the passcode provided by the sender.",
      unlockButton: "Unlock",
      errorText: "That passcode doesn't match. Please try again.",
    },
    locked: (minutes: number) => `Too many attempts. Please try again in ${minutes} minutes.`,
    expired: "This link has expired. Please request a new link from the sender.",
    revoked: "This link is no longer active. Please request a new link from the sender.",
    invalid: "This link is not valid.",
  },

  // Paid Feature Badge
  paidBadge: {
    label: "Paid (Beta Free)",
    tooltipTitle: "Paid Feature (Beta Free)",
    tooltipBody: "This feature will use credits after beta. During beta testing, it's free to use.",
  },

  // Out of Credits Modal
  outOfCredits: {
    title: "Out of Credits",
    body: "You're out of credits for this feature.",
    secondaryLine: "Basic proposal building is always free — but Compare Against Field Rep Pricing and CSV Export use credits.",
    footnote: "Clients will never see your rep costs. This is only used to assist in your proposal building.",
    betaHint: "During beta testing, this feature may be free depending on your account.",
    getCreditsButton: "Get Credits",
    cancelButton: "Not Now",
  },

  // Confirm Credit Use Modal
  confirmCreditUse: {
    title: "Use 1 Credit?",
    compareBody: "This will use 1 credit to run a rep-cost check and refresh margin warnings.",
    csvBody: "This will use 1 credit to export a CSV.",
    dontAskCheckbox: "Don't ask again this session",
    useButton: "Use Credit",
    cancelButton: "Cancel",
  },
};
