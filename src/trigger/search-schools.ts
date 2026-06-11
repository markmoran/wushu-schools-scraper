import { schedules, wait } from "@trigger.dev/sdk";
import { scrapeSchool } from "./scrape-school.js";
import { google } from "googleapis";
import FirecrawlApp from "firecrawl";

interface School {
  name: string;
  location: string;
  address: string;
  phone: string;
  website: string;
  instructors: string;
  styles: string;
  lastUpdated: string;
}

async function getGoogleSheetAuth() {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
  const tokenJson = process.env.GOOGLE_TOKEN_JSON;

  if (!credentialsJson) throw new Error("GOOGLE_CREDENTIALS_JSON is not set");
  if (!tokenJson) throw new Error("GOOGLE_TOKEN_JSON is not set");

  const credentials = JSON.parse(credentialsJson);
  const token = JSON.parse(tokenJson);

  const oauth2Client = new google.auth.OAuth2(
    credentials.installed.client_id,
    credentials.installed.client_secret,
    credentials.installed.redirect_uris[0]
  );

  oauth2Client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
  });

  return oauth2Client;
}

interface SchoolWithRowIndex extends School {
  rowIndex: number;
}

async function getExistingSchools(): Promise<SchoolWithRowIndex[]> {
  try {
    const auth = await getGoogleSheetAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "A2:H1000",
    });

    const rows = response.data.values || [];
    return rows.map((row, index) => ({
      name: row[0] || "",
      location: row[1] || "",
      address: row[2] || "",
      phone: row[3] || "",
      website: row[4] || "",
      instructors: row[5] || "",
      styles: row[6] || "",
      lastUpdated: row[7] || "",
      rowIndex: index + 2, // +2 because row 1 is headers, rows start at 2
    }));
  } catch (err) {
    console.log("Could not fetch existing schools (first run?)", err);
    return [];
  }
}

async function appendToSheet(schools: School[]): Promise<void> {
  if (schools.length === 0) return;

  const auth = await getGoogleSheetAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");

  const rows = schools.map((s) => [
    s.name,
    s.location,
    s.address,
    s.phone,
    s.website,
    s.instructors,
    s.styles,
    s.lastUpdated,
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "A:H",
    valueInputOption: "RAW",
    requestBody: {
      values: rows,
    },
  });

  console.log(`✓ Added ${schools.length} schools to sheet`);
}

async function updateSheetRows(
  updates: Array<{ rowIndex: number; data: School }>
): Promise<void> {
  if (updates.length === 0) return;

  const auth = await getGoogleSheetAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");

  for (const update of updates) {
    const row = update.rowIndex;
    const data = update.data;
    const values = [
      [
        data.name,
        data.location,
        data.address,
        data.phone,
        data.website,
        data.instructors,
        data.styles,
        data.lastUpdated,
      ],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `A${row}:H${row}`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  }

  console.log(`✓ Updated ${updates.length} existing schools in sheet`);
}

interface DedupResult {
  toAdd: School[];
  toUpdate: Array<{ rowIndex: number; data: School }>;
}

async function deduplicateAndMerge(
  newSchools: School[],
  existingSchools: SchoolWithRowIndex[]
): Promise<DedupResult> {
  const existingMap = new Map(
    existingSchools.map((s) => [`${s.name}|${s.location}`.toLowerCase(), s])
  );

  const toAdd: School[] = [];
  const toUpdate: Array<{ rowIndex: number; data: School }> = [];

  for (const newSchool of newSchools) {
    const key = `${newSchool.name}|${newSchool.location}`.toLowerCase();
    const existing = existingMap.get(key);

    if (!existing) {
      toAdd.push(newSchool);
    } else {
      // Merge: prefer new data if more complete
      const merged: School = { ...existing };
      let changed = false;

      if (newSchool.phone && !existing.phone) {
        merged.phone = newSchool.phone;
        changed = true;
      }
      if (newSchool.instructors && !existing.instructors) {
        merged.instructors = newSchool.instructors;
        changed = true;
      }
      if (newSchool.styles && !existing.styles) {
        merged.styles = newSchool.styles;
        changed = true;
      }
      if (newSchool.address && !existing.address) {
        merged.address = newSchool.address;
        changed = true;
      }

      if (changed) {
        merged.lastUpdated = new Date().toISOString().split("T")[0];
        toUpdate.push({ rowIndex: existing.rowIndex, data: merged });
        existingMap.set(key, { ...merged, rowIndex: existing.rowIndex });
      }
    }
  }

  return { toAdd, toUpdate };
}

export const searchSchools = schedules.task({
  id: "search-martial-arts-schools",
  cron: "0 6 * * 1", // Monday 6 AM UTC

  run: async () => {
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY is not set");

    const firecrawl = new FirecrawlApp({
      apiKey: firecrawlKey,
    });

    console.log("🔍 Starting school search...");

    const queries = [
      "wushu schools United States",
      "kung fu schools United States",
      "tai chi schools United States",
    ];

    const allUrls = new Set<string>();

    // Search for schools
    for (const query of queries) {
      console.log(`Searching: ${query}`);
      try {
        const searchResult = await firecrawl.search(query, {
          limit: 15,
          scrapeOptions: { formats: ["markdown"] },
        });

        console.log(`Search result for "${query}":`, {
          success: searchResult.success,
          dataLength: searchResult.data ? searchResult.data.length : 0,
          error: (searchResult as any).error,
        });

        if (searchResult.success && searchResult.data) {
          for (const result of searchResult.data) {
            if (result.url) {
              allUrls.add(result.url);
            }
          }
        } else if (!searchResult.success) {
          console.error(`Search failed for "${query}": ${(searchResult as any).error}`);
        }
      } catch (err) {
        console.error(`Search failed for "${query}":`, err);
      }
    }

    console.log(`Found ${allUrls.size} unique URLs`);

    // If no URLs found, return early
    if (allUrls.size === 0) {
      console.log("No schools found in search results");
      return {
        searched: 0,
        scraped: 0,
        added: 0,
        updated: 0,
        timestamp: new Date().toISOString(),
      };
    }

    // Trigger and wait for all scraping tasks
    const results = await scrapeSchool.batchTriggerAndWait(
      Array.from(allUrls).map((url) => ({
        payload: { url },
        options: {
          idempotencyKey: `scrape-${Buffer.from(url).toString("base64")}`,
        },
      }))
    );

    console.log(`Completed ${results.length} scraping tasks`);

    // Collect schools and discover additional URLs from directories
    const scrapedSchools: School[] = [];
    const discoveredUrls = new Set<string>();

    for (const result of results) {
      if (result.ok && result.output) {
        const output = result.output as any;
        if (output.type === "directory" && output.discoveredUrls) {
          // Found a directory, add discovered URLs for processing
          for (const url of output.discoveredUrls) {
            discoveredUrls.add(url);
          }
        } else {
          // It's a school, add to results
          scrapedSchools.push(output as School);
        }
      }
    }

    // If we found directories with schools, scrape those schools (with a safety cap)
    if (discoveredUrls.size > 0) {
      const discoveredArray = Array.from(discoveredUrls);
      const maxSecondPass = 50;

      if (discoveredArray.length > maxSecondPass) {
        console.warn(
          `⚠️  Found ${discoveredArray.length} schools in directories, but capping at ${maxSecondPass} to avoid excessive API usage`
        );
      }

      const urlsToProcess = discoveredArray.slice(0, maxSecondPass);
      console.log(`Scraping ${urlsToProcess.length} schools from directories...`);

      const discoveredResults = await scrapeSchool.batchTriggerAndWait(
        urlsToProcess.map((url) => ({
          payload: { url },
          options: {
            idempotencyKey: `scrape-${Buffer.from(url).toString("base64")}`,
          },
        }))
      );

      for (const result of discoveredResults) {
        if (result.ok && result.output) {
          const output = result.output as any;
          if (output.type !== "directory") {
            scrapedSchools.push(output as School);
          }
        }
      }
    }

    console.log(`Successfully scraped ${scrapedSchools.length} schools`);

    // Get existing schools and deduplicate
    const existingSchools = await getExistingSchools();
    const { toAdd, toUpdate } = await deduplicateAndMerge(
      scrapedSchools,
      existingSchools
    );

    console.log(`Adding ${toAdd.length} new schools, updating ${toUpdate.length} existing schools`);

    // Update sheet
    await appendToSheet(toAdd);
    await updateSheetRows(toUpdate);

    return {
      searched: allUrls.size,
      scraped: scrapedSchools.length,
      added: toAdd.length,
      updated: toUpdate.length,
      timestamp: new Date().toISOString(),
    };
  },
});
