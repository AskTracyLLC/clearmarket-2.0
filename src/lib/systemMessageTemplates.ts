// System-recommended message templates for vendors
// These are read-only templates available to all vendors

export interface MessageTemplate {
  name: string;
  body: string;
  scope: string;
}

export const SYSTEM_MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    name: "Quick Intro / Confirm Interest",
    scope: "seeking_coverage",
    body: `Hi there,

I saw you expressed interest in this work. I wanted to reach out directly to confirm you're still available and interested.

Let me know if you have any questions about the job details or pricing.

Looking forward to working with you.`
  },
  {
    name: "Experience + Systems Check",
    scope: "seeking_coverage",
    body: `Hi,

Thanks for your interest! Before we move forward, I'd like to confirm a few things:

1. Do you have experience with this type of inspection?
2. Are you familiar with the systems we use?
3. What's your typical turnaround time?

Please let me know when you're available to discuss further.`
  },
  {
    name: "Rate Alignment Check",
    scope: "seeking_coverage",
    body: `Hi,

I appreciate your interest in this opportunity. I wanted to reach out to ensure we're aligned on pricing.

The rate for this work is as posted. Does this work for you? If you have any concerns or questions about the compensation, let's discuss.

Thanks!`
  },
  {
    name: "Availability & Route Details",
    scope: "seeking_coverage",
    body: `Hi,

Thanks for expressing interest! I'd like to learn more about your availability and coverage:

- Are you available to start immediately or within the next week?
- Do you typically work in this area, or would this be out of your normal route?
- What's your capacity for taking on additional work right now?

Looking forward to hearing from you.`
  },
  {
    name: "Trial Batch Proposal",
    scope: "seeking_coverage",
    body: `Hi,

I'd like to start with a small trial batch to ensure we're a good fit for each other.

Would you be open to handling [X number] inspections first? If that goes well, we can discuss ongoing work.

Let me know if this works for you.`
  },
  {
    name: "Not a Fit (Keep Door Open)",
    scope: "seeking_coverage",
    body: `Hi,

Thanks so much for your interest in this opportunity. After reviewing your profile and coverage, I don't think this particular job is the right fit right now.

However, I'd love to keep in touch for future opportunities that might align better with your expertise and location.

Best of luck, and I hope we can work together down the road!`
  }
];
