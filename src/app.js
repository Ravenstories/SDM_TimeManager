import {
  duration,
  localDate,
  totals,
  switchRole,
  saveSession,
  removeSession,
  dayBounds,
  decimalHours,
} from "./domain.js";
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
let timeFormat = localStorage.getItem(KEY + ".time-format") || "clock";
const formatTime = (milliseconds) =>
  timeFormat === "decimal" ? decimalHours(milliseconds) : duration(milliseconds);
const roleName = (role) =>
  role === "extra" ? state.extraClock?.name || "Additional" : role.toUpperCase();
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
      role ? `Tracking ${roleName(role)}` : "Tracking paused",
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
    balanceTotal = t.vd + t.sit,
    total =
      t.vd +
      t.sit +
      (state.extraClock?.countsAsWork ? t.extra : 0);
  for (const role of ["vd", "sit"]) {
    const active = state.active?.role === role;
    $(role).setAttribute("aria-pressed", String(active));
    $(role + "-time").textContent = formatTime(t[role]);
    $(role + "-badge").textContent = active ? "● Tracking" : "Ready";
    $(role + "-action").textContent = active
      ? "Currently tracking"
      : `${state.active ? "Switch to" : "Start"} ${role.toUpperCase()} ↗`;
    $(role + "-bar").style.width = `${balanceTotal ? (t[role] / balanceTotal) * 100 : 0}%`;
    $(role + "-percent").textContent =
      `${balanceTotal ? Math.round((t[role] / balanceTotal) * 100) : 0}%`;
  }
  if (state.extraClock) {
    const active = state.active?.role === "extra";
    $("extra").setAttribute("aria-pressed", String(active));
    $("extra-time").textContent = formatTime(t.extra);
    $("extra-badge").textContent = active ? "● Tracking" : "Ready";
    $("extra-action").textContent = active
      ? "Currently tracking"
      : `${state.active ? "Switch to" : "Start"} ${state.extraClock.name} ↗`;
  }
  $("total").textContent =
    timeFormat === "decimal"
      ? `${decimalHours(total)} total`
      : `${Math.floor(total / 3600000)}h ${String(Math.floor(total / 60000) % 60).padStart(2, "0")}m total`;
  $("pause").disabled = !state.active;
  $("work-status").textContent = state.active
    ? `${roleName(state.active.role)} is on the clock`
    : "Paused · Take your time";
  $("session-status").textContent = state.active
    ? `Current session ${formatTime(now - state.active.start)} · continues in background`
    : "Select a responsibility to begin.";
  $("today-label").textContent = new Date(now)
    .toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .toUpperCase();
  document.title = state.active
    ? `${formatTime(t[state.active.role])} · ${roleName(state.active.role)} — SDM`
    : "Paused — SDM Time Manager";
  $("past-summary").hidden = selectedDay === today;
  if (selectedDay !== today) {
    const past = totals(state, selectedDay, now),
      pastTotal =
        past.vd +
        past.sit +
        (state.extraClock?.countsAsWork ? past.extra : 0),
      extraSummary = state.extraClock
        ? ` · ${state.extraClock.name} ${formatTime(past.extra)}`
        : "";
    $("past-summary").textContent =
      `VD ${formatTime(past.vd)} · SIT ${formatTime(past.sit)}${extraSummary} · Work total ${formatTime(pastTotal)}`;
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
    const actions = document.createElement("div");
    actions.className = "note-actions";
    const edit = document.createElement("button");
    edit.textContent = "Edit";
    edit.setAttribute("aria-label", `Edit note: ${note.text.slice(0, 40)}`);
    edit.onclick = () => editNote(row, note);
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
    actions.append(edit, remove);
    row.append(tag, time, content, actions);
    $("notes").append(row);
  }
}
function editNote(row, note) {
  const editor = document.createElement("textarea");
  editor.value = note.text;
  editor.maxLength = 5000;
  editor.setAttribute("aria-label", "Edit note text");
  const actions = document.createElement("div");
  actions.className = "inline-editor-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.onclick = renderNotes;
  const save = document.createElement("button");
  save.type = "button";
  save.className = "primary";
  save.textContent = "Save";
  save.onclick = async () => {
    const text = editor.value.trim();
    if (!text) return editor.focus();
    await change(
      (s) => ({
        ...s,
        notes: s.notes.map((item) =>
          item.id === note.id ? { ...item, text } : item,
        ),
      }),
      "Note updated",
    );
  };
  actions.append(cancel, save);
  row.replaceChildren(editor, actions);
  row.classList.add("note-editing");
  editor.focus();
}
function render() {
  const hasExtra = Boolean(state.extraClock);
  $("extra").hidden = !hasExtra;
  $("extra-title").textContent = state.extraClock?.name || "Other";
  $("extra-description").textContent = state.extraClock?.countsAsWork
    ? "Additional work"
    : "Excluded from work total";
  $("note-extra-role").hidden = !hasExtra;
  $("note-extra-role").textContent = state.extraClock?.name || "Additional clock";
  $("time-entry-extra").hidden = !hasExtra;
  $("time-entry-extra").textContent = state.extraClock?.name || "Additional clock";
  if (!hasExtra && $("note-role").value === "extra")
    $("note-role").value = "vd";
  if (!hasExtra && $("time-entry-role").value === "extra")
    $("time-entry-role").value = "vd";
  document.querySelector(".clocks").classList.toggle("has-extra", hasExtra);
  $("configure-clock").textContent = hasExtra
    ? "Manage additional clock"
    : "＋ Add clock";
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
$("today").onclick = () => {
  selectedDay = localDate();
  $("day").value = selectedDay;
  render();
};
for (const role of ["vd", "sit", "extra"])
  $(role).onclick = () => activate(role);
$("pause").onclick = () => activate(null);
document.addEventListener("keydown", (e) => {
  if (
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    $("settings").open ||
    $("reports").open ||
    $("time-editor").open ||
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
  $("note-count").textContent = `${$("note").value.length} / 5000`;
};
$("time-format").value = timeFormat;
$("time-format").onchange = () => {
  timeFormat = $("time-format").value;
  localStorage.setItem(KEY + ".time-format", timeFormat);
  render();
};

const localInputValue = (timestamp) => {
  const date = new Date(
    timestamp - new Date(timestamp).getTimezoneOffset() * 60000,
  );
  return date.toISOString().slice(0, 16);
};
function resetTimeEntryForm() {
  const [start] = dayBounds(selectedDay);
  $("time-entry-id").value = "";
  $("time-entry-role").value = state.active?.role || "vd";
  $("time-entry-start").value = localInputValue(start + 9 * 3600000);
  $("time-entry-end").value = localInputValue(start + 10 * 3600000);
  $("save-time-entry").textContent = "Add time entry";
  $("cancel-time-entry").hidden = true;
  $("time-entry-error").hidden = true;
}
function renderTimeEditor() {
  $("time-editor-day").textContent = new Date(
    `${selectedDay}T12:00:00`,
  ).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const [dayStart, dayEnd] = dayBounds(selectedDay);
  const entries = state.sessions.filter(
    (session) => session.start < dayEnd && session.end > dayStart,
  );
  $("time-entry-list").replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty compact-empty";
    empty.textContent = "No completed time entries on this day.";
    $("time-entry-list").append(empty);
  }
  for (const session of entries) {
    const row = document.createElement("div");
    row.className = "time-entry-row";
    const summary = document.createElement("span");
    summary.innerHTML = `<strong>${session.role.toUpperCase()}</strong> ${new Date(session.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${new Date(session.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} <small>${duration(session.end - session.start)}</small>`;
    const edit = document.createElement("button");
    edit.textContent = "Edit";
    edit.onclick = () => {
      $("time-entry-id").value = session.id;
      $("time-entry-role").value = session.role;
      $("time-entry-start").value = localInputValue(session.start);
      $("time-entry-end").value = localInputValue(session.end);
      $("save-time-entry").textContent = "Save changes";
      $("cancel-time-entry").hidden = false;
      $("time-entry-start").focus();
    };
    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.onclick = async () => {
      if (confirm("Delete this time entry?")) {
        await change((s) => removeSession(s, session.id), "Time entry deleted");
        renderTimeEditor();
      }
    };
    const actions = document.createElement("div");
    actions.append(edit, remove);
    row.append(summary, actions);
    $("time-entry-list").append(row);
  }
}
$("manage-time").onclick = () => {
  resetTimeEntryForm();
  renderTimeEditor();
  $("time-editor").showModal();
};
$("close-time-editor").onclick = () => $("time-editor").close();
$("cancel-time-entry").onclick = resetTimeEntryForm;
$("time-entry-form").onsubmit = async (event) => {
  event.preventDefault();
  const entry = {
    id: $("time-entry-id").value || crypto.randomUUID(),
    role: $("time-entry-role").value,
    start: new Date($("time-entry-start").value).getTime(),
    end: new Date($("time-entry-end").value).getTime(),
  };
  try {
    saveSession(state, entry);
    if (
      await change(
        (current) => saveSession(current, entry),
        $("time-entry-id").value
          ? "Time entry updated"
          : "Time entry added",
      )
    ) {
      resetTimeEntryForm();
      renderTimeEditor();
    }
  } catch (error) {
    $("time-entry-error").textContent = error.message;
    $("time-entry-error").hidden = false;
  }
};
function renderExtraClockSettings() {
  $("extra-clock-name").value = state.extraClock?.name || "";
  $("extra-clock-work").checked = state.extraClock?.countsAsWork ?? true;
  $("remove-extra-clock").hidden = !state.extraClock;
}
$("save-extra-clock").onclick = async () => {
  const name = $("extra-clock-name").value.trim();
  if (!name) {
    $("extra-clock-name").focus();
    return;
  }
  if (
    await change(
      (current) => ({
        ...current,
        extraClock: {
          name,
          countsAsWork: $("extra-clock-work").checked,
        },
      }),
      state.extraClock ? "Additional clock updated" : "Additional clock added",
    )
  )
    renderExtraClockSettings();
};
$("remove-extra-clock").onclick = async () => {
  if (
    !confirm(
      "Remove this clock? Its completed time and notes will remain in your history.",
    )
  )
    return;
  const now = Date.now();
  await change(
    (current) => {
      const paused =
        current.active?.role === "extra"
          ? switchRole(current, null, now, crypto.randomUUID())
          : current;
      return { ...paused, extraClock: null };
    },
    "Additional clock removed",
  );
  renderExtraClockSettings();
};
$("data").addEventListener("click", renderExtraClockSettings);
$("backup-reminder").addEventListener("click", renderExtraClockSettings);
$("configure-clock").onclick = () => {
  $("data").click();
  $("extra-clock-name").focus();
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
  $("note-count").textContent = `${$("note").value.length} / 5000`;
  if (state.active) $("note-role").value = state.active.role;
  render();
  renderExtraClockSettings();
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
