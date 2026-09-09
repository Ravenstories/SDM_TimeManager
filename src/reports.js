import { localDate, totals } from "./domain.js";

/** Calendar boundaries use the device timezone, including DST transitions. */
export function reportRange(period, anchor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor))
    throw new Error("Choose a valid date.");
  const start = new Date(`${anchor}T00:00:00`);
  if (!Number.isFinite(start.getTime()) || localDate(start) !== anchor)
    throw new Error("Choose a valid date.");
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
  else throw new Error("Unknown reporting period.");
  return { start: localDate(start), end: localDate(end) };
}

export function createReport(state, period, anchor, now) {
  const range = reportRange(period, anchor);
  const days = [],
    total = { vd: 0, sit: 0 };
  const day = new Date(`${range.start}T00:00:00`);
  while (localDate(day) < range.end) {
    const date = localDate(day),
      time = totals(state, date, now);
    const notes = state.notes.filter(
      (note) => localDate(note.at) === date,
    ).length;
    days.push({ date, ...time, notes });
    total.vd += time.vd;
    total.sit += time.sit;
    day.setDate(day.getDate() + 1);
  }
  return {
    ...range,
    days,
    total,
    trackedDays: days.filter((day) => day.vd + day.sit > 0).length,
  };
}

export function reportCsv(report) {
  return [
    "Date,VD hours,SIT hours,Total hours,Notes",
    ...report.days.map((day) =>
      [
        day.date,
        (day.vd / 3600000).toFixed(4),
        (day.sit / 3600000).toFixed(4),
        ((day.vd + day.sit) / 3600000).toFixed(4),
        day.notes,
      ].join(","),
    ),
  ].join("\r\n");
}
