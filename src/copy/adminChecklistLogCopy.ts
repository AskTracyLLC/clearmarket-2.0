// src/copy/adminChecklistLogCopy.ts

export const adminChecklistLogCopy = {
  pageTitle: "Checklist Assignment Log",
  pageSubtitle:
    "See when checklists were assigned, who they went to, which vendor they came from, and whether they were auto or manual.",

  filters: {
    dateRangeLabel: "Date range",
    vendorLabel: "Vendor",
    templateLabel: "Checklist",
    sourceLabel: "Source",
    searchPlaceholder: "Search by user name or email…",
    sourceOptions: {
      all: "All sources",
      autoOnConnect: "Auto – new connection",
      manualVendor: "Manual – vendor",
      manualAdmin: "Manual – admin",
    },
    clearButton: "Clear filters",
  },

  table: {
    columns: {
      timestamp: "Date",
      template: "Checklist",
      user: "Assigned to",
      vendor: "Vendor",
      source: "Source",
    },
    sourceBadges: {
      autoOnConnect: "Auto – new connection",
      manualVendor: "Manual – vendor",
      manualAdmin: "Manual – admin",
      unknown: "Unknown",
    },
    empty:
      "No assignment events match your filters. Try adjusting the date range or search.",
  },
};
