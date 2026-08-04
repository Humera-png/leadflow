import { newId } from "../utils/id.js";
import { meetings } from "../data/store.js";

const CALENDAR_CONFIGURED = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN
);

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
 * set, swap this for a real `calendar.events.insert` call.
 */
export function createEvent({ leadId, scheduledTime, duration = 30 }) {
  const eventId = newId();
  const meeting = meetings.insert({
    leadId,
    calendlyEventId: null,
    calendarEventId: eventId,
    scheduledTime,
    duration,
    status: "scheduled",
    meetingNotes: "",
    followUpDate: null,
    recordingLink: null,
    mock: !CALENDAR_CONFIGURED,
  });

  if (!CALENDAR_CONFIGURED) {
    console.log(
      `[calendar:mock] booked ${scheduledTime} (${duration}m) for lead ${leadId}`
    );
  } else {
    // TODO: real Google Calendar event creation via googleapis client
    console.log(`[calendar:live-not-implemented] lead ${leadId}`);
  }

  return meeting;
}

export function isCalendarConfigured() {
  return CALENDAR_CONFIGURED;
}
