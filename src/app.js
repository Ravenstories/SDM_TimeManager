import {
  duration,
  getExtraClocks,
  localDate,
  totals,
  switchRole,
  saveSession,
  removeSession,
  adjustActiveStart,
  applyScheduledSwitch,
  scheduleSwitch,
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
  lastToday = localDate(),
  transitionInProgress = false;
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
const formatTime = duration;
const roleName = (role) =>
  getExtraClocks(state).find((clock) => clock.id === role)?.name ||
  (role.startsWith("extra") ? "Additional" : role.toUpperCase());
const extraTotal = (time) =>
  getExtraClocks(state).reduce(
    (sum, clock) => sum + (clock.countsAsWork ? time[clock.id] : 0),
    0,
  );
const clockPartId = (role, part) => `${role}-${part}`;
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
  if (
    state.scheduledSwitch &&
    now >= state.scheduledSwitch.at &&
    !transitionInProgress
  ) {
    const targetName = roleName(state.scheduledSwitch.toRole);
    transitionInProgress = true;
    change(
      (current) =>
        applyScheduledSwitch(current, now, crypto.randomUUID()),
      `Automatically switched to ${targetName}`,
    ).finally(() => {
      transitionInProgress = false;
    });
    return;
  }
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
    total = t.vd + t.sit + extraTotal(t);
  for (const role of ["vd", "sit"]) {
    const active = state.active?.role === role;
    $(role).setAttribute("aria-pressed", String(active));
    $(role + "-time").textContent = formatTime(t[role]);
    $(role + "-decimal").textContent = decimalHours(t[role]);
    $(role + "-badge").textContent = active ? "● Tracking" : "Ready";
    $(role + "-action").textContent = active
      ? "Currently tracking"
      : `${state.active ? "Switch to" : "Start"} ${role.toUpperCase()} ↗`;
    $(role + "-bar").style.width = `${balanceTotal ? (t[role] / balanceTotal) * 100 : 0}%`;
    $(role + "-percent").textContent =
      `${balanceTotal ? Math.round((t[role] / balanceTotal) * 100) : 0}%`;
  }
  for (const clock of getExtraClocks(state)) {
    const active = state.active?.role === clock.id;
    $(clock.id).setAttribute("aria-pressed", String(active));
    $(clockPartId(clock.id, "time")).textContent = formatTime(t[clock.id]);
    $(clockPartId(clock.id, "decimal")).textContent = decimalHours(t[clock.id]);
    $(clockPartId(clock.id, "badge")).textContent = active
      ? "● Tracking"
      : "Ready";
    $(clockPartId(clock.id, "action")).textContent = active
      ? "Currently tracking"
      : `${state.active ? "Switch to" : "Start"} ${clock.name} ↗`;
  }
  $("total").textContent =
    `${Math.floor(total / 3600000)}h ${String(Math.floor(total / 60000) % 60).padStart(2, "0")}m · ${decimalHours(total)} total`;
  $("pause").disabled = !state.active;
  $("adjust-start").hidden = !state.active;
  $("schedule-switch").hidden = !state.active;
  $("schedule-switch").textContent = state.scheduledSwitch
    ? "Change auto-switch"
    : "Auto-switch";
  $("work-status").textContent = state.active
    ? `${roleName(state.active.role)} is on the clock`
    : "Paused · Take your time";
  const switchStatus = state.scheduledSwitch
    ? ` · switches to ${roleName(state.scheduledSwitch.toRole)} in ${duration(state.scheduledSwitch.at - now)}`
    : " · continues in background";
  $("session-status").textContent = state.active
    ? `Current session ${formatTime(now - state.active.start)}${switchStatus}`
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
      pastTotal = past.vd + past.sit + extraTotal(past),
      extraSummary = getExtraClocks(state)
        .map((clock) => ` · ${clock.name} ${formatTime(past[clock.id])}`)
        .join("");
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
    tag.className = `note-tag ${note.role.startsWith("extra") ? "extra" : note.role}`;
    tag.textContent = roleName(note.role);
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
function renderClockCards(extraClocks) {
  document.querySelectorAll(".clock.extra").forEach((clock) => clock.remove());
  extraClocks.forEach((clock, index) => {
    const shortcut = index + 3;
    const button = document.createElement("button");
    button.className = "clock extra";
    button.id = clock.id;
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `<span class="card-heading"><span><span class="role-title"><i></i><span data-clock-title></span></span><span class="role-description" data-clock-description></span></span><span class="badge" id="${clockPartId(clock.id, "badge")}">Ready</span></span><span class="time" id="${clockPartId(clock.id, "time")}">00:00:00</span><span class="time-caption"><strong id="${clockPartId(clock.id, "decimal")}">0.00 h</strong> · tracked today</span><span class="card-bottom"><span id="${clockPartId(clock.id, "action")}">Start <span aria-hidden="true">↗</span></span>${shortcut <= 9 ? `<kbd>${shortcut}</kbd>` : ""}</span>`;
    button.querySelector("[data-clock-title]").textContent = clock.name;
    button.querySelector("[data-clock-description]").textContent =
      clock.countsAsWork ? "Additional work" : "Excluded from work total";
    button.onclick = () => activate(clock.id);
    document.querySelector(".clocks").append(button);
  });
}
function syncExtraOptions(select, extraClocks) {
  const previous = select.value;
  select
    .querySelectorAll("option[data-extra], option[data-historical]")
    .forEach((option) => option.remove());
  for (const clock of extraClocks) {
    const option = document.createElement("option");
    option.value = clock.id;
    option.textContent = clock.name;
    option.dataset.extra = "true";
    select.append(option);
  }
  select.value = [...select.options].some((option) => option.value === previous)
    ? previous
    : "vd";
}
function render() {
  const extraClocks = getExtraClocks(state);
  renderClockCards(extraClocks);
  syncExtraOptions($("note-role"), extraClocks);
  syncExtraOptions($("time-entry-role"), extraClocks);
  document
    .querySelector(".clocks")
    .classList.toggle("has-extra", extraClocks.length > 0);
  $("configure-clock").textContent = extraClocks.length
    ? `Manage clocks (${extraClocks.length})`
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
for (const role of ["vd", "sit"])
  $(role).onclick = () => activate(role);
$("pause").onclick = () => activate(null);
$("adjust-start").onclick = () => {
  if (!state.active) return;
  $("active-start-role").textContent = roleName(state.active.role);
  $("active-start-time").value = localInputValue(state.active.start);
  $("active-start-time").max = localInputValue(Date.now());
  $("active-start-error").hidden = true;
  $("active-start-editor").showModal();
  $("active-start-time").focus();
};
document.addEventListener("keydown", (e) => {
  if (
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    $("settings").open ||
    $("reports").open ||
    $("time-editor").open ||
    $("active-start-editor").open ||
    $("scheduled-switch-editor").open ||
    /INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName) ||
    e.target.isContentEditable
  )
    return;
  const shortcutRoles = [
    "vd",
    "sit",
    ...getExtraClocks(state).map((clock) => clock.id),
  ];
  const shortcutIndex = Number(e.key) - 1;
  if (shortcutIndex >= 0 && shortcutIndex < shortcutRoles.length) {
    e.preventDefault();
    activate(shortcutRoles[shortcutIndex]);
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
const localInputValue = (timestamp) => {
  const date = new Date(
    timestamp - new Date(timestamp).getTimezoneOffset() * 60000,
  );
  return date.toISOString().slice(0, 16);
};
$("close-active-start").onclick = () => $("active-start-editor").close();
$("cancel-active-start").onclick = () => $("active-start-editor").close();
$("active-start-form").onsubmit = async (event) => {
  event.preventDefault();
  const start = new Date($("active-start-time").value).getTime();
  const now = Date.now();
  try {
    adjustActiveStart(state, start, now);
    if (
      await change(
        (current) => adjustActiveStart(current, start, now),
        "Active start time updated",
      )
    )
      $("active-start-editor").close();
  } catch (error) {
    $("active-start-error").textContent = error.message;
    $("active-start-error").hidden = false;
  }
};
function renderSwitchTargets() {
  const select = $("scheduled-switch-target");
  const previous = state.scheduledSwitch?.toRole;
  select.replaceChildren();
  const roles = [
    { id: "vd", name: "VD" },
    { id: "sit", name: "SIT" },
    ...getExtraClocks(state),
  ];
  for (const role of roles.filter((item) => item.id !== state.active?.role)) {
    const option = document.createElement("option");
    option.value = role.id;
    option.textContent = role.name;
    select.append(option);
  }
  if (previous && [...select.options].some((option) => option.value === previous))
    select.value = previous;
}
$("schedule-switch").onclick = () => {
  if (!state.active) return;
  renderSwitchTargets();
  const remaining = state.scheduledSwitch
    ? Math.max(1, Math.ceil((state.scheduledSwitch.at - Date.now()) / 60000))
    : 30;
  $("scheduled-switch-minutes").value = remaining;
  $("cancel-scheduled-switch").hidden = !state.scheduledSwitch;
  $("scheduled-switch-error").hidden = true;
  $("scheduled-switch-editor").showModal();
  $("scheduled-switch-minutes").focus();
};
$("close-scheduled-switch").onclick = () =>
  $("scheduled-switch-editor").close();
$("cancel-scheduled-switch-dialog").onclick = () =>
  $("scheduled-switch-editor").close();
$("cancel-scheduled-switch").onclick = async () => {
  if (
    await change(
      (current) => ({ ...current, scheduledSwitch: null }),
      "Automatic switch cancelled",
    )
  )
    $("scheduled-switch-editor").close();
};
$("scheduled-switch-form").onsubmit = async (event) => {
  event.preventDefault();
  const minutes = Number($("scheduled-switch-minutes").value);
  const now = Date.now();
  const at = now + minutes * 60000;
  try {
    scheduleSwitch(state, $("scheduled-switch-target").value, at, now);
    if (
      await change(
        (current) =>
          scheduleSwitch(
            current,
            $("scheduled-switch-target").value,
            at,
            now,
          ),
        "Automatic switch scheduled",
      )
    )
      $("scheduled-switch-editor").close();
  } catch (error) {
    $("scheduled-switch-error").textContent = error.message;
    $("scheduled-switch-error").hidden = false;
  }
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
    summary.innerHTML = `<strong></strong> ${new Date(session.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${new Date(session.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} <small>${duration(session.end - session.start)}</small>`;
    summary.querySelector("strong").textContent = roleName(session.role);
    const edit = document.createElement("button");
    edit.textContent = "Edit";
    edit.onclick = () => {
      $("time-entry-id").value = session.id;
      if (
        ![...$("time-entry-role").options].some(
          (option) => option.value === session.role,
        )
      ) {
        const historical = document.createElement("option");
        historical.value = session.role;
        historical.textContent = `${roleName(session.role)} (removed clock)`;
        historical.dataset.historical = "true";
        $("time-entry-role").append(historical);
      }
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
  const list = $("extra-clock-list");
  list.replaceChildren();
  for (const clock of getExtraClocks(state)) {
    const row = document.createElement("div");
    row.className = "extra-clock-row";
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Name";
    const name = document.createElement("input");
    name.value = clock.name;
    name.maxLength = 40;
    nameLabel.append(name);
    const workLabel = document.createElement("label");
    workLabel.className = "check-label";
    const work = document.createElement("input");
    work.type = "checkbox";
    work.checked = clock.countsAsWork;
    workLabel.append(work, " Include in work total");
    const actions = document.createElement("div");
    actions.className = "data-actions";
    const save = document.createElement("button");
    save.textContent = "Save changes";
    save.onclick = async () => {
      const updatedName = name.value.trim();
      if (!updatedName) return name.focus();
      await change(
        (current) => ({
          ...current,
          extraClock: null,
          extraClocks: getExtraClocks(current).map((item) =>
            item.id === clock.id
              ? { ...item, name: updatedName, countsAsWork: work.checked }
              : item,
          ),
        }),
        `${updatedName} updated`,
      );
      renderExtraClockSettings();
    };
    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.onclick = async () => {
      if (
        !confirm(
          `Remove ${clock.name}? Its completed time and notes will remain in your history.`,
        )
      )
        return;
      const now = Date.now();
      await change(
        (current) => {
          const paused =
            current.active?.role === clock.id
              ? switchRole(current, null, now, crypto.randomUUID())
              : current;
          return {
            ...paused,
            extraClock: null,
            extraClocks: getExtraClocks(paused).filter(
              (item) => item.id !== clock.id,
            ),
            scheduledSwitch:
              paused.scheduledSwitch &&
              [
                paused.scheduledSwitch.fromRole,
                paused.scheduledSwitch.toRole,
              ].includes(clock.id)
                ? null
                : paused.scheduledSwitch,
          };
        },
        `${clock.name} removed`,
      );
      renderExtraClockSettings();
    };
    actions.append(save, remove);
    row.append(nameLabel, workLabel, actions);
    list.append(row);
  }
  const count = getExtraClocks(state).length;
  $("extra-clock-count").textContent =
    `${count} additional ${count === 1 ? "clock" : "clocks"}`;
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
        extraClock: null,
        extraClocks: [
          ...getExtraClocks(current),
          {
            id: `extra-${crypto.randomUUID()}`,
            name,
            countsAsWork: $("extra-clock-work").checked,
          },
        ],
      }),
      `${name} added`,
    )
  ) {
    $("extra-clock-name").value = "";
    $("extra-clock-work").checked = true;
    renderExtraClockSettings();
  }
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
