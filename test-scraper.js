import FirecrawlApp from "firecrawl";
import dotenv from "dotenv";

dotenv.config();

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

async function testSearch() {
  console.log("🔍 Testing Firecrawl search...");
  console.log("API Key:", process.env.FIRECRAWL_API_KEY ? "✓ Set" : "✗ Missing");
  console.log();

  try {
    const searchResult = await firecrawl.search("kung fu schools united states", {
      limit: 5,
      scrapeOptions: { formats: ["markdown"] },
    });

    console.log("Search result:", JSON.stringify(searchResult, null, 2));

    if (!searchResult.success) {
      console.error("Search failed:", searchResult.error);
      return;
    }

    console.log(`Found ${searchResult.data.length} results\n`);

    const urls = searchResult.data.slice(0, 5).map((r) => r.url);

    for (const url of urls) {
      await testScrape(url);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

async function testScrape(url) {
  console.log(`📄 Scraping: ${url}`);

  try {
    const scrapeResult = await firecrawl.scrape(url, {
      formats: ["extract"],
      extract: {
        schema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "School name",
            },
            location: {
              type: "string",
              description: "City and state",
            },
            address: {
              type: "string",
              description: "Street address",
            },
            phone: {
              type: "string",
              description: "Phone number",
            },
            instructors: {
              type: "string",
              description: "Instructor names",
            },
            styles: {
              type: "string",
              description: "Martial arts styles taught",
            },
          },
          required: ["name"],
        },
      },
    });

    if (!scrapeResult.extract) {
      console.log(`  ✗ Failed: no extract data\n`);
      return;
    }

    const data = scrapeResult.extract;
    console.log(`  ✓ ${data.name || "School"}`);
    console.log(`    Location: ${data.location || "N/A"}`);
    console.log(`    Phone: ${data.phone || "N/A"}`);
    console.log(`    Styles: ${data.styles || "N/A"}`);
    console.log();
  } catch (err) {
    console.error(`  ✗ Error: ${err.message}\n`);
  }
}

testSearch();
