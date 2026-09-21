import { emptyState, validateState } from "./domain.js";

// Compatibility with the responsibility-based v2 development release.
// Keep original fields as metadata; never merge differently named clocks.
export function migrateStoredState(input) {
  if (input?.version !== 2) return validateState(input);
  const invalid = () => {
    throw new Error(
      "The version 2 records could not be read safely. Existing data has been preserved.",
    );
  };
  const validId = (id) =>
    typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
  const time = (n) =>
    Number.isSafeInteger(n) && n >= 0 && n <= 8640000000000000;
  if (
    !Array.isArray(input.responsibilities) ||
    !Array.isArray(input.sessions) ||
    !Array.isArray(input.notes)
  )
    invalid();
  const roles = new Map();
  const next = { ...structuredClone(input), ...emptyState() };
  for (const r of input.responsibilities) {
    if (
      !r ||
      !validId(r.id) ||
      roles.has(r.id) ||
      typeof r.name !== "string" ||
      !r.name.trim() ||
      r.name.length > 40 ||
      !["work", "nonwork", "unresolved"].includes(r.classification) ||
      typeof r.archived !== "boolean"
    )
      invalid();
    const standard =
      ["vd", "sit"].includes(r.id) &&
      r.name === r.id.toUpperCase() &&
      r.classification === "work" &&
      !r.archived;
    const role = standard
      ? r.id
      : "extra-v2-" +
        Array.from(r.id, (c) =>
          c.charCodeAt(0).toString(16).padStart(2, "0"),
        ).join("");
    roles.set(r.id, role);
    if (!standard)
      next.extraClocks.push({
        ...r,
        id: role,
        sourceId: r.id,
        countsAsWork: r.classification === "work",
      });
  }
  const convert = (item) => {
    if (!item || !roles.has(item.responsibilityId)) invalid();
    return { ...structuredClone(item), role: roles.get(item.responsibilityId) };
  };
  next.sessions = input.sessions.map((item) => {
    if (
      !item ||
      !validId(item.id) ||
      !time(item.start) ||
      !time(item.end) ||
      item.end < item.start
    )
      invalid();
    return convert(item);
  });
  next.notes = input.notes.map((item) => {
    if (!item || !validId(item.id) || !time(item.at)) invalid();
    return convert(item);
  });
  if (
    new Set(next.sessions.map((x) => x.id)).size !== next.sessions.length ||
    new Set(next.notes.map((x) => x.id)).size !== next.notes.length
  )
    invalid();
  if (input.active !== null) {
    if (!input.active || !validId(input.active.id) || !time(input.active.start))
      invalid();
    next.active = convert(input.active);
  }
  return validateState(next);
}
