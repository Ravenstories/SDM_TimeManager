import {
  createReport,
  reportCsv,
  legacyReportCsv,
  adjacentPeriod,
} from "./reports.js";
import { localDate } from "./domain.js";
import { $, el, button, roleOptions, dateTime, errorAt } from "./ui.js";
import { renderTotals, renderBreakdown } from "./summary-view.js";
export function setupReports(ctx) {
  let report;
  $("report-anchor").value = localDate();
  function render() {
    if (!ctx.getState()) return;
    try {
      roleOptions($("report-role"), ctx.getState(), { all: true });
      report = createReport(
        ctx.getState(),
        $("report-period").value,
        $("report-anchor").value,
        Date.now(),
        $("report-role").value,
      );
      $("report-description").textContent =
        report.start +
        " to " +
        report.days.at(-1).date +
        " · " +
        report.trackedDays +
        " tracked days";
      renderTotals($("report-totals"), report.total, ctx.format);
      renderBreakdown(
        $("report-breakdown"),
        ctx.getState(),
        report.total,
        ctx.format,
      );
      $("report-rows").replaceChildren();
      for (const day of report.days.filter((d) => d.tracked || d.notes)) {
        const row = el("tr"),
          cell = el("td");
        cell.append(
          button(
            day.date,
            () => {
              $("reports").close();
              ctx.showDay(day.date);
            },
            "Review " + day.date,
          ),
        );
        row.append(cell);
        for (const kind of ["work", "nonwork", "unresolved", "tracked"])
          row.append(el("td", ctx.format(day[kind])));
        row.append(el("td", String(day.notes)));
        $("report-rows").append(row);
      }
      $("report-empty").hidden = Boolean($("report-rows").children.length);
      $("report-format-hint").textContent =
        (ctx.portablePreferences().timeFormat === "decimal"
          ? "Decimal hours"
          : "Hours : minutes : seconds") +
        " · Monday starts each week · Included through " +
        dateTime(report.asOf) +
        " · " +
        report.timezone +
        ". Legacy CSV groups every responsibility except the original VD/SIT IDs as Additional.";
      errorAt("report-error", null);
    } catch (e) {
      errorAt("report-error", e);
    }
  }
  $("open-reports").onclick = () => {
    render();
    $("reports").showModal();
  };
  $("close-reports").onclick = () => $("reports").close();
  for (const id of ["report-period", "report-anchor", "report-role"])
    $(id).onchange = render;
  $("refresh-report").onclick = render;
  for (const [id, direction] of [
    ["previous-period", -1],
    ["next-period", 1],
  ])
    $(id).onclick = () => {
      try {
        $("report-anchor").value = adjacentPeriod(
          $("report-period").value,
          $("report-anchor").value,
          direction,
        );
        render();
      } catch (e) {
        errorAt("report-error", e);
      }
    };
  for (const [id, legacy] of [
    ["report-csv", false],
    ["report-legacy", true],
  ])
    $(id).onclick = () => {
      try {
        render();
        if (report)
          ctx.download(
            legacy ? legacyReportCsv(report) : reportCsv(report),
            "sdm-" +
              report.start +
              "-" +
              (legacy ? "legacy" : "daily-v2") +
              ".csv",
            "text/csv",
          );
      } catch (e) {
        errorAt("report-error", e);
      }
    };
  return {
    render: () => {
      if ($("reports").open) render();
    },
  };
}
