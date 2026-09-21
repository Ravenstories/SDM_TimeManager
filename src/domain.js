export const CORE_ROLES = ["vd", "sit"];
export const isExtraRole = (role) =>
  typeof role === "string" && /^extra(?:-[a-z0-9-]{1,64})?$/i.test(role);
export const isRole = (role) => CORE_ROLES.includes(role) || isExtraRole(role);
export const emptyState = () => ({
  version: 1,
  active: null,
  extraClocks: [],
  sessions: [],
  notes: [],
});
export function getExtraClocks(state) {
  if (Array.isArray(state.extraClocks)) return state.extraClocks;
  return state.extraClock ? [{ id: "extra", ...state.extraClock }] : [];
}
export function validateState(state) {
  const time = (x) => Number.isFinite(x) && x >= 0 && x <= 8640000000000000;
  const role = (x) => isRole(x);
  const clock = (x) =>
    x &&
    isExtraRole(x.id) &&
    typeof x.name === "string" &&
    Boolean(x.name.trim()) &&
    x.name.length <= 40 &&
    typeof x.countsAsWork === "boolean";
  if (
    !state ||
    state.version !== 1 ||
    !Array.isArray(state.sessions) ||
    !Array.isArray(state.notes) ||
    (state.extraClocks !== undefined &&
      (!Array.isArray(state.extraClocks) ||
        !state.extraClocks.every(clock) ||
        new Set(state.extraClocks.map((item) => item.id)).size !==
          state.extraClocks.length)) ||
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
  if (
    role !== null &&
    !CORE_ROLES.includes(role) &&
    !getExtraClocks(state).some((clock) => clock.id === role)
  )
    throw new Error("Unknown role");
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
    !isRole(session.role) ||
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
export function adjustActiveStart(state, start, now) {
  if (!state.active) throw new Error("No timer is currently running.");
  if (!Number.isFinite(start) || start < 0 || start > now)
    throw new Error("Choose a valid start time that is not in the future.");
  if (
    state.sessions.some(
      (session) => start < session.end && now > session.start,
    )
  )
    throw new Error("The adjusted start overlaps another tracked session.");
  return { ...state, active: { ...state.active, start } };
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
  const sessions = state.active
    ? [...state.sessions, { ...state.active, end: now }]
    : state.sessions;
  const roles = new Set([
    ...CORE_ROLES,
    "extra",
    ...getExtraClocks(state).map((clock) => clock.id),
    ...sessions.map((session) => session.role),
  ]);
  const result = Object.fromEntries([...roles].map((role) => [role, 0]));
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
