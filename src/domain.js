export const ROLES = ["vd", "sit", "extra"];
export const emptyState = () => ({
  version: 1,
  active: null,
  extraClock: null,
  sessions: [],
  notes: [],
});
export function validateState(state) {
  const time = (x) => Number.isFinite(x) && x >= 0 && x <= 8640000000000000;
  const role = (x) => ROLES.includes(x);
  if (
    !state ||
    state.version !== 1 ||
    !Array.isArray(state.sessions) ||
    !Array.isArray(state.notes) ||
    (state.extraClock !== undefined &&
      state.extraClock !== null &&
      (!state.extraClock ||
        typeof state.extraClock.name !== "string" ||
        !state.extraClock.name.trim() ||
        state.extraClock.name.length > 40 ||
        typeof state.extraClock.countsAsWork !== "boolean")) ||
    (state.active !== null &&
      (!state.active ||
        !role(state.active.role) ||
        !time(state.active.start))) ||
    !state.sessions.every(
      (s) =>
        s &&
        typeof s.id === "string" &&
        role(s.role) &&
        time(s.start) &&
        time(s.end) &&
        s.end >= s.start,
    ) ||
    !state.notes.every(
      (n) =>
        n &&
        typeof n.id === "string" &&
        role(n.role) &&
        time(n.at) &&
        typeof n.text === "string" &&
        n.text.length <= 5000,
    )
  )
    throw new Error("This is not a valid SDM backup.");
  return state;
}
export function switchRole(state, role, now, id) {
  if (role !== null && !ROLES.includes(role)) throw new Error("Unknown role");
  if (state.active?.role === role) return state;
  const next = structuredClone(state);
  if (next.active)
    next.sessions.push({
      ...next.active,
      end: Math.max(now, next.active.start),
      id,
    });
  next.active = role ? { role, start: now } : null;
  return next;
}
export function saveSession(state, session) {
  if (
    !session ||
    typeof session.id !== "string" ||
    !ROLES.includes(session.role) ||
    !Number.isFinite(session.start) ||
    !Number.isFinite(session.end) ||
    session.start < 0 ||
    session.end <= session.start
  )
    throw new Error("Enter a valid start and end time.");

  const otherSessions = state.sessions.filter((item) => item.id !== session.id);
  const occupied = state.active
    ? [
        ...otherSessions,
        { ...state.active, end: Number.POSITIVE_INFINITY },
      ]
    : otherSessions;
  if (
    occupied.some(
      (item) => session.start < item.end && session.end > item.start,
    )
  )
    throw new Error("This entry overlaps another tracked session.");

  return {
    ...state,
    sessions: [...otherSessions, { ...session }].sort(
      (a, b) => a.start - b.start,
    ),
  };
}
export function removeSession(state, id) {
  return {
    ...state,
    sessions: state.sessions.filter((session) => session.id !== id),
  };
}
export function dayBounds(date) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start.getTime(), end.getTime()];
}
export function localDate(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function totals(state, date, now) {
  const [start, end] = dayBounds(date);
  const result = { vd: 0, sit: 0, extra: 0 };
  const sessions = state.active
    ? [...state.sessions, { ...state.active, end: now }]
    : state.sessions;
  for (const s of sessions)
    result[s.role] += Math.max(
      0,
      Math.min(s.end, end) - Math.max(s.start, start),
    );
  return result;
}
export function duration(ms) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
export function decimalHours(ms) {
  return `${(Math.max(0, ms) / 3600000).toFixed(2)} h`;
}
