import { validateState as validateLegacy } from "./legacy-domain.js";
import { assertUnchanged } from "./editing.js";
export { duration, decimalHours, localDate, dayBounds } from "./legacy-domain.js";
import { localDate, dayBounds } from "./legacy-domain.js";

export const CLASSIFICATIONS = ["work", "nonwork", "unresolved"];
export const emptyState = () => ({
  version: 2, responsibilities: [
    { id: "vd", name: "VD", classification: "work", archived: false },
    { id: "sit", name: "SIT", classification: "work", archived: false },
  ], active: null, sessions: [], notes: [],
  preferences: { timeFormat: "clock", compact: false },
});
const validTime = n => Number.isSafeInteger(n) && n >= 0 && n <= 8640000000000000;
const validId = id => typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id)
  && !["__proto__", "constructor", "prototype"].includes(id);
function unique(items, field = "id") { return new Set(items.map(x => x[field])).size === items.length; }
export function validateState(s) {
  const invalid = () => { throw Error("This is not a valid SDM backup or record."); };
  if (!s || s.version !== 2 || !Array.isArray(s.responsibilities) || !Array.isArray(s.sessions) || !Array.isArray(s.notes)) invalid();
  if (!s.responsibilities.every(r => r && validId(r.id) && typeof r.name === "string" &&
      r.name === r.name.trim() && r.name.length > 0 && r.name.length <= 40 &&
      CLASSIFICATIONS.includes(r.classification) && typeof r.archived === "boolean") ||
      !unique(s.responsibilities) ||
      new Set(s.responsibilities.map(r => r.name.toLowerCase())).size !== s.responsibilities.length) invalid();
  const known = id => s.responsibilities.some(r => r.id === id);
  if (!s.sessions.every(e => e && validId(e.id) && known(e.responsibilityId) &&
    validTime(e.start) && validTime(e.end) && e.end >= e.start) || !unique(s.sessions)) invalid();
  if (!s.notes.every(n => n && validId(n.id) && known(n.responsibilityId) && validTime(n.at) &&
    typeof n.text === "string" && n.text.length <= 5000) || !unique(s.notes)) invalid();
  if (s.active !== null && (!s.active || !validId(s.active.id) || !known(s.active.responsibilityId) ||
    !validTime(s.active.start) || s.sessions.some(e => e.id === s.active.id))) invalid();
  if (!s.preferences || !["clock", "decimal"].includes(s.preferences.timeFormat) || typeof s.preferences.compact !== "boolean") invalid();
  return s;
}
export function migrateState(input) {
  if (input?.version === 2) return structuredClone(validateState(input));
  const old = validateLegacy(input), next = emptyState();
  const extraUsed = old.sessions.some(e => e.role === "extra") || old.notes.some(n => n.role === "extra") || old.active?.role === "extra";
  if (old.extraClock || extraUsed) {
    let name = old.extraClock?.name.trim() || "Legacy additional";
    if (next.responsibilities.some(r => r.name.toLowerCase() === name.toLowerCase())) name = name.slice(0,28) + " (additional)";
    next.responsibilities.push({ id: "extra", name, classification: old.extraClock ?
      (old.extraClock.countsAsWork ? "work" : "nonwork") : "unresolved", archived: !old.extraClock });
  }
  const convert = item => { const {role, ...rest} = item; return {...rest, responsibilityId: role}; };
  next.sessions = old.sessions.map(convert);
  next.notes = old.notes.map(convert);
  if (old.active) {
    let id = "migrated-active";
    while (next.sessions.some(e => e.id === id)) id += "-x";
    next.active = {...convert(old.active), id};
  }
  return validateState(next);
}
export function responsibility(state, id) {
  const r = state.responsibilities.find(r => r.id === id);
  if (!r) throw Error("This responsibility no longer exists. Reload the record.");
  return r;
}
export function switchRole(state, id, now, sessionId) {
  if (!validTime(now)) throw Error("Invalid clock time.");
  if (id !== null) {
    const r = responsibility(state, id);
    if (r.archived || r.classification === "unresolved") throw Error("Restore and classify this responsibility before starting it.");
  }
  if (state.active?.responsibilityId === id) return state;
  const next = structuredClone(state);
  const start = Math.max(now, next.active?.start || 0);
  if (next.active) next.sessions.push({...next.active, end: start});
  next.active = id === null ? null : {id: sessionId, responsibilityId: id, start};
  return validateState(next);
}
export function saveSession(state, entry, now = Date.now(), original) {
  responsibility(state, entry.responsibilityId);
  if (!validId(entry.id) || !validTime(entry.start) || !validTime(entry.end) || entry.end <= entry.start)
    throw Error("Enter a valid start and end time.");
  if (entry.end > now) throw Error("Completed entries cannot end in the future.");
  if (original) assertUnchanged(state.sessions.find(e => e.id === original.id), original);
  else if (state.sessions.some(e => e.id === entry.id)) throw Error("This entry already exists.");
  const other = state.sessions.filter(e => e.id !== entry.id);
  const occupied = state.active ? [...other, {...state.active, end: Infinity}] : other;
  if (occupied.some(e => entry.start < e.end && entry.end > e.start)) throw Error("This entry overlaps another tracked session.");
  return validateState({...state, sessions: [...other, {...entry}].sort((a,b) => a.start-b.start)});
}
export function removeSession(state, original) {
  assertUnchanged(state.sessions.find(e => e.id === original.id), original);
  return {...state, sessions: state.sessions.filter(e => e.id !== original.id)};
}
export function stopActive(state, end, now, original) {
  assertUnchanged(state.active, original);
  if (!state.active || !validTime(end) || end < state.active.start || end > now) throw Error("Choose a stop time between the start and now.");
  const entry = {...state.active, end};
  const next = {...state, active: null};
  if (end === entry.start) return {...next, sessions: [...next.sessions, entry]};
  return saveSession(next, entry, now);
}
export function saveNote(state, note, original) {
  responsibility(state, note.responsibilityId);
  if (!note.text.trim()) throw Error("Write a note before saving.");
  if (original) assertUnchanged(state.notes.find(n => n.id === original.id), original);
  else if (state.notes.some(n => n.id === note.id)) throw Error("This note already exists.");
  return validateState({...state, notes: [...state.notes.filter(n => n.id !== note.id), {...note, text: note.text.trim()}]});
}
export function removeNote(state, original) {
  assertUnchanged(state.notes.find(n => n.id === original.id), original);
  return {...state, notes: state.notes.filter(n => n.id !== original.id)};
}
export function saveResponsibility(state, record, original) {
  const next = {...record, name: record.name.trim()};
  if (next.classification === "unresolved" && original?.classification !== "unresolved") throw Error("Choose work or non-work.");
  if (original) assertUnchanged(state.responsibilities.find(r => r.id === original.id), original);
  else if (state.responsibilities.some(r => r.id === next.id)) throw Error("This responsibility already exists.");
  if (state.responsibilities.some(r => r.id !== next.id && r.name.toLowerCase() === next.name.toLowerCase()))
    throw Error("Use a unique responsibility name.");
  const responsibilities = original ? state.responsibilities.map(r => r.id === next.id ? next : r)
    : [...state.responsibilities, next];
  return validateState({...state, responsibilities});
}
export function archiveResponsibility(state, original, archived, now) {
  assertUnchanged(responsibility(state, original.id), original);
  let next = state;
  if (archived && state.active?.responsibilityId === original.id)
    next = stopActive(state, Math.max(now, state.active.start), Math.max(now, state.active.start), state.active);
  return saveResponsibility(next, {...original, archived}, original);
}
export function moveResponsibility(state, id, delta) {
  const items = [...state.responsibilities], index = items.findIndex(r => r.id === id), target = index + delta;
  if (index < 0 || target < 0 || target >= items.length) return state;
  [items[index], items[target]] = [items[target], items[index]];
  return {...state, responsibilities: items};
}
export function totals(state, date, now) {
  const [start,end] = dayBounds(date);
  const byResponsibility = Object.fromEntries(state.responsibilities.map(r => [r.id,0]));
  for (const e of state.active ? [...state.sessions, {...state.active, end: now}] : state.sessions)
    byResponsibility[e.responsibilityId] += Math.max(0, Math.min(e.end,end) - Math.max(e.start,start));
  return summarize(state, byResponsibility);
}
export function summarize(state, byResponsibility) {
  const result = {byResponsibility, work:0, nonwork:0, unresolved:0, tracked:0};
  for (const r of state.responsibilities) {
    const ms = byResponsibility[r.id] || 0;
    result[r.classification] += ms;
    result.tracked += ms;
  }
  return result;
}
export function responsibilityImpact(state, edited, now) {
  const original = responsibility(state, edited.id);
  const entries = state.sessions.filter(e => e.responsibilityId === edited.id);
  const elapsed = entries.reduce((sum,e) => sum + e.end-e.start,0) +
    (state.active?.responsibilityId === edited.id ? Math.max(0,now-state.active.start) : 0);
  return {entries:entries.length, notes:state.notes.filter(n => n.responsibilityId === edited.id).length,
    workDelta: elapsed * (Number(edited.classification === "work") - Number(original.classification === "work"))};
}
export function needsReview(active, now) {
  return Boolean(active && (localDate(active.start) !== localDate(now) || now-active.start >= 12*3600000));
}

