/**
 * Silly Spaces join form: one sheet row and one welcome email per sign-up,
 * plus a way to email everyone on the list.
 *
 * One-time setup, on a laptop (the Apps Script editor does not work on a phone).
 * Do all of it signed in as sillyspacesww@gmail.com, so every email comes from that address:
 *   1. Go to sheets.new and name the sheet "Silly Spaces list".
 *   2. Extensions, Apps Script. Delete what is there, paste this whole file, save.
 *   3. Deploy, New deployment. Type: Web app. Execute as: Me. Who has access: Anyone. Deploy.
 *   4. Approve the permission screen. It asks for Sheets (the rows) and Gmail (the emails).
 *   5. Copy the Web app URL and paste it into the join form's action in index.html,
 *      replacing the PASTE_YOUR_ID placeholder. Commit, open a PR, merge.
 *
 * Every submit adds one row: when, name, email, status, source. Then the welcome email goes out.
 * Rows land in the first tab. Open the sheet in the Google Sheets app to read them on
 * your phone. When someone replies stop, change their Status cell to stopped by hand
 * and they are skipped from then on. When the app is out, put the download link in
 * APP_LINK below. If you ever edit this file, Deploy, Manage deployments, Edit,
 * Version: New version, Deploy, or the change never goes live.
 */

// Where the app can be downloaded. Empty means the app is not out yet, and the
// welcome email says so instead of linking to it.
var APP_LINK = "";

var HEADERS = ["When", "Name", "Email", "Status", "Source"];
var SUBJECT = "You're on the Silly Spaces list";
var FROM_NAME = "Silly Spaces";
var REPLY_TO = "sillyspacesww@gmail.com";
var SITE = "https://sillyspaces.com";
var STOP_LINE = "Reply stop and we take you off the list.";
// Gmail caps one message at 50 BCC addresses, so a bigger list goes out in batches.
var BATCH = 50;

// The form posts here. One row and one welcome email per new address, nothing else.
function doPost(e) {
  var p = (e && e.parameter) || {};
  // the form has a hidden field real people never see; bots fill it in
  if (p.company) return reply({ ok: true });
  var name = String(p.name || "").trim().slice(0, 80);
  var email = String(p.email || "").trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ ok: false, error: "bad email" });

  var sheet = getSheet();
  // a second submit from the same person should not make a second row or a second email
  if (hasEmail(sheet, email)) return reply({ ok: true, note: "already on the list" });
  sheet.appendRow([
    Utilities.formatDate(new Date(), "America/Toronto", "yyyy-MM-dd HH:mm"),
    clean(name),
    clean(email),
    "active",
    "web"
  ]);
  // the row is what matters; a mail hiccup must not turn into a lost sign-up
  try {
    sendWelcome(email, name);
  } catch (err) {
    Logger.log("welcome email failed for " + email + ": " + err);
  }
  return reply({ ok: true });
}

// Opening the web app URL in a browser lands here. It only says what this is.
function doGet() {
  return reply({ ok: true, note: "Silly Spaces list. The join form posts here." });
}

// The first tab, with the header row written on first use so the columns are
// labelled before anyone has to read them.
function getSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Column C holds the emails. Case never matters in an address, so compare lower case.
function hasEmail(sheet, email) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var rows = sheet.getRange(2, 3, last - 1, 1).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (normalize(rows[i][0]) === email) return true;
  }
  return false;
}

// Everyone still on the list: column C where column D says active. Someone who
// replied stop has that cell set to stopped by hand and is left out here.
function activeEmails(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 3, last - 1, 2).getValues()
    .filter(function (r) { return String(r[1]).trim().toLowerCase() === "active"; })
    .map(function (r) { return normalize(r[0]); })
    .filter(Boolean);
}

// A cell value back to a plain lower case address. clean() may have put an
// apostrophe in front, and a hand-typed row may have spaces or capitals.
function normalize(v) {
  return String(v || "").replace(/^'/, "").trim().toLowerCase();
}

// a leading = or + would make Sheets treat the cell as a formula
function clean(s) {
  s = String(s || "").trim().slice(0, 200);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// The welcome email. Plain text, so it reads the same in every mail app.
function sendWelcome(email, name) {
  MailApp.sendEmail({ to: email, name: FROM_NAME, replyTo: REPLY_TO, subject: SUBJECT, body: welcomeBody(name) });
}

// The welcome text. It changes once APP_LINK is filled in, so the same sign-up
// gets the right story before and after the app is out. Greets by first name.
function welcomeBody(name) {
  var first = String(name || "").trim().split(/\s+/)[0];
  var app = APP_LINK
    ? "The member part lives in the Silly Spaces app: your record of events, photos from the day, a question every two weeks, and a notification before the email even goes out. Get it here: " + APP_LINK
    : "We're building a Silly Spaces app. That's where the member part lives: your record of events, photos from the day, a question every two weeks, and a notification before the email even goes out. The download link lands in this inbox the day it's out.";
  var site = (APP_LINK ? "Upcoming events" : "Until then, upcoming events") + " and photos from past ones are at " + SITE;
  return [
    "Hi" + (first ? " " + first : "") + ",",
    "",
    "You're on the list. When the next event has a date, you get one email with the where and when. A few a month at most.",
    "",
    app,
    "",
    site,
    "",
    "Silly Spaces, Markham, Ontario",
    STOP_LINE
  ].join("\n");
}

// Run this from the editor (pick it in the function dropdown, press Run) to email
// everyone on the list. Write the email as a Gmail draft first, with a subject
// that starts with "[list] ", so it can be read over and fixed before it goes out.
// The prefix is stripped and the plain text of the draft is what people get.
function sendLatestDraftToList() {
  var draft = latestListDraft();
  if (!draft) throw new Error("No draft with a subject starting with [list]");
  var msg = draft.getMessage();
  var subject = msg.getSubject().replace(/^\[list\]\s*/, "");
  var body = msg.getPlainBody() + "\n\n" + STOP_LINE;
  var list = activeEmails(getSheet());

  // Consumer Gmail gives Apps Script about 100 recipients a day. Each batch also
  // goes to our own address, so count that too. Past the limit, select column C
  // in the sheet and BCC from Gmail directly, which allows about 500.
  var needed = list.length + Math.ceil(list.length / BATCH);
  var quota = MailApp.getRemainingDailyQuota();
  if (quota < needed) {
    throw new Error("The list has " + list.length + " addresses but only " + quota + " emails can go out today. Select column C in the sheet and BCC from Gmail instead.");
  }
  for (var i = 0; i < list.length; i += BATCH) {
    MailApp.sendEmail({
      to: REPLY_TO,
      bcc: list.slice(i, i + BATCH).join(","),
      name: FROM_NAME,
      replyTo: REPLY_TO,
      subject: subject,
      body: body
    });
  }
  Logger.log("Sent \"" + subject + "\" to " + list.length + " address(es).");
}

// The newest draft whose subject starts with "[list] ". Drafts are checked by
// date rather than list order, so an old forgotten draft never goes out by mistake.
function latestListDraft() {
  var best = null, bestTime = 0;
  GmailApp.getDrafts().forEach(function (d) {
    var m = d.getMessage();
    if (m.getSubject().indexOf("[list] ") !== 0) return;
    var t = m.getDate().getTime();
    if (t > bestTime) { best = d; bestTime = t; }
  });
  return best;
}
