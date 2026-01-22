import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL in environment");
}

if (!supabaseKey) {
  throw new Error(
    "Missing Supabase key in environment (set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY or SUPABASE_KEY)",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
