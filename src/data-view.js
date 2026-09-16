import { localDate } from "./domain.js";
import { restoreBackup, sessionCsv, backupSummary } from "./backup.js";
import { assertUnchanged } from "./editing.js";
import { $, el, errorAt, dateTime } from "./ui.js";
export function setupData(ctx) {
  let pending = null,
    baseline = null;
  async function refresh() {
    try {
      if (!ctx.getRepository()) return;
      const { meta, checkpoints } = await ctx.getRepository().details();
      const persistent = await navigator.storage?.persisted?.();
      $("storage-status").textContent = persistent
        ? "Browser storage protection granted. Keep an external backup."
        : "Browser storage protection is not granted. Keep an external backup.";
      $("protect-storage").disabled =
        Boolean(persistent) || !navigator.storage?.persist;
      $("backup-status").textContent = meta.lastExportAt
        ? "Last backup download requested " +
          dateTime(meta.lastExportAt) +
          ". Keep the file somewhere safe."
        : "No backup download requested yet.";
      $("backup-reminder").hidden = Boolean(
        meta.lastExportAt && Date.now() - meta.lastExportAt < 7 * 86400000,
      );
      const old = $("recovery-point").value;
      $("recovery-point").replaceChildren();
      for (const point of checkpoints.toReversed())
        $("recovery-point").append(
          new Option(dateTime(point.at) + " · " + point.reason, point.id),
        );
      if ([...$("recovery-point").options].some((o) => o.value === old))
        $("recovery-point").value = old;
      $("restore-point").disabled = !checkpoints.length;
      $("recovery-empty").hidden = Boolean(checkpoints.length);
    } catch (e) {
      errorAt("data-error", e);
    }
  }
  async function preview(backup) {
    const state = restoreBackup(backup, Date.now(), crypto.randomUUID());
    pending = state;
    baseline = await ctx.getRepository().read();
    const summary = backupSummary(state),
      current = backupSummary(baseline);
    $("restore-description").replaceChildren(
      el(
        "p",
        "Backup exported " +
          dateTime(backup.exportedAt) +
          ". " +
          summary.range +
          ".",
      ),
      el(
        "p",
        summary.sessions +
          " sessions, " +
          summary.notes +
          " notes, " +
          summary.responsibilities +
          " responsibilities replace " +
          current.sessions +
          " sessions and " +
          current.notes +
          " notes.",
      ),
      el(
        "p",
        "Responsibilities: " +
          state.responsibilities
            .map((r) => r.name + " (" + r.classification + ")")
            .join(", "),
      ),
      el(
        "p",
        backup.state.active
          ? "The imported running timer stops at the backup export time."
          : "The restored timer will be paused.",
      ),
      el(
        "p",
        "Current records are preserved in a recovery point. Display preferences come from the backup. Unfinished drafts must be saved or cancelled first.",
      ),
    );
    $("restore-preview").hidden = false;
  }
  const open = () => {
    errorAt("data-error", null);
    $("settings").showModal();
    refresh();
  };
  $("data").onclick = open;
  $("backup-reminder").onclick = open;
  $("close-settings").onclick = () => $("settings").close();
  $("protect-storage").onclick = async () => {
    try {
      await navigator.storage.persist();
      await refresh();
    } catch (e) {
      errorAt("data-error", e);
    }
  };
  $("export").onclick = async () => {
    try {
      const state = await ctx.getRepository().read();
      state.preferences = ctx.portablePreferences();
      ctx.download(
        JSON.stringify({ exportedAt: Date.now(), state }, null, 2),
        "sdm-backup-" + localDate() + ".json",
        "application/json",
      );
      await ctx.getRepository().recordExport();
      await refresh();
    } catch (e) {
      errorAt("data-error", e);
    }
  };
  for (const [id, legacy] of [
    ["csv", false],
    ["legacy-csv", true],
  ])
    $(id).onclick = async () => {
      try {
        ctx.download(
          sessionCsv(await ctx.getRepository().read(), Date.now(), legacy),
          "sdm-sessions-" + (legacy ? "legacy" : "v2") + ".csv",
          "text/csv",
        );
      } catch (e) {
        errorAt("data-error", e);
      }
    };
  $("import").onchange = async () => {
    try {
      const file = $("import").files[0];
      if (!file) return;
      if (file.size > 50000000)
        throw Error("Backup is too large (maximum 50 MB).");
      await preview(JSON.parse(await file.text()));
      errorAt("data-error", null);
    } catch (e) {
      pending = null;
      $("restore-preview").hidden = true;
      errorAt("data-error", e);
    } finally {
      $("import").value = "";
    }
  };
  $("restore-point").onclick = async () => {
    try {
      const { checkpoints } = await ctx.getRepository().details();
      const point = checkpoints.find((p) => p.id === $("recovery-point").value);
      if (point) await preview({ state: point.state, exportedAt: point.at });
    } catch (e) {
      errorAt("data-error", e);
    }
  };
  $("cancel-restore").onclick = () => {
    pending = null;
    $("restore-preview").hidden = true;
  };
  $("confirm-restore").onclick = async () => {
    if (!pending) return;
    if (ctx.hasDrafts())
      return errorAt(
        "data-error",
        "Save or explicitly cancel unfinished edits before replacing records.",
      );
    const restored = pending;
    if (
      await ctx.change(
        (s) => {
          assertUnchanged(s, baseline);
          return restored;
        },
        "Backup restored. Tracking paused.",
        "data-error",
        { checkpoint: true },
      )
    ) {
      pending = null;
      $("restore-preview").hidden = true;
      ctx.applyPreferences(restored.preferences);
      await refresh();
    }
  };
  return { refresh };
}
