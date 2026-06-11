import fs from "fs";
import { google } from "googleapis";

const token = JSON.parse(fs.readFileSync("./token.json"));
const credentials = JSON.parse(fs.readFileSync("./credentials.json"));

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

async function createSheet() {
  try {
    const resource = {
      properties: {
        title: "Martial Arts Schools Directory",
      },
      sheets: [
        {
          properties: { sheetId: 0, title: "Schools" },
          data: [
            {
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: "Name" } },
                    { userEnteredValue: { stringValue: "Location" } },
                    { userEnteredValue: { stringValue: "Address" } },
                    { userEnteredValue: { stringValue: "Phone" } },
                    { userEnteredValue: { stringValue: "Website" } },
                    { userEnteredValue: { stringValue: "Instructors" } },
                    { userEnteredValue: { stringValue: "Styles" } },
                    { userEnteredValue: { stringValue: "Last Updated" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const response = await sheets.spreadsheets.create({
      resource,
      fields: "spreadsheetId",
    });

    const sheetId = response.data.spreadsheetId;
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

    console.log("✓ Sheet created!");
    console.log(`Sheet ID: ${sheetId}`);
    console.log(`URL: ${sheetUrl}`);

    // Write to .env
    let envContent = fs.readFileSync("./.env", "utf-8");
    envContent = envContent.replace(/GOOGLE_SHEET_ID=/, `GOOGLE_SHEET_ID=${sheetId}`);
    fs.writeFileSync("./.env", envContent);

    console.log("✓ Updated .env with Sheet ID");
  } catch (err) {
    console.error("Error creating sheet:", err.message);
    process.exit(1);
  }
}

createSheet();
