import { localDate } from "./domain.js";
import { restoreBackup, sessionCsv } from "./backup.js";

export function setupData({
  getRepository,
  change,
  download,
  fail,
  renderClocks,
}) {
  const $ = (id) => document.getElementById(id);
  const dialog = $("settings");
  const tabs = ["data", "clocks"];

  function selectTab(name, focus = false) {
    for (const tabName of tabs) {
      const active = name === tabName;
      const button = $("settings-tab-" + tabName);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      $("settings-" + tabName).hidden = !active;
      if (active && focus) button.focus();
    }
    dialog.scrollTop = 0;
  }

  function feedback(message = "") {
    $("data-feedback").textContent = message;
    $("data-feedback").hidden = !message;
  }

  function open(name = "data") {
    $("data-error").hidden = true;
    feedback();
    selectTab(name);
    renderClocks();
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    if (name === "clocks") $("extra-clock-name").focus();
    else $("settings-tab-data").focus();
    refresh();
  }

  for (const name of tabs) {
    const button = $("settings-tab-" + name);
    button.onclick = () => selectTab(name);
    button.onkeydown = (event) => {
      const index = tabs.indexOf(name);
      const next = {
        ArrowLeft: tabs[(index + tabs.length - 1) % tabs.length],
        ArrowRight: tabs[(index + 1) % tabs.length],
        Home: tabs[0],
        End: tabs.at(-1),
      }[event.key];
      if (!next) return;
      event.preventDefault();
      selectTab(next, true);
    };
  }

  async function refresh() {
    try {
      const repository = getRepository();
      if (!repository) return;
      const { meta, checkpoints } = await repository.details();
      const persistent = await navigator.storage?.persisted?.();
      const canProtect = Boolean(navigator.storage?.persist);
      $("storage-status").textContent = persistent
        ? "Protection is on."
        : canProtect
          ? "Protection is off."
          : "Protection is unavailable in this browser.";
      $("protect-storage").hidden = Boolean(persistent) || !canProtect;
      $("backup-status").textContent = meta.lastExportAt
        ? `Last backup requested ${new Date(meta.lastExportAt).toLocaleString()}.`
        : "No backup yet. A backup includes your clocks, time, and notes.";
      const due =
        !meta.lastExportAt || Date.now() - meta.lastExportAt > 7 * 86400000;
      $("backup-reminder").hidden = !due;
      const selectedPoint = $("recovery-point").value;
      $("recovery-point").replaceChildren();
      for (const point of checkpoints.toReversed()) {
        const option = document.createElement("option");
        option.value = point.id;
        option.textContent = `${new Date(point.at).toLocaleString()} · ${point.reason}`;
        $("recovery-point").append(option);
      }
      if (checkpoints.some((point) => point.id === selectedPoint))
        $("recovery-point").value = selectedPoint;
      $("recovery-count").textContent = `${checkpoints.length} saved`;
      $("restore-point").hidden = !checkpoints.length;
      $("restore-point").disabled = !checkpoints.length;
      $("recovery-point").closest("label").hidden = !checkpoints.length;
      $("recovery-empty").hidden = Boolean(checkpoints.length);
    } catch (error) {
      fail(error);
    }
  }
  $("data").onclick = () => open();
  $("backup-reminder").onclick = () => open();
  $("close-settings").onclick = () => dialog.close();
  $("protect-storage").onclick = async () => {
    try {
      const granted = await navigator.storage.persist();
      feedback(
        granted
          ? "Browser storage is protected."
          : "The browser left protection off. Download a backup to keep a separate copy.",
      );
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
      feedback("Backup download requested.");
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
      feedback("CSV download requested.");
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
        const restored = await change(
          () => imported,
          "Backup restored. Tracking paused.",
          { checkpoint: true },
        );
        if (restored) {
          renderClocks();
          await refresh();
          feedback("Backup restored. Tracking is paused.");
        }
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
        const saved = await change(
          () => restored,
          "Recovery point restored. Tracking paused.",
          { checkpoint: true },
        );
        if (saved) {
          renderClocks();
          await refresh();
          feedback("Recovery point restored. Tracking is paused.");
        }
      }
    } catch (error) {
      fail(error);
    }
  };
  return { open, refresh, feedback };
}
