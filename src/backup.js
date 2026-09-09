import { validateState, switchRole } from "./domain.js";

export function restoreBackup(backup, now, id) {
  const state = validateState(backup.state);
  if (
    !Number.isFinite(backup.exportedAt) ||
    backup.exportedAt < 0 ||
    backup.exportedAt > now + 60000 ||
    (state.active && backup.exportedAt < state.active.start)
  )
    throw new Error("Invalid backup export time.");
  return state.active
    ? switchRole(state, null, backup.exportedAt, id)
    : structuredClone(state);
}

export function sessionCsv(state, now) {
  const sessions = state.active
    ? [...state.sessions, { ...state.active, end: now }]
    : state.sessions;
  return [
    "Role,Start (UTC),End (UTC),Minutes",
    ...sessions.map((s) =>
      [
        s.role.toUpperCase(),
        new Date(s.start).toISOString(),
        new Date(s.end).toISOString(),
        (Math.max(0, s.end - s.start) / 60000).toFixed(2),
      ].join(","),
    ),
  ].join("\r\n");
}
