import {
  cpSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";

import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const dist = join(root, "dist");

function fail(message) {
  console.error(`Production build stopped: ${message}`);
  process.exit(1);
}

const siteUrl = process.env.CURIOUSSTRIDE_SITE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const browserKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const supportEmail = process.env.SUPPORT_EMAIL;

if (!siteUrl) {
  fail("CURIOUSSTRIDE_SITE_URL is missing.");
}

if (!supabaseUrl) {
  fail("SUPABASE_URL is missing.");
}

if (!browserKey) {
  fail("SUPABASE_PUBLISHABLE_KEY is missing.");
}

if (!supportEmail) {
  fail("SUPPORT_EMAIL is missing.");
}

let parsedSiteUrl;
let parsedSupabaseUrl;

try {
  parsedSiteUrl = new URL(siteUrl);
  parsedSupabaseUrl = new URL(supabaseUrl);
} catch {
  fail("CURIOUSSTRIDE_SITE_URL and SUPABASE_URL must be valid URLs.");
}

if (parsedSiteUrl.protocol !== "https:") {
  fail("CURIOUSSTRIDE_SITE_URL must use HTTPS.");
}

if (parsedSupabaseUrl.protocol !== "https:") {
  fail("SUPABASE_URL must use HTTPS.");
}

if (
  browserKey.startsWith("sb_secret_") ||
  /service[_-]?role/i.test(browserKey)
) {
  fail(
    "SUPABASE_PUBLISHABLE_KEY must be a browser-safe publishable/anon key."
  );
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
  fail("SUPPORT_EMAIL must contain a valid email address.");
}

const config = `window.CURIOUSSTRIDE_CONFIG = Object.freeze({
  mode: "supabase",

  siteUrl: ${JSON.stringify(siteUrl)},

  challengeSlug: "curiousstride-30-day",

  supabaseUrl: ${JSON.stringify(supabaseUrl)},

  supabaseAnonKey: ${JSON.stringify(browserKey)},

  enableCloudSync: false,

  enableReminders: false,

  defaultTimezone: "Asia/Dubai",

  supportEmail: ${JSON.stringify(supportEmail)},

  analytics: true,

  onboardingVersion: 1
});
`;

rmSync(dist, {
  recursive: true,
  force: true,
});

mkdirSync(dist, {
  recursive: true,
});

for (const item of [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "assets",
]) {
  cpSync(join(root, item), join(dist, item), {
    recursive: true,
  });
}

writeFileSync(join(dist, "config.js"), config);

writeFileSync(
  join(dist, "_redirects"),
  "/* /index.html 200\n"
);

writeFileSync(
  join(dist, "BUILD_INFO.txt"),
  `CuriousStride production build
mode=supabase
site=${siteUrl}
generated=${new Date().toISOString()}
`
);

console.log(`Built production site in ${relative(root, dist)}/`);
console.log(`Production site: ${siteUrl}`);
console.log(
  "Production configuration generated from deployment environment variables."
);