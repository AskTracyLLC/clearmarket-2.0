// src/copy/coveragePricingCopy.ts

export const coveragePricingCopy = {
  common: {
    sectionTitle: "Coverage & Pricing",
    sectionSubtitle:
      "Set where you work and what you charge so ClearMarket can match you with the right opportunities.",
    stateLabel: "State",
    countyLabel: "County",
    workTypeLabel: "Work type",
    priceLabel: "Price per job",
    currencySuffix: "per order",
    actionsLabel: "Actions",
    addCoverageButton: "Add Coverage Area",
    editButton: "Edit",
    deleteButton: "Delete",
    saveButton: "Save",
    cancelButton: "Cancel",
    searchPlaceholder: "Search by state, county, or work type",
    emptyState:
      "No coverage areas added yet. Add at least one area to get started.",
    multiSelectHelper:
      "Select all counties that share the same rate. We'll split them into separate rows when you save.",
  },

  fieldRep: {
    header: "Your Coverage & Rates",
    subtitle:
      "Let vendors know which areas you can cover and what your rates are.",
    tableTitle: "Your current coverage areas",
    addFirstCoverage:
      "Add your first coverage area to start showing up in searches.",
    tooltipWorkType:
      "Choose the inspection type this rate applies to. You can add more rows later for different work types.",
    tooltipPrice:
      "This is the amount you expect to be paid for completing this job in this area.",
  },

  vendor: {
    header: "Rep Coverage & Rates",
    subtitle:
      "Set your standard pay rates for reps in each area and work type.",
    tableTitle: "Configured rep rates",
    addFirstCoverage:
      "Add at least one coverage area to define your standard pay structure.",
    tooltipWorkType:
      "Choose the inspection type this pay rate applies to. You can adjust rates by area and work type.",
    tooltipPrice:
      "This is the amount you pay the rep for this type of work in this area.",
  },

  validation: {
    missingState: "Please select a state.",
    missingCounty: "Please select at least one county.",
    missingWorkType: "Please select a work type.",
    missingPrice: "Please enter a price.",
    invalidPrice: "Enter a valid price greater than zero.",
  },

  toasts: {
    saveSuccess: "Coverage and pricing saved.",
    saveError: "Unable to save coverage and pricing. Please try again.",
    deleteSuccess: "Coverage area removed.",
    deleteError: "Unable to remove coverage area. Please try again.",
  },
};
