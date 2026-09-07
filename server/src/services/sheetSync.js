import { users } from "../data/store.js";
import { insertLeadsFromRows, rowsFromCsv } from "../routes/leads.js";

/**
 * Turns a normal Google Sheets share link (any of the usual shapes — /edit,
 * /edit#gid=123, /view, etc.) into its public CSV export URL. Requires the
 * sheet to be shared as "Anyone with the link -> Viewer" — this fetches it
 * as a plain HTTP GET, no Google OAuth involved.
 */
export function toCsvExportUrl(sheetUrl) {
  const idMatch = String(sheetUrl ?? "").match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const id = idMatch[1];
  const gidMatch = String(sheetUrl).match(/[?#&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

/**
 * Pulls a user's connected Google Sheet, imports any leads that aren't already
 * in their account (deduped by email — see insertLeadsFromRows), and records
 * when this last ran. Safe to call repeatedly/on a schedule: rows already
 * imported are silently skipped, never duplicated.
 */
export async function syncUserSheet(user) {
  if (!user.sheetSyncUrl) return null;

  const csvUrl = toCsvExportUrl(user.sheetSyncUrl);
  if (!csvUrl) throw new Error("Could not find a Google Sheet ID in that link.");

  const res = await fetch(csvUrl);
  const text = await res.text();
  if (!res.ok || text.trim().toLowerCase().startsWith("<")) {
    throw new Error(
      'Could not read that sheet as CSV — make sure it\'s shared as "Anyone with the link → Viewer".'
    );
  }

  const rows = rowsFromCsv(text);
  const result = insertLeadsFromRows(rows, user._id);

  users.update(user._id, {
    sheetSyncLastRunAt: new Date().toISOString(),
    sheetSyncLastResult: result,
    sheetSyncLastError: null,
  });

  return result;
}

/** Called on an interval — syncs every account that has a Sheet connected. */
export async function syncAllUserSheets() {
  const withSheets = users.find((u) => u.sheetSyncUrl);
  for (const user of withSheets) {
    try {
      await syncUserSheet(user);
    } catch (err) {
      console.error(`[sheet-sync] failed for user ${user._id}:`, err.message);
      users.update(user._id, { sheetSyncLastError: err.message });
    }
  }
}
