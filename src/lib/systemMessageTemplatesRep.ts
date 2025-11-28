// System-recommended message templates for Field Reps
// These are read-only templates available to all reps

export interface MessageTemplate {
  name: string;
  body: string;
  scope: string;
}

export const SYSTEM_MESSAGE_TEMPLATES_REP: MessageTemplate[] = [
  {
    name: "Intro – Standard",
    scope: "seeking_coverage",
    body: `Hi {{VENDOR_CONTACT_FIRST_NAME}},

Thanks for posting {{POST_TITLE}} in {{POST_COUNTY}}, {{POST_STATE_CODE}}.

I'm interested in covering this area. I'm currently based in {{REP_STATE}} and my profile lists:
- Systems I use: {{REP_SYSTEMS}}
- Inspection types: {{REP_INSPECTION_TYPES}}

I just wanted to introduce myself and confirm I'm available to help with this coverage.

Thank you,
{{REP_ANON}}`
  },
  {
    name: "Intro – Rate & Scope Check",
    scope: "seeking_coverage",
    body: `Hi {{VENDOR_CONTACT_FIRST_NAME}},

I saw your {{POST_TITLE}} post for {{POST_COUNTY}}, {{POST_STATE_CODE}} at {{POST_RATE}}.

Before we move forward, can you confirm:
- Whether this rate is all-in (drive time, photos, form completion)?
- If there are any add-ons (rush, remote areas, extra client requirements) not covered in the base rate?

I want to be sure we're on the same page on scope and expectations before I commit.

Thanks!
{{REP_ANON}}`
  },
  {
    name: "Intro – Coverage & Routing",
    scope: "seeking_coverage",
    body: `Hi {{VENDOR_CONTACT_FIRST_NAME}},

I'm reaching out about {{POST_TITLE}} in {{POST_COUNTY}}, {{POST_STATE_CODE}}.

I regularly run routes through this area and can include these inspections in my normal schedule. I'm comfortable working in:
- Systems: {{REP_SYSTEMS}}
- Inspection types: {{REP_INSPECTION_TYPES}}

Can you share what the typical volume looks like for {{POST_COUNTY}}, {{POST_STATE_CODE}} (per week or per month)? That will help me plan routes efficiently.

Thanks in advance,
{{REP_ANON}}`
  },
  {
    name: "Intro – Turn Time & Expectations",
    scope: "seeking_coverage",
    body: `Hi {{VENDOR_CONTACT_FIRST_NAME}},

Regarding {{POST_TITLE}} in {{POST_COUNTY}}, {{POST_STATE_CODE}}:

I want to make sure my turnaround time lines up with your expectations. Under normal conditions, I can complete inspections in this area within standard turn times as long as orders are not assigned already past due.

Could you confirm:
- The expected turn time for this work
- Whether there are any recurring rush assignments in this county

If the expectations fit my current schedule, I'd be happy to help cover this area.

Thank you,
{{REP_ANON}}`
  },
  {
    name: "Rate – Counter Proposal",
    scope: "seeking_coverage",
    body: `Hi {{VENDOR_CONTACT_FIRST_NAME}},

Thank you for posting {{POST_TITLE}} for {{POST_COUNTY}}, {{POST_STATE_CODE}} at {{POST_RATE}}.

Given the distance and time involved in this area, my usual minimum for this county is higher than the posted rate. For {{POST_COUNTY}}, {{POST_STATE_CODE}}, I typically need a rate that reflects both travel and time on site.

My usual minimum for this type of work in that area is:

[Enter your proposed rate here.]

If there's any flexibility from the client side, I'd be glad to help you cover this area on an ongoing basis. If not, I completely understand and appreciate you considering me.

Thanks,
{{REP_ANON}}`
  },
  {
    name: "Follow-Up – Checking In",
    scope: "seeking_coverage",
    body: `Hi {{VENDOR_CONTACT_FIRST_NAME}},

Just following up on my interest in {{POST_TITLE}} for {{POST_COUNTY}}, {{POST_STATE_CODE}}.

I wanted to check if you're still looking for coverage in this area and whether you had a chance to review my interest and profile.

If you've already filled the coverage or the rate doesn't align, no problem at all — a quick update either way is appreciated.

Thank you,
{{REP_ANON}}`
  },
  {
    name: "Availability – Not Available Right Now",
    scope: "seeking_coverage",
    body: `Hi {{VENDOR_CONTACT_FIRST_NAME}},

I wanted to let you know that I'm currently unavailable to take on additional work in {{POST_COUNTY}}, {{POST_STATE_CODE}}.

If you already have me noted for {{POST_TITLE}} or future orders in this area, please feel free to keep my information on file, but I may need to pass on new assignments for a bit.

I'll reach back out when my schedule opens back up. Thank you for understanding.

Best,
{{REP_ANON}}`
  },
  {
    name: "Connected – Next Steps",
    scope: "seeking_coverage",
    body: `Hi {{VENDOR_CONTACT_FIRST_NAME}},

Thanks for marking me as Connected on {{POST_TITLE}} in {{POST_COUNTY}}, {{POST_STATE_CODE}}.

Before we get started, could you confirm:
- How you prefer to assign work (by batch, by day, or as-needed)?
- Any specific instructions or QC expectations for this client?
- Which system(s) you'll be assigning in (I currently use {{REP_SYSTEMS}})?

Once I have that, I'll be ready to move forward on coverage in this area.

Thank you,
{{REP_ANON}}`
  }
];
