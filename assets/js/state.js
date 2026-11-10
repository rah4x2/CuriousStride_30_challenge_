import { DEFAULT_CONTENT } from "./data/site-defaults.js";

export const state = {
  session: null,
  content: { ...DEFAULT_CONTENT },
  journey: null,
  loading: false,
  backendError: null,
  lastRoute: "/home"
};

const listeners = new Set();

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((listener) => listener(state));
  return state;
}

export function subscribeState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
