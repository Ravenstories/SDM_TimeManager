import {
  duration,
  localDate,
  totals,
  switchRole,
  validateState,
} from "./domain.js";
import { LocalRepository, KEY } from "./storage.js";
const $ = (id) => document.getElementById(id);
let repository,
  state,
  selectedDay = localDate(),
  lastToday = localDate();
const announce = (message) => {
  $("announcement").textContent = message;
};
function fail(error) {
  $("error").hidden = false;
  $("error").textContent =
    `Could not save or load your data: ${error.message} Your existing records have not been replaced. Export a backup if possible.`;
}
async function change(fn, message) {
  try {
    state = await repository.update(fn);
    $("error").hidden = true;
    render();
    if (message) announce(message);
    return true;
  } catch (error) {
    fail(error);
    return false;
  }
}
async function activate(role) {
  if (
    await change(
      (s) => switchRole(s, role, Date.now(), crypto.randomUUID()),
      role ? `Tracking ${role.toUpperCase()}` : "Tracking paused",
    )
  ) {
    if (role) $("note-role").value = role;
  }
}
function tick() {
  if (!state) return;
  const now = Date.now(),
    today = localDate(now);
  if (today !== lastToday) {
    if (selectedDay === lastToday) {
      selectedDay = today;
      $("day").value = today;
      renderNotes();
    }
    lastToday = today;
  }
  const t = totals(state, today, now),
    total = t.vd + t.sit;
  for (const role of ["vd", "sit"]) {
    const active = state.active?.role === role;
    $(role).setAttribute("aria-pressed", String(active));
    $(role + "-time").textContent = duration(t[role]);
    $(role + "-badge").textContent = active ? "● Tracking" : "Ready";
    $(role + "-action").textContent = active
      ? "Currently tracking"
      : `${state.active ? "Switch to" : "Start"} ${role.toUpperCase()} ↗`;
    $(role + "-bar").style.width = `${total ? (t[role] / total) * 100 : 0}%`;
    $(role + "-percent").textContent =
      `${total ? Math.round((t[role] / total) * 100) : 0}%`;
  }
  $("total").textContent =
    `${Math.floor(total / 3600000)}h ${String(Math.floor(total / 60000) % 60).padStart(2, "0")}m total`;
  $("pause").disabled = !state.active;
  $("work-status").textContent = state.active
    ? `${state.active.role.toUpperCase()} is on the clock`
    : "Paused · Take your time";
  $("session-status").textContent = state.active
    ? `Current session ${duration(now - state.active.start)} · continues in background`
    : "Select a responsibility to begin.";
  $("today-label").textContent = new Date(now)
    .toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .toUpperCase();
  document.title = state.active
    ? `${duration(t[state.active.role])} · ${state.active.role.toUpperCase()} — SDM`
    : "Paused — SDM Time Manager";
  $("past-summary").hidden = selectedDay === today;
  if (selectedDay !== today) {
    const past = totals(state, selectedDay, now);
    $("past-summary").textContent =
      `VD ${duration(past.vd)} · SIT ${duration(past.sit)} · Total ${duration(past.vd + past.sit)}`;
  }
}
function renderNotes() {
  $("notes").replaceChildren();
  const notes = state.notes
    .filter((n) => localDate(n.at) === selectedDay)
    .sort((a, b) => b.at - a.at);
  if (!notes.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent =
      "A little context goes a long way. Add your first note for today.";
    $("notes").append(empty);
  }
  for (const note of notes) {
    const row = document.createElement("article");
    row.className = "note-row";
    const tag = document.createElement("span");
    tag.className = `note-tag ${note.role}`;
    tag.textContent = note.role.toUpperCase();
    const time = document.createElement("time");
    time.dateTime = new Date(note.at).toISOString();
    time.textContent = new Date(note.at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const content = document.createElement("p");
    content.textContent = note.text;
    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.setAttribute("aria-label", `Delete note: ${note.text.slice(0, 40)}`);
    remove.onclick = () => {
      if (confirm("Delete this note?"))
        change(
          (s) => ({ ...s, notes: s.notes.filter((n) => n.id !== note.id) }),
          "Note deleted",
        );
    };
    row.append(tag, time, content, remove);
    $("notes").append(row);
  }
}
function render() {
  tick();
  renderNotes();
}
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("day").value = selectedDay;
$("day").onchange = () => {
  if ($("day").value) {
    selectedDay = $("day").value;
    render();
  }
};
for (const role of ["vd", "sit"]) $(role).onclick = () => activate(role);
$("pause").onclick = () => activate(null);
document.addEventListener("keydown", (e) => {
  if (
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    $("settings").open ||
    /INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName) ||
    e.target.isContentEditable
  )
    return;
  if (e.key === "1" || e.key === "2") {
    e.preventDefault();
    activate(e.key === "1" ? "vd" : "sit");
  }
  if (e.code === "Space") {
    e.preventDefault();
    activate(null);
  }
});
$("note-form").onsubmit = async (e) => {
  e.preventDefault();
  const text = $("note").value.trim(),
    role = $("note-role").value;
  if (!text) return;
  const ok = await change(
    (s) => ({
      ...s,
      notes: [
        ...s.notes,
        { id: crypto.randomUUID(), at: Date.now(), role, text },
      ],
    }),
    "Note saved",
  );
  if (ok) {
    $("note").value = "";
    localStorage.removeItem(KEY + ".draft");
    selectedDay = localDate();
    $("day").value = selectedDay;
    renderNotes();
  }
};
$("note").oninput = () => {
  try {
    localStorage.setItem(KEY + ".draft", $("note").value);
  } catch (error) {
    fail(error);
  }
};
$("compact").onclick = () => {
  const compact = document.body.classList.toggle("compact");
  $("compact").textContent = compact ? "Full view" : "Compact view";
  $("compact").setAttribute("aria-pressed", String(compact));
};
$("data").onclick = () => $("settings").showModal();
$("close-settings").onclick = () => $("settings").close();
$("export").onclick = () => {
  try {
    download(
      JSON.stringify(
        { exportedAt: Date.now(), state: repository.read() },
        null,
        2,
      ),
      `sdm-backup-${localDate()}.json`,
      "application/json",
    );
  } catch (error) {
    fail(error);
  }
};
$("csv").onclick = () => {
  try {
    const saved = repository.read(),
      now = Date.now();
    const sessions = saved.active
      ? [...saved.sessions, { ...saved.active, end: now }]
      : saved.sessions;
    const rows = sessions.map((s) => [
      s.role.toUpperCase(),
      new Date(s.start).toISOString(),
      new Date(s.end).toISOString(),
      ((s.end - s.start) / 60000).toFixed(2),
    ]);
    download(
      [
        "Role,Start (UTC),End (UTC),Minutes",
        ...rows.map((r) => r.join(",")),
      ].join("\r\n"),
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
    if (file.size > 10000000)
      throw new Error("Backup is too large (maximum 10 MB).");
    const backup = JSON.parse(await file.text());
    let imported = validateState(backup.state);
    if (
      !Number.isFinite(backup.exportedAt) ||
      backup.exportedAt < 0 ||
      backup.exportedAt > Date.now() + 60000
    )
      throw new Error("Invalid backup export time.");
    if (imported.active && backup.exportedAt < imported.active.start)
      throw new Error("Invalid running session.");
    if (imported.active)
      imported = switchRole(
        imported,
        null,
        backup.exportedAt,
        crypto.randomUUID(),
      );
    if (
      confirm(
        `Replace this browser's records with ${imported.sessions.length} sessions and ${imported.notes.length} notes? Export a backup first if you need the current records.`,
      )
    )
      await change(() => imported, "Backup restored. Tracking paused.");
  } catch (error) {
    fail(error);
  } finally {
    $("import").value = "";
  }
};
try {
  repository = new LocalRepository(localStorage);
  state = repository.read();
  $("note").value = localStorage.getItem(KEY + ".draft") || "";
  if (state.active) $("note-role").value = state.active.role;
  render();
} catch (error) {
  fail(error);
}
window.addEventListener("storage", (e) => {
  if (e.key === KEY || e.key === null) {
    try {
      state = repository.read();
      render();
    } catch (error) {
      fail(error);
    }
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    try {
      state = repository.read();
      render();
    } catch (error) {
      fail(error);
    }
  }
});
setInterval(tick, 1000);
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {});
