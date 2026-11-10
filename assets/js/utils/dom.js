export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

export function debounce(fn, wait = 500) {
  let timeout;
  const debounced = (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timeout);
  debounced.flush = (...args) => {
    clearTimeout(timeout);
    return fn(...args);
  };
  return debounced;
}

export function formatDate(value, options = {}) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options
  }).format(date);
}

export function formatShortDate(value) {
  return formatDate(value, { day: "numeric", month: "short", year: "numeric" });
}

export function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "CS";
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

export function wordCount(text = "") {
  const clean = text.trim();
  return clean ? clean.split(/\s+/).length : 0;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function slugify(value = "") {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function safeJsonParse(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function announce(message) {
  let region = document.getElementById("a11y-announcer");
  if (!region) {
    region = document.createElement("div");
    region.id = "a11y-announcer";
    region.className = "sr-only";
    region.setAttribute("aria-live", "polite");
    document.body.append(region);
  }
  region.textContent = "";
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

export function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function setDocumentTitle(title) {
  document.title = title ? `${title} · CuriousStride` : "CuriousStride — 30-Day Reflection Challenge";
}
