import { dayBounds, refreshTotalSwitch } from "./domain.js";

function timelineIntervals(state, now) {
  const intervals = state.sessions
    .filter(({ start, end }) => end > start)
    .map(({ id, role, start, end }) => ({ id, role, start, end, running: false }));
  if (state.active && state.active.start <= now) {
    const { role, start } = state.active;
    intervals.push({ id: null, role, start, end: now, running: true });
  }
  return intervals.sort((a, b) => a.start - b.start);
}

function switchPoints(state, intervals) {
  const idCounts = new Map();
  for (const { id } of state.sessions) {
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }

  // A switch joins two adjacent intervals. Skip ambiguous imported data where
  // any other nonempty interval overlaps that pair or an ID is not unique.
  const switches = [];
  let previousEnd = -Infinity;
  for (let index = 0; index < intervals.length - 1; index++) {
    const from = intervals[index];
    const to = intervals[index + 1];
    const following = intervals[index + 2];
    if (
      !from.running &&
      from.end === to.start &&
      from.role !== to.role &&
      previousEnd <= from.start &&
      (!following || following.start >= to.end) &&
      idCounts.get(from.id) === 1 &&
      (to.running || idCounts.get(to.id) === 1)
    ) {
      switches.push({
        fromId: from.id,
        toId: to.id,
        from: from.role,
        to: to.role,
        start: from.start,
        at: from.end,
        end: to.running ? null : to.end,
      });
    }
    previousEnd = Math.max(previousEnd, from.end);
  }
  return switches;
}

export function dayTimeline(state, date, now) {
  const [start, end] = dayBounds(date);
  const intervals = timelineIntervals(state, now);
  const segments = intervals
    .map((interval) => ({
      role: interval.role,
      start: Math.max(interval.start, start),
      end: Math.min(interval.end, end),
      running: interval.running,
    }))
    .filter((segment) => segment.start < segment.end);
  const switches = switchPoints(state, intervals).filter(
    (point) => point.at >= start && point.at < end,
  );
  return { start, end, segments, switches };
}

export function moveSwitch(state, expected, at, now) {
  if (!Number.isFinite(now)) throw new Error("The current time is unavailable.");
  const current = switchPoints(state, timelineIntervals(state, now)).find(
    (point) => point.fromId === expected?.fromId && point.toId === expected?.toId,
  );
  if (!current || Object.keys(current).some((key) => current[key] !== expected[key])) {
    throw new Error("This switch changed while you were editing it. Select it again.");
  }
  const end = current.end ?? now;
  if (!Number.isFinite(at) || at < current.start || at > end) {
    throw new Error("Choose a switch time between the start and end of the two sessions.");
  }
  if (at === current.at) return state;

  const plan = state.scheduledSwitch;
  if (current.end === null && plan && plan.mode !== "total" && at > plan.at) {
    throw new Error("Choose a time before the scheduled switch.");
  }

  return refreshTotalSwitch({
    ...state,
    sessions: state.sessions.map((session) => {
      if (session.id === current.fromId) return { ...session, end: at };
      if (session.id === current.toId) return { ...session, start: at };
      return session;
    }),
    active: current.end === null ? { ...state.active, start: at } : state.active,
  });
}
