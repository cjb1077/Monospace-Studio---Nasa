import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getSupabaseAdmin } from "../src/lib/supabase/server";

async function run() {
  console.log("Checking Supabase connection and tables...");
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("cached_apods")
      .select("*")
      .limit(1);

    if (error) {
      if (error.code === "P0001" || error.message.includes("relation \"public.cached_apods\" does not exist")) {
        console.log("\n❌ cached_apods table does not exist. Please apply supabase/schema.sql.");
      } else {
        console.error("\n❌ Database error:", error);
      }
    } else {
      console.log("\n✅ Database connection successful and public.cached_apods table exists!");
    }
  } catch (err: any) {
    console.error("\n❌ Setup error:", err.message || err);
  }
}

run();
