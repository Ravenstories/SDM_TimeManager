import { createReport, reportCsv } from "./reports.js";
import { duration, decimalHours, localDate } from "./domain.js";

export function setupReports({ getState, download, showDay }) {
  const $ = (id) => document.getElementById(id);
  let report;
  $("report-anchor").value = localDate();
  function render() {
    if (!getState()) return;
    const anchor = $("report-anchor").value;
    if (!anchor) return;
    report = createReport(
      getState(),
      $("report-period").value,
      anchor,
      Date.now(),
    );
    const total = report.total.vd + report.total.sit + report.total.extra;
    const format = $("time-format").value === "decimal" ? decimalHours : duration;
    $("report-vd").textContent = format(report.total.vd);
    $("report-sit").textContent = format(report.total.sit);
    $("report-extra").textContent = format(report.total.extra);
    $("report-extra-label").textContent =
      getState().extraClock?.name || "Additional";
    $("report-total").textContent = format(total);
    $("report-description").textContent =
      `${report.start} to ${report.days.at(-1).date} · ${report.trackedDays} tracked days · ${total ? Math.round((report.total.vd / total) * 100) : 0}% VD / ${total ? Math.round((report.total.sit / total) * 100) : 0}% SIT${report.total.extra ? ` / ${Math.round((report.total.extra / total) * 100)}% ${getState().extraClock?.name || "Additional"}` : ""}`;
    $("report-rows").replaceChildren();
    for (const day of report.days.filter(
      (day) => day.vd + day.sit + day.extra > 0 || day.notes,
    )) {
      const row = document.createElement("tr"),
        dateCell = document.createElement("td"),
        button = document.createElement("button");
      button.textContent = day.date;
      button.className = "quiet";
      button.setAttribute("aria-label", `View notes for ${day.date}`);
      button.onclick = () => {
        $("reports").close();
        showDay(day.date);
      };
      dateCell.append(button);
      row.append(dateCell);
      for (const value of [
        format(day.vd),
        format(day.sit),
        format(day.extra),
        format(day.vd + day.sit + day.extra),
        day.notes,
      ]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      $("report-rows").append(row);
    }
    $("report-empty").hidden = $("report-rows").children.length !== 0;
  }
  $("open-reports").onclick = () => {
    render();
    $("reports").showModal();
  };
  $("close-reports").onclick = () => $("reports").close();
  $("report-period").onchange = render;
  $("report-anchor").onchange = render;
  $("refresh-report").onclick = render;
  $("report-csv").onclick = () => {
    render();
    if (report)
      download(
        reportCsv(report),
        `sdm-${report.start}-to-${report.days.at(-1).date}.csv`,
        "text/csv",
      );
  };
  return {
    refresh: () => {
      if ($("reports").open) render();
    },
  };
}
