import fs from "fs";
import { google } from "googleapis";
import readline from "readline";

const credentials = JSON.parse(fs.readFileSync("./credentials.json"));

const oauth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);

const scopes = ["https://www.googleapis.com/auth/spreadsheets"];

// Generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: scopes,
});

console.log("Authorize this app by visiting this url:");
console.log(authUrl);
console.log();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter the authorization code from the URL: ", async (code) => {
  rl.close();

  try {
    const { tokens } = await oauth2Client.getToken(code);

    // Write token.json
    fs.writeFileSync("./token.json", JSON.stringify(tokens, null, 2));
    console.log("✓ Token saved to token.json");

    // Extract token content for env var
    console.log("\n✓ New GOOGLE_TOKEN_JSON:");
    console.log(JSON.stringify(tokens));

    console.log("\nNext steps:");
    console.log("1. Copy the GOOGLE_TOKEN_JSON above");
    console.log("2. Update GOOGLE_TOKEN_JSON in your Trigger.dev dashboard");
    console.log("3. Re-run the test");
  } catch (err) {
    console.error("Error getting token:", err.message);
    process.exit(1);
  }
});
