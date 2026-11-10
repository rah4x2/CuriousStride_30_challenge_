import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const dist = join(root, "dist");
const localConfig = join(root, "config.local.js");

function fail(message) {
  console.error(`Production build stopped: ${message}`);
  process.exit(1);
}

function configString(source, property) {
  const match = source.match(new RegExp(`${property}\\s*:\\s*["'\\x60]([^"'\\x60]+)["'\\x60]`));
  return match?.[1]?.trim() || "";
}

function jwtRole(value) {
  const parts = value.split(".");
  if (parts.length !== 3) return "";
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return String(payload.role || "");
  } catch {
    return "";
  }
}

if (!existsSync(localConfig)) {
  fail("config.local.js is required. Copy config.example.js to config.local.js and add your public Supabase values.");
}

const configText = readFileSync(localConfig, "utf8");
if (!/mode\s*:\s*["']supabase["']/.test(configText)) {
  fail('config.local.js must set mode: "supabase".');
}
if (/YOUR_PROJECT|YOUR_SUPABASE|YOUR_BROWSER_SAFE|your-domain\.com|example\.com/i.test(configText)) {
  fail("replace the placeholder Supabase URL, key and public site details.");
}
if (/service[_-]?role|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|sb_secret_/i.test(configText)) {
  fail("a privileged Supabase secret/service-role credential appears to be present. Browser config may contain only a publishable/anon key.");
}

const siteUrl = configString(configText, "siteUrl");
const supabaseUrl = configString(configText, "supabaseUrl");
const browserKey = configString(configText, "supabaseAnonKey");
const supportEmail = configString(configText, "supportEmail");

let parsedSiteUrl;
let parsedSupabaseUrl;
try {
  parsedSiteUrl = new URL(siteUrl);
  parsedSupabaseUrl = new URL(supabaseUrl);
} catch {
  fail("siteUrl and supabaseUrl must be valid absolute URLs.");
}
if (parsedSiteUrl.protocol !== "https:" || /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(parsedSiteUrl.hostname)) {
  fail("siteUrl must be the final HTTPS production URL, not localhost.");
}
if (parsedSupabaseUrl.protocol !== "https:") {
  fail("supabaseUrl must use HTTPS.");
}
if (!browserKey || browserKey.length < 20) {
  fail("supabaseAnonKey must contain a browser-safe Supabase publishable or anon key.");
}
if (browserKey.startsWith("sb_secret_") || jwtRole(browserKey) === "service_role") {
  fail("supabaseAnonKey contains a privileged secret/service-role key. Replace it with the browser-safe publishable/anon key.");
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
  fail("supportEmail must be a real public support address.");
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const item of ["index.html", "manifest.webmanifest", "sw.js", "assets"]) {
  cpSync(join(root, item), join(dist, item), { recursive: true });
}

// Supabase publishable/anon keys are designed for browser use. RLS and
// server-verified RPCs enforce access. Privileged keys are rejected above.
cpSync(localConfig, join(dist, "config.js"));

writeFileSync(join(dist, "_redirects"), "/* /index.html 200\n");
writeFileSync(
  join(dist, "BUILD_INFO.txt"),
  `CuriousStride production build\nmode=supabase\nsite=${siteUrl}\ngenerated=${new Date().toISOString()}\n`
);

console.log(`Built production site in ${relative(root, dist)}/`);
console.log("Only deployable static assets were copied; source-only tests, SQL and setup documents were excluded.");
