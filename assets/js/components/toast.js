import { escapeHtml } from "../utils/dom.js";
import { icon } from "../utils/icons.js";

function ensureRegion() {
  let region = document.querySelector(".toast-region");
  if (!region) {
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-label", "Notifications");
    document.body.append(region);
  }
  return region;
}

export function showToast(message, type = "info", duration = 4500) {
  const region = ensureRegion();
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  const iconName = type === "success" ? "checkCircle" : type === "error" ? "alert" : "info";
  toast.innerHTML = `${icon(iconName)}<p>${escapeHtml(message)}</p><button type="button" aria-label="Dismiss notification">${icon("x")}</button>`;
  const close = () => {
    toast.remove();
    if (!region.children.length) region.remove();
  };
  toast.querySelector("button")?.addEventListener("click", close);
  region.append(toast);
  if (duration > 0) setTimeout(close, duration);
  return close;
}
