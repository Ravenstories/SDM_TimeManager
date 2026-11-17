import { localDate } from "./domain.js";

const shortTime = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});
const datedTime = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});
const axisTime = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const extraColors = [
  "#a6b3d6",
  "#b49aca",
  "#d49d9a",
  "#83babb",
  "#b3b879",
  "#d5a37b",
];

function sameSwitch(first, second) {
  return (
    first?.fromId === second?.fromId &&
    first?.toId === second?.toId &&
    first?.from === second?.from &&
    first?.to === second?.to &&
    first?.start === second?.start &&
    first?.at === second?.at &&
    first?.end === second?.end
  );
}

function shiftLabel(ms) {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return (
    [
      hours && `${hours}h`,
      minutes && `${minutes}m`,
      remaining && `${remaining}s`,
    ]
      .filter(Boolean)
      .join(" ") || "less than a second"
  );
}

export function setupSwitchAdjustment({ save, roleName }) {
  const $ = (id) => document.getElementById(id);
  const editor = $("switch-editor");
  const slider = $("switch-slider");
  const saveButton = $("switch-save");
  const cancelButton = $("switch-cancel");
  const earlier = $("switch-earlier");
  const later = $("switch-later");
  const status = $("switch-status");
  const errorMessage = $("switch-error");
  const switchList = $("timeline-switches");
  const markerElements = new Map();
  const colors = new Map([
    ["vd", "#8ab59c"],
    ["sit", "#d8b879"],
  ]);
  let selection = null;
  let saving = false;
  let displayedMarkers = "";
  let displayedDay = null;
  let displayedRoles = "";
  let latestNow = Date.now();

  function clockColor(role) {
    if (!colors.has(role)) {
      const index = colors.size - 2;
      colors.set(role, extraColors[index % extraColors.length]);
    }
    return colors.get(role);
  }

  function updateSelectedMarkers() {
    for (const [id, { button, dot }] of markerElements) {
      const selected = selection?.point.fromId === id;
      button.setAttribute("aria-expanded", String(selected));
      dot.classList.toggle("is-selected", selected);
    }
  }

  function updatePreview() {
    if (!selection) return;
    const { point, end } = selection;
    const at = slider.valueAsNumber;
    const transferTime = at - point.at;
    const from = transferTime < 0 ? point.from : point.to;
    const to = transferTime < 0 ? point.to : point.from;
    const transfer = transferTime
      ? `Move ${shiftLabel(Math.abs(transferTime))} from ${roleName(from)} to ${roleName(to)}.`
      : "No time moved.";
    const formatter =
      localDate(point.start) === localDate(end) ? shortTime : datedTime;
    const timeLabel = formatter.format(at);
    $("switch-time").textContent = timeLabel;
    $("switch-transfer").textContent = transfer;
    slider.setAttribute("aria-valuetext", `${timeLabel}. ${transfer}`);
    slider.style.setProperty(
      "--switch-progress",
      `${(100 * (at - point.start)) / (end - point.start)}%`,
    );
    slider.disabled = saving;
    cancelButton.disabled = saving;
    earlier.disabled = saving || at <= point.start;
    later.disabled = saving || at >= end;
    saveButton.disabled = saving || transferTime === 0;
  }

  function configureEditor(point, end) {
    const formatter =
      localDate(point.start) === localDate(end) ? shortTime : datedTime;
    slider.min = String(point.start);
    slider.max = String(end);
    slider.value = String(point.at);
    editor.style.setProperty("--switch-from", clockColor(point.from));
    editor.style.setProperty("--switch-to", clockColor(point.to));
    $("switch-direction").textContent =
      `${roleName(point.from)} → ${roleName(point.to)} switch time`;
    $("switch-start").textContent =
      `${roleName(point.from)} · ${formatter.format(point.start)}`;
    $("switch-end").textContent =
      `${roleName(point.to)} · ${formatter.format(end)}${point.end === null ? " (running)" : ""}`;
    updatePreview();
  }

  function openSwitch(point, focus = true) {
    if (saving) return;
    const end = point.end ?? Math.max(point.at, latestNow);
    selection = { point, end, touched: false };
    showStatus("");
    errorMessage.hidden = true;
    editor.hidden = false;
    configureEditor(point, end);
    updateSelectedMarkers();
    if (focus) slider.focus();
  }

  function closeEditor({ focus = false } = {}) {
    const selectedId = selection?.point.fromId;
    selection = null;
    editor.hidden = true;
    errorMessage.hidden = true;
    updateSelectedMarkers();
    if (focus)
      (markerElements.get(selectedId)?.button ?? $("timeline-title")).focus();
  }

  function showStatus(message) {
    status.hidden = !message;
    status.textContent = message;
  }

  function renderOverview({ start, end, segments, switches }) {
    const atPercent = (at) => `${(100 * (at - start)) / (end - start)}%`;
    $("timeline-empty").hidden = Boolean(segments.length || switches.length);
    $("timeline-overview").hidden = !segments.length && !switches.length;
    $("timeline-switch-hint").hidden = !switches.length;
    $("timeline-no-switches").hidden = Boolean(switches.length);
    switchList.hidden = !switches.length;

    const intervalDetails = [];
    const blocks = segments.map((segment) => {
      const block = document.createElement("span");
      const name = roleName(segment.role);
      block.className = "timeline-segment";
      block.style.left = atPercent(segment.start);
      block.style.right = `${(100 * (end - segment.end)) / (end - start)}%`;
      block.style.setProperty("--clock-color", clockColor(segment.role));
      block.toggleAttribute("data-running", segment.running);
      const startLabel = shortTime.format(segment.start);
      const endLabel =
        segment.end === end ? "24:00" : shortTime.format(segment.end);
      block.title = `${name} · ${startLabel}–${endLabel}${segment.running ? " (running)" : ""}`;
      const detail = document.createElement("li");
      detail.textContent = block.title;
      intervalDetails.push(detail);
      if (segment.end - segment.start >= (end - start) / 14)
        block.textContent = name;
      return block;
    });
    $("timeline-segments").replaceChildren(...blocks);
    $("timeline-intervals").replaceChildren(...intervalDetails);

    if (displayedDay !== start) {
      const labelTimes = [0, 6, 12, 18].map((hour) =>
        new Date(start).setHours(hour, 0, 0, 0),
      );
      const ticks = [...labelTimes, end].map((at) => {
        const tick = document.createElement("span");
        tick.className = "timeline-tick";
        tick.style.left = atPercent(at);
        tick.textContent = at === end ? "24:00" : axisTime.format(at);
        return tick;
      });
      $("timeline-ticks").replaceChildren(...ticks);
    }

    const roles = [...new Set(segments.map(({ role }) => role))];
    const legendKey = JSON.stringify(
      roles.map((role) => [role, roleName(role)]),
    );
    if (displayedRoles !== legendKey) {
      displayedRoles = legendKey;
      const items = roles.map((role) => {
        const li = document.createElement("li");
        const key = document.createElement("span");
        key.className = "timeline-key";
        key.style.setProperty("--clock-color", clockColor(role));
        li.append(key, roleName(role));
        return li;
      });
      $("timeline-legend").replaceChildren(...items);
    }

    const markerKey = JSON.stringify([
      start,
      switches.map((point) => [
        point,
        roleName(point.from),
        roleName(point.to),
      ]),
    ]);
    if (displayedMarkers === markerKey) return;
    displayedMarkers = markerKey;
    const focusedId = document.activeElement?.dataset?.switchId;
    markerElements.clear();
    const dots = [];
    const listItems = [];
    for (const point of switches) {
      const direction = `${roleName(point.from)} → ${roleName(point.to)}`;
      const label = `${shortTime.format(point.at)} · ${direction}`;
      const dot = document.createElement("button");
      dot.type = "button";
      dot.tabIndex = -1;
      dot.className = "timeline-dot";
      dot.style.left = atPercent(point.at);
      dot.title = label;
      dot.onclick = () => openSwitch(point);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "timeline-switch-button";
      button.textContent = label;
      button.dataset.switchId = point.fromId;
      button.setAttribute("aria-controls", "switch-editor");
      button.onclick = () => {
        if (saving) return;
        if (sameSwitch(selection?.point, point)) closeEditor({ focus: true });
        else openSwitch(point);
      };
      const li = document.createElement("li");
      li.append(button);
      dots.push(dot);
      listItems.push(li);
      markerElements.set(point.fromId, { button, dot, point });
    }
    switchList.replaceChildren(...listItems);
    $("timeline-dots").replaceChildren(...dots);
    if (focusedId)
      (markerElements.get(focusedId)?.button ?? $("timeline-title")).focus();
    updateSelectedMarkers();
  }

  function refresh(timeline, { now = Date.now(), revealFromId } = {}) {
    latestNow = now;
    const previousDay = displayedDay;
    renderOverview(timeline);
    displayedDay = timeline.start;
    if (displayedDay !== previousDay) showStatus("");
    if (selection) {
      const { point, touched, end } = selection;
      const replacement = markerElements.get(point.fromId)?.point;
      if (displayedDay !== previousDay || !sameSwitch(replacement, point)) {
        const draftChanged = slider.valueAsNumber !== point.at;
        const hadFocus = editor.contains(document.activeElement);
        closeEditor({ focus: hadFocus && !saving });
        if (!saving && draftChanged && displayedDay === previousDay)
          showStatus(
            "This switch changed. Select it again to make an adjustment.",
          );
      } else if (point.end === null && !touched && !saving && latestNow > end) {
        selection.end = latestNow;
        configureEditor(point, selection.end);
      }
    }
    const reveal = markerElements.get(revealFromId)?.point;
    if (reveal?.toId === null && !sameSwitch(selection?.point, reveal))
      openSwitch(reveal, false);
  }

  function touchEditor() {
    selection.touched = true;
    errorMessage.hidden = true;
  }

  function nudge(ms) {
    if (!selection || saving) return;
    touchEditor();
    slider.valueAsNumber = Math.min(
      selection.end,
      Math.max(selection.point.start, slider.valueAsNumber + ms),
    );
    updatePreview();
  }

  slider.onpointerdown = () => {
    if (selection) selection.touched = true;
  };
  slider.oninput = () => {
    if (!selection) return;
    touchEditor();
    updatePreview();
  };
  slider.onkeydown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (
      ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"].includes(event.key)
    ) {
      event.preventDefault();
      nudge(["ArrowLeft", "ArrowDown"].includes(event.key) ? -1000 : 1000);
    }
  };
  earlier.onclick = () => nudge(-60000);
  later.onclick = () => nudge(60000);
  cancelButton.onclick = () => closeEditor({ focus: true });
  editor.onsubmit = async (event) => {
    event.preventDefault();
    if (!selection || saving || slider.valueAsNumber === selection.point.at)
      return;
    const { point } = selection;
    const at = slider.valueAsNumber;
    const day = displayedDay;
    saving = true;
    saveButton.textContent = "Saving…";
    updatePreview();
    try {
      if (!(await save(point, at)))
        throw new Error("Could not save the adjustment. Try again.");
      if (displayedDay !== day) return;
      const stillEditing = selection?.point.fromId === point.fromId;
      const restoreFocus =
        stillEditing || document.activeElement === document.body;
      if (stillEditing) closeEditor();
      if (restoreFocus)
        (
          markerElements.get(point.fromId)?.button ?? $("timeline-title")
        ).focus();
      const time =
        localDate(at) === localDate(day)
          ? shortTime.format(at)
          : datedTime.format(at);
      showStatus(`Switch adjusted to ${time}.`);
    } catch (error) {
      const message =
        error.message || "Could not save the adjustment. Try again.";
      if (displayedDay !== day) return;
      if (editor.hidden) showStatus(message);
      else {
        errorMessage.textContent = message;
        errorMessage.hidden = false;
      }
    } finally {
      saving = false;
      saveButton.textContent = "Save adjustment";
      updatePreview();
    }
  };

  return { refresh };
}
