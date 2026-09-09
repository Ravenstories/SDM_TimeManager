import { localDate } from "./domain.js";
import { restoreBackup, sessionCsv } from "./backup.js";

export function setupData({ getRepository, change, download, fail }) {
  const $ = (id) => document.getElementById(id);
  async function refresh() {
    try {
      const repository = getRepository();
      if (!repository) return;
      const { meta, checkpoints } = await repository.details();
      const persistent = await navigator.storage?.persisted?.();
      $("storage-status").textContent = persistent
        ? "Browser storage protection granted."
        : "Browser storage protection is not granted. Keep an external backup.";
      $("protect-storage").disabled =
        Boolean(persistent) || !navigator.storage?.persist;
      $("backup-status").textContent = meta.lastExportAt
        ? `Last backup export requested ${new Date(meta.lastExportAt).toLocaleString()}. Keep the downloaded file somewhere safe.`
        : "No backup exported yet. Download one to protect your work outside this browser.";
      const due =
        !meta.lastExportAt || Date.now() - meta.lastExportAt > 7 * 86400000;
      $("backup-reminder").hidden = !due;
      $("recovery-point").replaceChildren();
      for (const point of checkpoints.toReversed()) {
        const option = document.createElement("option");
        option.value = point.id;
        option.textContent = `${new Date(point.at).toLocaleString()} · ${point.reason}`;
        $("recovery-point").append(option);
      }
      $("restore-point").disabled = !checkpoints.length;
      $("recovery-empty").hidden = Boolean(checkpoints.length);
    } catch (error) {
      fail(error);
    }
  }
  $("data").onclick = () => {
    $("settings").showModal();
    refresh();
  };
  $("backup-reminder").onclick = () => {
    $("settings").showModal();
    refresh();
  };
  $("close-settings").onclick = () => $("settings").close();
  $("protect-storage").onclick = async () => {
    try {
      await navigator.storage.persist();
      await refresh();
    } catch (error) {
      fail(error);
    }
  };
  $("export").onclick = async () => {
    try {
      const repository = getRepository(),
        state = await repository.read();
      download(
        JSON.stringify({ exportedAt: Date.now(), state }, null, 2),
        `sdm-backup-${localDate()}.json`,
        "application/json",
      );
      await repository.recordExport();
      await refresh();
    } catch (error) {
      fail(error);
    }
  };
  $("csv").onclick = async () => {
    try {
      download(
        sessionCsv(await getRepository().read(), Date.now()),
        `sdm-time-${localDate()}.csv`,
        "text/csv",
      );
    } catch (error) {
      fail(error);
    }
  };
  $("import").onchange = async () => {
    const file = $("import").files[0];
    if (!file) return;
    try {
      if (file.size > 50000000)
        throw new Error("Backup is too large (maximum 50 MB).");
      const imported = restoreBackup(
        JSON.parse(await file.text()),
        Date.now(),
        crypto.randomUUID(),
      );
      if (
        confirm(
          `Restore ${imported.sessions.length} sessions and ${imported.notes.length} notes? This replaces current records and pauses tracking. A recovery point of the current records will be saved first.`,
        )
      ) {
        await change(() => imported, "Backup restored. Tracking paused.", {
          checkpoint: true,
        });
        await refresh();
      }
    } catch (error) {
      fail(error);
    } finally {
      $("import").value = "";
    }
  };
  $("restore-point").onclick = async () => {
    try {
      const { checkpoints } = await getRepository().details();
      const point = checkpoints.find((p) => p.id === $("recovery-point").value);
      if (!point) return;
      const restored = restoreBackup(
        { state: point.state, exportedAt: point.at },
        Date.now(),
        crypto.randomUUID(),
      );
      if (
        confirm(
          `Return to the records from ${new Date(point.at).toLocaleString()}? Tracking will pause. Current records will be kept as a recovery point.`,
        )
      ) {
        await change(
          () => restored,
          "Recovery point restored. Tracking paused.",
          { checkpoint: true },
        );
        await refresh();
      }
    } catch (error) {
      fail(error);
    }
  };
  return { refresh };
}
