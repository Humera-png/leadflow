import { emailTemplates } from "./store.js";

// Default email sequence templates given to every new account on signup — each
// account's copy is independent from there (edit/delete freely, e.g. Freelance vs
// NaviaLabs can diverge completely).
const DEFAULT_TEMPLATES = [
  {
    name: "First Cold Email",
    subject: "Quick question on {{company}}",
    body: `Hey {{name}},

Noticed you're scaling {{company}}. I help founders eliminate manual chaos so their teams can focus on growth.

Most founders I work with are losing 15+ hours/week to manual processes.

Quick question: What's your biggest bottleneck right now?

-Humera`,
  },
  {
    name: "Follow-up #1",
    subject: "Re: Quick question on {{company}}",
    body: `Hey {{name}},

Following up on my last email.

I've helped similar companies to {{company}} automate their order processing—saves them 20+ hours/week.

Curious if this is something worth exploring?

-Humera`,
  },
  {
    name: "Final Check-in",
    subject: "Quick check-in",
    body: `Hey {{name}},

One more quick check in. If this isn't the right time, no worries—let me know!

But if you'd like to explore how to save your team 15+ hours/week, I'm here.

-Humera`,
  },
];

export function seedTemplatesForUser(ownerId) {
  for (const t of DEFAULT_TEMPLATES) emailTemplates.insert({ ...t, ownerId });
}
