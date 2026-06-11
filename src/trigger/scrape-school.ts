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
      // Define the JSON schema for LLM extraction
      const schoolSchema = {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the martial arts school or academy",
          },
          location: {
            type: "string",
            description:
              "The city and state (e.g., 'San Francisco, CA') where the school is located",
          },
          address: {
            type: "string",
            description: "The street address of the school",
          },
          phone: {
            type: "string",
            description: "The phone number of the school",
          },
          instructors: {
            type: "string",
            description:
              "Names of the instructors, separated by commas if multiple",
          },
          styles: {
            type: "string",
            description:
              "The martial arts styles taught (e.g., Kung Fu, Tai Chi, Wushu)",
          },
          schools: {
            type: "array",
            description:
              "If this is a directory page, list the schools found on the page",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                url: { type: "string" },
              },
            },
          },
        },
        required: ["name", "location"],
      };

      // Scrape with LLM extraction
      const scrapeResult = await firecrawl.scrape(url, {
        formats: ["extract"],
        extract: {
          schema: schoolSchema as any,
        },
      });

      if (!scrapeResult.extract) {
        throw new Error("Failed to extract data from page");
      }

      const extracted = scrapeResult.extract as unknown as ExtractedData;

      // Check if this is a directory (contains 3+ schools)
      if (isDirectory(extracted)) {
        console.log(`📋 Detected directory with ${extracted.schools?.length} schools: ${url}`);
        const discoveredUrls = await discoverSchoolUrls(url);
        console.log(`Found ${discoveredUrls.length} schools in directory`);
        return {
          type: "directory",
          discoveredUrls,
        } as ScraperResponse;
      }

      // This is an actual school - return extracted data
      const school: School = {
        name: extracted.name || "Unknown School",
        location: extracted.location || "Unknown Location",
        address: extracted.address || "",
        phone: extracted.phone || "",
        website: url,
        instructors: extracted.instructors || "",
        styles: extracted.styles || "Kung Fu, Wushu, Tai Chi",
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
