import { leads, sequences, conversations, emailTemplates } from "./store.js";
import { onLeadCreated } from "../services/automation.js";
import { createEvent } from "../services/calendarService.js";

const TEMPLATES = [
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

const SAMPLE_LEADS = [
  { name: "Jordan Reyes", company: "Nimbus Freight", email: "jordan@nimbusfreight.com", phone: "555-0101", linkedinUrl: "https://linkedin.com/in/jordanreyes", icp: true, status: "cold", daysAgo: 0 },
  { name: "Priya Nair", company: "Kestrel Analytics", email: "priya@kestrelanalytics.io", phone: "555-0102", linkedinUrl: "https://linkedin.com/in/priyanair", icp: true, status: "warm", daysAgo: 6 },
  { name: "Marcus Webb", company: "Foundry Supply Co", email: "marcus@foundrysupply.com", phone: "555-0103", linkedinUrl: "https://linkedin.com/in/marcuswebb", icp: true, status: "hot", daysAgo: 12 },
  { name: "Elena Cho", company: "Bramble Retail", email: "elena@brambleretail.com", phone: "555-0104", linkedinUrl: "https://linkedin.com/in/elenacho", icp: false, status: "cold", daysAgo: 1 },
  { name: "Tariq Osei", company: "Vantage Logistics", email: "tariq@vantagelogistics.com", phone: "555-0105", linkedinUrl: "https://linkedin.com/in/tariqosei", icp: true, status: "customer", daysAgo: 45 },
  { name: "Sofia Marin", company: "Hearthstone Realty", email: "sofia@hearthstonerealty.com", phone: "555-0106", linkedinUrl: "https://linkedin.com/in/sofiamarin", icp: false, status: "rejected", daysAgo: 20 },
  { name: "Dev Patel", company: "Ridgeline Manufacturing", email: "dev@ridgelinemfg.com", phone: "555-0107", linkedinUrl: "https://linkedin.com/in/devpatel", icp: true, status: "warm", daysAgo: 8 },
  { name: "Amara Okafor", company: "Glasswing Consulting", email: "amara@glasswing.co", phone: "555-0108", linkedinUrl: "https://linkedin.com/in/amaraokafor", icp: true, status: "cold", daysAgo: 2 },
  { name: "Wesley Grant", company: "Northfield Logistics", email: "wesley@northfieldlogistics.com", phone: "555-0109", linkedinUrl: "https://linkedin.com/in/wesleygrant", icp: true, status: "followup", daysAgo: 15 },
];

function baseLeadFields(dateAdded) {
  return {
    emailOneSentDate: null,
    email1Opened: false,
    emailTwoSentDate: null,
    email2Opened: false,
    emailThreeSentDate: null,
    email3Opened: false,
    lastReplyDate: null,
    replyMessage: "",
    calendarLinkSentDate: null,
    callBooked: false,
    meetingDatetime: null,
    callDuration: null,
    dealStatus: "Pending",
    dealValue: 0,
    nextAction: "",
    lastUpdated: dateAdded,
  };
}

export function seed() {
  const insertedTemplates = TEMPLATES.map((t) => emailTemplates.insert(t));
  const firstTemplateId = insertedTemplates[0]._id;

  for (const s of SAMPLE_LEADS) {
    const dateAdded = new Date(Date.now() - s.daysAgo * 24 * 60 * 60 * 1000).toISOString();
    const lead = leads.insert({
      name: s.name,
      company: s.company,
      email: s.email,
      phone: s.phone,
      linkedinUrl: s.linkedinUrl,
      icp: s.icp,
      status: s.status,
      dateAdded,
      notes: "",
      ...baseLeadFields(dateAdded),
    });

    const sequence = onLeadCreated(lead);

    // Backfill sequence/conversation/flat-field history so warm/hot/customer leads look realistic.
    if (s.status !== "cold") {
      const replyDate = new Date(Date.now() - (s.daysAgo - 1) * 24 * 60 * 60 * 1000).toISOString();

      sequences.update(sequence._id, {
        email1Sent: { date: dateAdded, response: "Thanks for reaching out, tell me more!" },
        followUpDate: null,
      });
      leads.update(lead._id, {
        emailOneSentDate: dateAdded,
        email1Opened: true,
        lastReplyDate: replyDate,
        replyMessage: "Thanks for reaching out, tell me more!",
        nextAction: "Follow up on next steps",
        lastUpdated: replyDate,
      });
      conversations.update(
        conversations.findOne((c) => c.leadId === lead._id)._id,
        {
          messages: [
            {
              date: dateAdded,
              from: "you",
              to: lead.email,
              content: "Quick question on " + lead.company,
              type: "email",
              templateId: firstTemplateId,
            },
            {
              date: replyDate,
              from: lead._id,
              to: "you",
              content: "Thanks for reaching out, tell me more!",
              type: "reply",
            },
          ],
        }
      );
    }

    if (s.status === "hot" || s.status === "customer") {
      const scheduledTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      createEvent({ leadId: lead._id, scheduledTime, duration: 30 });
      sequences.update(sequence._id, {
        callBooked: { date: dateAdded, time: scheduledTime },
      });
      leads.update(lead._id, {
        callBooked: true,
        meetingDatetime: scheduledTime,
        callDuration: 30,
        calendarLinkSentDate: dateAdded,
        nextAction: "Prep for discovery call",
      });
    }

    if (s.status === "customer") {
      sequences.update(sequence._id, {
        dealClosed: { date: dateAdded, amount: 400000 },
      });
      leads.update(lead._id, {
        dealStatus: "Won",
        dealValue: 400000,
        nextAction: "Check in for upsell/referral",
      });
    }

    if (s.status === "rejected") {
      leads.update(lead._id, { dealStatus: "Lost", nextAction: "None" });
    }
  }
}
