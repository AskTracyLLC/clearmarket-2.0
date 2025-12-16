// src/copy/alertsCopy.ts

export const alertsCopy = {
  repAlerts: {
    sectionTitle: "Route & Availability Alerts",
    sectionSubtitle:
      "Let your vendors know where you'll be and when you're available.",
    newAlertButton: "Send Route/Availability Alert",
    emptyState:
      "You haven't sent any alerts yet. Send an alert to let vendors know your plans.",
    form: {
      headerNew: "Send Route/Availability Alert",
      routeLabel: "Route or area",
      routePlaceholder: "Example: Schaumburg, IL area all day Friday",
      datesLabel: "Date or date range",
      notesLabel: "Notes for vendors",
      notesPlaceholder:
        "Add details like time windows, limited availability, or special conditions.",
      sendButton: "Send Alert",
      cancelButton: "Cancel",
    },
    toasts: {
      sendSuccess: "Alert sent to your selected vendors.",
      sendError: "Unable to send alert. Please try again.",
    },
  },

  vendorView: {
    sectionTitle: "Rep Alerts",
    sectionSubtitle:
      "Field Reps use alerts to tell you where they'll be and when they're available.",
    emptyState:
      "No alerts from your reps right now.",
    acknowledgeButton: "Thumbs up",
    acknowledgeTooltip:
      "Acknowledge this alert so the rep knows you've seen it.",
    acknowledgedLabel: "Acknowledged",
    toasts: {
      acknowledgeSuccess:
        "Alert acknowledged. The rep will see you've received it.",
      acknowledgeError:
        "Unable to acknowledge this alert. Please try again.",
    },
  },
};
