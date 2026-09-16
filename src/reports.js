import { localDate, totals, summarize } from "./domain.js";
export function reportRange(period, anchor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) throw Error("Choose a valid date.");
  const start = new Date(anchor + "T00:00:00");
  if (!Number.isFinite(start.getTime()) || localDate(start) !== anchor)
    throw Error("Choose a valid date.");
  const end = new Date(start);
  if (period === "week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7);
  } else if (period === "month") {
    start.setDate(1);
    end.setDate(1);
    end.setMonth(end.getMonth() + 1);
  } else if (period === "year") {
    start.setMonth(0, 1);
    end.setMonth(0, 1);
    end.setFullYear(end.getFullYear() + 1);
  } else if (period === "day") end.setDate(end.getDate() + 1);
  else throw Error("Unknown reporting period.");
  return { start: localDate(start), end: localDate(end) };
}
export function adjacentPeriod(period, anchor, direction) {
  const range = reportRange(period, anchor),
    date = new Date((direction > 0 ? range.end : range.start) + "T12:00:00");
  if (direction < 0) date.setDate(date.getDate() - 1);
  return localDate(date);
}
export function createReport(
  state,
  period,
  anchor,
  now,
  responsibilityId = "",
) {
  const range = reportRange(period, anchor),
    days = [];
  const responsibilities = state.responsibilities.filter(
    (r) => !responsibilityId || r.id === responsibilityId,
  );
  const allowed = new Set(responsibilities.map((r) => r.id));
  const total = Object.fromEntries(responsibilities.map((r) => [r.id, 0]));
  const day = new Date(range.start + "T00:00:00");
  while (localDate(day) < range.end) {
    const date = localDate(day),
      time = totals(state, date, now);
    const byResponsibility = Object.fromEntries(
      Object.entries(time.byResponsibility).filter(([id]) => allowed.has(id)),
    );
    for (const [id, ms] of Object.entries(byResponsibility)) total[id] += ms;
    days.push({
      date,
      ...summarize(state, byResponsibility),
      notes: state.notes.filter(
        (n) => allowed.has(n.responsibilityId) && localDate(n.at) === date,
      ).length,
    });
    day.setDate(day.getDate() + 1);
  }
  return {
    ...range,
    days,
    responsibilities,
    total: summarize(state, total),
    trackedDays: days.filter((d) => d.tracked > 0).length,
    asOf: now,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
export function csvCell(value) {
  if (typeof value === "number") return String(value);
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export const csv = (rows) =>
  rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
export function reportCsv(report) {
  const rows = [
    [
      "Type",
      "Date",
      "Responsibility ID",
      "Responsibility",
      "Classification",
      "Decimal hours",
      "Calendar timezone",
    ],
  ];
  for (const day of report.days) {
    for (const r of report.responsibilities)
      rows.push([
        "Responsibility",
        day.date,
        r.id,
        r.name,
        r.classification,
        (day.byResponsibility[r.id] / 3600000).toFixed(4),
        report.timezone,
      ]);
    for (const kind of ["work", "nonwork", "unresolved", "tracked"])
      rows.push([
        "Daily total",
        day.date,
        "",
        "",
        kind,
        (day[kind] / 3600000).toFixed(4),
        report.timezone,
      ]);
  }
  for (const kind of ["work", "nonwork", "unresolved", "tracked"])
    rows.push([
      "Period total",
      "",
      "",
      "",
      kind,
      (report.total[kind] / 3600000).toFixed(4),
      report.timezone,
    ]);
  return csv(rows);
}
export function legacyReportCsv(report) {
  return [
    [
      "Date",
      "VD hours",
      "SIT hours",
      "Additional hours",
      "Total hours",
      "Notes",
    ].join(","),
    ...report.days.map((d) =>
      [
        d.date,
        ((d.byResponsibility.vd || 0) / 3600000).toFixed(4),
        ((d.byResponsibility.sit || 0) / 3600000).toFixed(4),
        (
          (d.tracked -
            (d.byResponsibility.vd || 0) -
            (d.byResponsibility.sit || 0)) /
          3600000
        ).toFixed(4),
        (d.tracked / 3600000).toFixed(4),
        d.notes,
      ].join(","),
    ),
  ].join("\r\n");
}
