import { duration, localDate, totals, switchRole } from "./domain.js";
import { KEY } from "./storage.js";
import { IndexedRepository } from "./indexed-repository.js";
import { setupData } from "./data-view.js";
import { setupReports } from "./report-view.js";
const $ = (id) => document.getElementById(id);
let repository,
  state,
  selectedDay = localDate(),
  lastToday = localDate();
const reports = setupReports({
  getState: () => state,
  download,
  showDay: (date) => {
    selectedDay = date;
    $("day").value = date;
    document.body.classList.remove("compact");
    $("compact").textContent = "Compact view";
    $("compact").setAttribute("aria-pressed", "false");
    render();
    document.querySelector(".journal").scrollIntoView({ block: "start" });
  },
});
const announce = (message) => {
  $("announcement").textContent = message;
};
function fail(error) {
  $("error").hidden = false;
  $("error").textContent =
    `Could not save or load your data: ${error.message} Your existing records have not been replaced. Export a backup if possible.`;
  $("data-error").hidden = false;
  $("data-error").textContent = error.message;
}
async function change(fn, message, options) {
  try {
    state = await repository.update(fn, options);
    $("error").hidden = true;
    $("data-error").hidden = true;
    render();
    channel?.postMessage("changed");
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
      selectedDay === localDate()
        ? "A little context goes a long way. Add your first note for today."
        : "No notes saved for this day.";
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
  reports.refresh();
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
    $("reports").open ||
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
const channel = "BroadcastChannel" in window ? new BroadcastChannel(KEY) : null;
const dataView = setupData({
  getRepository: () => repository,
  change,
  download,
  fail,
});
async function reloadState() {
  if (!repository) return;
  try {
    state = await repository.read();
    render();
  } catch (error) {
    fail(error);
  }
}
if (channel) channel.onmessage = reloadState;
try {
  repository = await new IndexedRepository().open();
  state = await repository.read();
  $("note").value = localStorage.getItem(KEY + ".draft") || "";
  if (state.active) $("note-role").value = state.active.role;
  render();
  await dataView.refresh();
} catch (error) {
  fail(error);
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) reloadState();
});
setInterval(tick, 1000);
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {});
