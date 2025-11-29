// System-recommended message templates for vendors
// These are read-only templates available to all vendors

export interface MessageTemplate {
  name: string;
  body: string;
  scope: string;
}

export const SYSTEM_MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    name: "Intro – Standard",
    scope: "seeking_coverage",
    body: `Hi {{REP_ANON}},

Thanks for showing interest in {{POST_TITLE}} in {{POST_COUNTY}}, {{POST_STATE_CODE}}.

Our current offer on this work is {{POST_RATE}}. I'd like to confirm this lines up with what you typically accept in that area and get a sense of your availability.

Do you currently cover {{POST_COUNTY}}, {{POST_STATE_CODE}} and are you open to taking on more volume there?

Thanks!`
  },
  {
    name: "Intro – Rate Check",
    scope: "seeking_coverage",
    body: `Hi {{REP_ANON}},

I saw your interest in {{POST_TITLE}} for {{POST_COUNTY}}, {{POST_STATE_CODE}}.

We're offering {{POST_RATE}} on these inspections. Before we move forward, can you confirm if this rate works for you in this county?

If your typical minimum is higher, please let me know what you'd normally require so I can see if there's any flexibility.

Thanks!`
  },
  {
    name: "Intro – Coverage & Systems",
    scope: "seeking_coverage",
    body: `Hi {{REP_ANON}},

Thanks for responding to {{POST_TITLE}} in {{POST_COUNTY}}, {{POST_STATE_CODE}}.

I want to make sure we're aligned on a few basics:
- You cover {{POST_COUNTY}}, {{POST_STATE_CODE}} on a regular basis
- You're comfortable working in the systems listed on your profile: {{REP_SYSTEMS}}
- The inspection types listed on your profile ({{REP_INSPECTION_TYPES}}) line up with this request

If anything in your profile has changed, feel free to reply with your current coverage and systems.

Thank you!`
  },
  {
    name: "Intro – Availability & Turn Time",
    scope: "seeking_coverage",
    body: `Hi {{REP_ANON}},

Thank you for your interest in {{POST_TITLE}} in {{POST_COUNTY}}, {{POST_STATE_CODE}}.

These inspections are typically expected to be completed within our standard turn times (no rush): we're aiming for on-time completions without last-minute scrambling.

Can you let me know:
- What your usual turnaround time is in this area?
- Which days you're normally in or near {{POST_COUNTY}}, {{POST_STATE_CODE}}?

Once I know your schedule and typical turnaround, we can decide if this is a good ongoing fit.

Thanks!`
  },
  {
    name: "Intro – Extra Context",
    scope: "seeking_coverage",
    body: `Hi {{REP_ANON}},

I'm reaching out about {{POST_TITLE}} in {{POST_COUNTY}}, {{POST_STATE_CODE}}.

This area can be a bit challenging (distance, routing, and client expectations), so I want to set expectations clearly. Our current offer is {{POST_RATE}} per completed inspection.

Are you comfortable with:
- The travel involved for {{POST_COUNTY}}, {{POST_STATE_CODE}}?
- Handling occasional extra client questions or clarifications for this area?

If so, please let me know how many orders per week you'd realistically like to take on here.

Thanks!`
  },
  {
    name: "Follow-Up – No Response",
    scope: "seeking_coverage",
    body: `Hi {{REP_ANON}},

Just following up on your interest in {{POST_TITLE}} in {{POST_COUNTY}}, {{POST_STATE_CODE}}.

We're still looking to solidify coverage at {{POST_RATE}} and I wanted to check if you're still interested and available in this area.

If you're no longer available or the rate doesn't work for you, a quick reply either way is appreciated so we can update our notes.

Thank you!`
  },
  {
    name: "Rate – Not a Match (Soft)",
    scope: "seeking_coverage",
    body: `Hi {{REP_ANON}},

Thank you for your interest in {{POST_TITLE}} in {{POST_COUNTY}}, {{POST_STATE_CODE}}.

Right now, our approved rate for this work is {{POST_RATE}}. I understand if this doesn't fully align with your usual minimum in this area.

If you'd like, you can share what rate you typically need for {{POST_COUNTY}}, {{POST_STATE_CODE}} and I'll keep it noted in case future opportunities have more flexibility.

Either way, I appreciate you taking the time to respond.`
  },
  {
    name: "Not a Fit – Keep on File",
    scope: "seeking_coverage",
    body: `Hi {{REP_ANON}},

Thank you again for your interest in {{POST_TITLE}} in {{POST_COUNTY}}, {{POST_STATE_CODE}}.

Based on the rate and current client expectations, I don't think this specific opportunity is the best fit right now. However, I've noted your interest and coverage in {{REP_STATE}} and will keep you in mind for future work that better matches your minimums and preferences.

I appreciate your time and hope we can work together on a better-aligned opportunity soon.`
  },
  {
    name: "Post Closed – Coverage Established",
    scope: "seeking_coverage",
    body: `Hi {{REP_ANON}},

Coverage has now been established for {{POST_TITLE}}. We won't be assigning additional work from this request at this time, but please keep an eye on ClearMarket for future opportunities in your coverage areas.

Thank you again for your interest!`
  }
];
