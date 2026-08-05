import { google } from "googleapis";
import { newId } from "../utils/id.js";
import { meetings, leads } from "../data/store.js";
import { getAuthorizedClient, isGoogleConfigured } from "./googleAuth.js";

const WORKDAY_START_HOUR = 9;
const WORKDAY_END_HOUR = 17;
const SLOT_MINUTES = 30;

/** Mock free/busy: every 30-min slot on the next 5 weekdays, minus booked meetings. */
export function getAvailability() {
  const booked = new Set(
    meetings
      .find((m) => m.status !== "cancelled")
      .map((m) => new Date(m.scheduledTime).toISOString())
  );

  const slots = [];
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() + 1);

  while (slots.length < 40) {
    const dow = day.getDay();
    if (dow !== 0 && dow !== 6) {
      for (let hour = WORKDAY_START_HOUR; hour < WORKDAY_END_HOUR; hour++) {
        for (let min = 0; min < 60; min += SLOT_MINUTES) {
          const slot = new Date(day);
          slot.setHours(hour, min, 0, 0);
          const iso = slot.toISOString();
          if (!booked.has(iso)) slots.push(iso);
        }
      }
    }
    day.setDate(day.getDate() + 1);
  }

  return slots.slice(0, 40);
}

/**
 * Creates a calendar event for a booked call. In MOCK mode this just creates
 * a Meeting record with a fake event id/link. Once Google OAuth env vars are
 * set, it creates a real event on your primary Google Calendar and emails a
 * real invite to the lead (sendUpdates: "all").
 */
export async function createEvent({ leadId, scheduledTime, duration = 30 }) {
  const configured = isGoogleConfigured();
  let calendarEventId = newId();
  let recordingLink = null;

  if (configured) {
    const lead = leads.get(leadId);
    const calendar = google.calendar({ version: "v3", auth: getAuthorizedClient() });
    const endTime = new Date(new Date(scheduledTime).getTime() + duration * 60 * 1000).toISOString();

    try {
      const { data } = await calendar.events.insert({
        calendarId: "primary",
        sendUpdates: "all", // emails a real invite to attendees
        requestBody: {
          summary: `Discovery call with ${lead?.name ?? "lead"}`,
          description: lead?.company ? `Re: ${lead.company}` : undefined,
          start: { dateTime: scheduledTime },
          end: { dateTime: endTime },
          attendees: lead?.email ? [{ email: lead.email }] : [],
        },
      });
      calendarEventId = data.id;
      recordingLink = data.htmlLink ?? null;
      console.log(`[calendar:live] event ${calendarEventId} created for lead ${leadId}`);
    } catch (err) {
      console.error("[calendar:live] event creation failed:", err.message);
    }
  } else {
    console.log(`[calendar:mock] booked ${scheduledTime} (${duration}m) for lead ${leadId}`);
  }

  return meetings.insert({
    leadId,
    calendlyEventId: null,
    calendarEventId,
    scheduledTime,
    duration,
    status: "scheduled",
    meetingNotes: "",
    followUpDate: null,
    recordingLink,
    mock: !configured,
  });
}

export function isCalendarConfigured() {
  return isGoogleConfigured();
}
