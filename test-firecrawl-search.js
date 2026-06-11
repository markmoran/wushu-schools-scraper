import FirecrawlApp from "firecrawl";
import dotenv from "dotenv";

dotenv.config();

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

async function testSearch() {
  const query = "wushu schools United States";
  console.log(`Testing Firecrawl search: "${query}"\n`);

  try {
    const result = await firecrawl.search(query, {
      limit: 5,
      scrapeOptions: { formats: ["markdown"] },
    });

    console.log("Full result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error caught:");
    console.error("Message:", err.message);
    console.error("Full error:", err);
  }
}

testSearch();
