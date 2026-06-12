import { task } from "@trigger.dev/sdk";
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

interface ScraperResponse {
  type: "school" | "directory";
  school?: School;
  discoveredUrls?: string[];
}

interface ExtractedData {
  name: string;
  location: string;
  address: string;
  phone: string;
  website: string;
  instructors: string;
  styles: string;
  schools?: Array<{ name: string; url?: string }>;
}

function isDirectory(extractedData: ExtractedData): boolean {
  if (!extractedData.schools || extractedData.schools.length < 3) {
    return false;
  }
  return extractedData.schools.length >= 3;
}

async function discoverSchoolUrls(url: string): Promise<string[]> {
  try {
    console.log(`🔍 Discovering schools in directory: ${url}`);
    const mapResult = await firecrawl.map(url, {
      search: "school martial arts kung fu wushu tai chi",
      limit: 50,
    });

    if (!mapResult.links) {
      return [];
    }

    // Filter for school-like URLs (exclude the directory page itself)
    const schoolUrls = mapResult.links.filter((link: string) => {
      const lowerLink = link.toLowerCase();
      // Exclude common non-school patterns
      if (
        lowerLink.includes("directory") ||
        lowerLink.includes("page") ||
        lowerLink.includes("archive/page") ||
        lowerLink.includes("contact") ||
        lowerLink.includes("about") ||
        lowerLink.includes("privacy") ||
        lowerLink === url
      ) {
        return false;
      }
      // Include if it looks like a school page
      return (
        lowerLink.includes("school") ||
        lowerLink.includes("academy") ||
        lowerLink.includes("martial") ||
        lowerLink.match(/^https?:\/\/[^\/]+\/$/) // Root domain pages
      );
    });

    return schoolUrls.slice(0, 20); // Limit to 20 schools per directory
  } catch (err) {
    console.error(`Failed to discover schools in ${url}:`, err);
    return [];
  }
}

export const scrapeSchool = task({
  id: "scrape-school-details",
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5000,
  },

  run: async (payload: { url: string }): Promise<School | ScraperResponse> => {
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY is not set");

    const firecrawl = new FirecrawlApp({
      apiKey: firecrawlKey,
    });

    const { url } = payload;

    console.log(`Scraping: ${url}`);

    try {
      // Scrape as markdown (cheaper than LLM extraction)
      const scrapeResult = await firecrawl.scrape(url, {
        formats: ["markdown"],
      });

      if (!scrapeResult.markdown) {
        throw new Error("Failed to scrape content from page");
      }

      const markdown = scrapeResult.markdown;
      const lowerMarkdown = markdown.toLowerCase();

      // Simple directory detection: check for key indicators
      const isDir =
        lowerMarkdown.includes("directory") ||
        lowerMarkdown.includes("schools near") ||
        lowerMarkdown.includes("all schools") ||
        markdown.match(/school\s+1|school\s+2|location\s+1|location\s+2/i);

      if (isDir) {
        console.log(`📋 Detected directory: ${url}`);
        const discoveredUrls = await discoverSchoolUrls(url);
        console.log(`Found ${discoveredUrls.length} schools in directory`);
        return {
          type: "directory",
          discoveredUrls,
        } as ScraperResponse;
      }

      // Extract school details from markdown using regex
      const titleMatch =
        markdown.match(/^#\s+(.+)$/m) || markdown.match(/^##\s+(.+)$/m);
      const name = titleMatch ? titleMatch[1].trim() : "Unknown School";

      const phoneMatch = markdown.match(
        /\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/
      );
      const phone = phoneMatch
        ? `${phoneMatch[1]}-${phoneMatch[2]}-${phoneMatch[3]}`
        : "";

      const addressMatch = markdown.match(
        /(\d+\s+[A-Za-z\s]+(?:St|Ave|Blvd|Rd|Drive|Lane|Court|Way|Road|Street|Avenue|Boulevard))/i
      );
      const address = addressMatch ? addressMatch[1] : "";

      const instructorsMatch = markdown.match(
        /(?:Instructor|Teacher|Master|Sensei)s?:?\s*(.+?)(?:\n|$)/i
      );
      const instructors = instructorsMatch ? instructorsMatch[1].trim() : "";

      const stylesMatch = markdown.match(
        /(?:styles?|martial arts|disciplines?|classes?|specialties?):?\s*(.+?)(?:\n|$)/i
      );
      const styles = stylesMatch
        ? stylesMatch[1].trim()
        : "Kung Fu, Wushu, Tai Chi";

      // Try to extract location from content
      let location = "Unknown Location";
      const locationMatch = markdown.match(
        /(?:located in|based in|in\s+)([A-Za-z\s,]+?)(?:\.|,|\n)/i
      );
      if (locationMatch) {
        location = locationMatch[1].trim();
      }

      const school: School = {
        name,
        location,
        address,
        phone,
        website: url,
        instructors,
        styles,
        lastUpdated: new Date().toISOString().split("T")[0],
      };

      console.log(`✓ School: ${school.name} (${school.location})`);
      return school;
    } catch (err) {
      console.error(`Failed to scrape ${url}:`, err);
      throw err;
    }
  },
});
