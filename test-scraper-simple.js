import FirecrawlApp from "firecrawl";
import dotenv from "dotenv";

dotenv.config();

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

async function test() {
  console.log("🔍 Searching for kung fu schools...\n");

  const searchResult = await firecrawl.search("kung fu schools united states", {
    limit: 8,
  });

  console.log("Search response structure:", Object.keys(searchResult));

  const results = searchResult.web || searchResult.data || [];
  if (!Array.isArray(results) || results.length === 0) {
    console.error("No results found");
    console.log("Full response:", JSON.stringify(searchResult).slice(0, 500));
    return;
  }

  const urls = results.slice(0, 5).map((r) => r.url);
  console.log(`Found ${urls.length} URLs to scrape\n`);

  let count = 0;
  for (const url of urls) {
    try {
      console.log(`📄 Scraping: ${url}`);

      const scrapeResult = await firecrawl.scrape(url, {
        formats: ["markdown"],
      });

      if (scrapeResult.markdown) {
        count++;
        console.log(`✓ School ${count}:`);
        console.log(`  Website: ${url}`);
        console.log(`  Content preview: ${scrapeResult.markdown.slice(0, 150).replace(/\n/g, " ")}...\n`);
      } else {
        console.log(`✗ Failed to extract content\n`);
      }
    } catch (err) {
      console.log(`✗ Error: ${err.message}\n`);
    }

    if (count >= 5) break;
  }

  console.log(`\n✅ Successfully extracted ${count} schools`);
}

test().catch(console.error);
