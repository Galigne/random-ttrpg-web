import { copy } from "./translations.js";

export const state = {
  user: null,
  csrf: null,
  locale: {},
  language: localStorage.getItem("random-language") === "fr" ? "fr" : "en",
  tab: crypto.randomUUID(),
  stream: null,
  streamCampaign: undefined,
  screen: "",
  campaign: null,
  sheet: null,
  editing: false,
  preview: false,
  saveQueue: Promise.resolve(),
  generation: { kind: "general" },
};
export const t = (key) => copy[state.language][key] || key;
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const attr = esc;
export const fieldLabel = (key) =>
  key.split(".").reduce((node, part) => node && node[part], state.locale) ||
  key.split(".").at(-1).replace(/_/g, " ");
export function notify(message, error = false) {
  const box = document.querySelector("#notice");
  box.textContent = message;
  box.className = `show${error ? " error" : ""}`;
  clearTimeout(box.timer);
  box.timer = setTimeout(() => {
    box.className = "";
  }, 5000);
}
export function errorMessage(error) {
  const key = error.message || "INTERNAL_ERROR";
  return t(key) === key
    ? fieldLabel(key) === key
      ? t("invalid")
      : fieldLabel(key)
    : t(key);
}
export async function api(path, method = "GET", data) {
  const options = { method, credentials: "same-origin", headers: {} };
  if (method !== "GET") {
    options.headers["Content-Type"] = "application/json";
    if (state.csrf) options.headers["X-CSRF-Token"] = state.csrf;
    options.body = JSON.stringify(data || {});
  }
  const response = await fetch(path, options);
  const payload = await response
    .json()
    .catch(() => ({ error: "INTERNAL_ERROR" }));
  if (!response.ok) throw new Error(payload.error || "INTERNAL_ERROR");
  return payload;
}
