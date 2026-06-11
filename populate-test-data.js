import { google } from "googleapis";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

async function populateSheet() {
  const credentials = JSON.parse(fs.readFileSync("./credentials.json", "utf-8"));
  const token = JSON.parse(fs.readFileSync("./token.json", "utf-8"));

  const oauth2Client = new google.auth.OAuth2(
    credentials.installed.client_id,
    credentials.installed.client_secret,
    credentials.installed.redirect_uris[0]
  );

  oauth2Client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
  });

  const sheets = google.sheets({ version: "v4", auth: oauth2Client });
  const sheetId = process.env.GOOGLE_SHEET_ID;

  // Add headers first
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: "A1:H1",
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          "Name",
          "Location",
          "Address",
          "Phone",
          "Website",
          "Instructors",
          "Styles",
          "Last Updated",
        ],
      ],
    },
  });

  // Add test schools
  const testSchools = [
    [
      "Kung Fu Kingdom",
      "National Directory",
      "Online",
      "",
      "https://kungfukingdom.com/review-of-kung-fu-schools-in-the-us-for-college-students/",
      "",
      "Kung Fu, Martial Arts",
      new Date().toISOString().split("T")[0],
    ],
    [
      "USA Kung Fu Academy",
      "San Diego, CA",
      "",
      "",
      "https://www.usakungfuacademy.com/",
      "",
      "Kung Fu",
      new Date().toISOString().split("T")[0],
    ],
    [
      "USA Shaolin Kung Fu",
      "San Diego, CA",
      "",
      "",
      "https://usashaolinkungfu.com/",
      "",
      "Shaolin Kung Fu, Wushu",
      new Date().toISOString().split("T")[0],
    ],
    [
      "USA Wushu Schools Directory",
      "National",
      "",
      "",
      "https://usawkf.org/school/page/4/",
      "",
      "Wushu, Kung Fu, Tai Chi",
      new Date().toISOString().split("T")[0],
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "A2:H",
    valueInputOption: "RAW",
    requestBody: {
      values: testSchools,
    },
  });

  console.log("✅ Successfully added 4 test schools to your Google Sheet");
  console.log("📄 Sheet: https://docs.google.com/spreadsheets/d/" + sheetId);
}

populateSheet().catch(console.error);
