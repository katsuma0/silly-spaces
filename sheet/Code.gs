/**
 * Silly Spaces join form → Google Sheet.
 *
 * One-time setup, on a laptop (the Apps Script editor does not work on a phone):
 *   1. Go to sheets.new and name the sheet "Silly Spaces sign-ups".
 *   2. Extensions, Apps Script. Delete what is there, paste this whole file, save.
 *   3. Deploy, New deployment. Type: Web app. Execute as: Me. Who has access: Anyone. Deploy.
 *   4. Approve the permission screen (it only touches this sheet).
 *   5. Copy the Web app URL and paste it into the join form's action in index.html,
 *      replacing the PASTE_YOUR_ID placeholder. Commit, open a PR, merge.
 *
 * Every submit adds one row: when, name, event, email, phone, wants event emails.
 * Rows land in the first tab. Open the sheet in the Google Sheets app to read them
 * on your phone. If you ever edit this file, Deploy, Manage deployments, Edit,
 * Version: New version, Deploy, or the change never goes live.
 */

var HEADERS = ["When", "Name", "Event", "Email", "Phone", "Wants event emails"];

function doPost(e) {
  var p = (e && e.parameter) || {};
  // the form has a hidden field real people never see; bots fill it in
  if (p.company) return reply({ ok: true });
  if (!p.name) return reply({ ok: false, error: "no name" });

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    Utilities.formatDate(new Date(), "America/Toronto", "yyyy-MM-dd HH:mm"),
    clean(p.name),
    clean(p.attended),
    clean(p.email),
    clean(p.phone),
    p.newsletter === "yes" ? "Yes" : "No"
  ]);
  return reply({ ok: true });
}

function doGet() {
  return reply({ ok: true, note: "Silly Spaces sign-ups. The form posts here." });
}

// a leading = or + would make Sheets treat the cell as a formula
function clean(s) {
  s = String(s || "").trim().slice(0, 200);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
