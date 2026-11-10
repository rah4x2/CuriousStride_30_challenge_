export function parseHash(hash = window.location.hash) {
  const raw = (hash || "#/home").replace(/^#/, "");
  const [pathPart, queryPart = ""] = raw.split("?");
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
  return {
    path,
    segments,
    page: segments[0] || "home",
    params: segments.slice(1),
    query: Object.fromEntries(new URLSearchParams(queryPart))
  };
}

export function navigate(path, { replace = false } = {}) {
  const next = path.startsWith("#") ? path : `#${path.startsWith("/") ? path : `/${path}`}`;
  if (replace) {
    history.replaceState(null, "", next);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = next.slice(1);
  }
}

export function currentPath() {
  return parseHash().path;
}
