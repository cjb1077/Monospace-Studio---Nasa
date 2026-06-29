import { loadEnvConfig } from "@next/env";
import { fetchApod } from "../src/lib/nasa/apod";

// Load environment variables from .env.local
loadEnvConfig(process.cwd());

async function run() {
  const date = process.argv[2];
  console.log(`Fetching APOD for date: ${date || "today"}...`);
  
  try {
    const data = await fetchApod(date);
    console.log("\nSuccess!");
    console.log("----------------------------------------");
    console.log(`Title:       ${data.title}`);
    console.log(`Date:        ${data.date}`);
    console.log(`Media Type:  ${data.media_type}`);
    console.log(`URL:         ${data.url}`);
    if (data.copyright) {
      console.log(`Copyright:   ${data.copyright}`);
    }
    console.log("----------------------------------------");
    console.log(`Explanation:\n${data.explanation}`);
    console.log("----------------------------------------");
  } catch (error: any) {
    console.error("\nError occurred:");
    if (error.code) {
      console.error(`Code:   ${error.code}`);
      console.error(`Status: ${error.status}`);
    }
    console.error(`Message: ${error.message}`);
  }
}

run();
