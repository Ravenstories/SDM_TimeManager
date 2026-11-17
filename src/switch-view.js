import { decimalHours, duration, localDate } from "./domain.js";

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

export function setupSwitchAdjustment({ save, roleName, roleColor }) {
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
  let selection = null;
  let saving = false;
  let displayedMarkers = "";
  let displayedDay = null;
  let displayedRoles = "";
  let displayedAxis = "";
  let latestNow = Date.now();

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

  function renderEditorClocks(point, end) {
    const formatter =
      localDate(point.start) === localDate(end) ? shortTime : datedTime;
    editor.style.setProperty("--switch-from", roleColor(point.from));
    editor.style.setProperty("--switch-to", roleColor(point.to));
    $("switch-direction").textContent =
      `${roleName(point.from)} → ${roleName(point.to)} switch time`;
    $("switch-start").textContent =
      `${roleName(point.from)} · ${formatter.format(point.start)}`;
    $("switch-end").textContent =
      `${roleName(point.to)} · ${formatter.format(end)}${point.end === null ? " (running)" : ""}`;
  }

  function configureEditor(point, end) {
    slider.min = String(point.start);
    slider.max = String(end);
    slider.value = String(point.at);
    renderEditorClocks(point, end);
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

  function renderBalance(segments, workTotal) {
    const timePerClock = new Map();
    let tracked = 0;
    for (const { role, start, end } of segments) {
      const elapsed = end - start;
      tracked += elapsed;
      timePerClock.set(role, (timePerClock.get(role) ?? 0) + elapsed);
    }
    const workSummary =
      Number.isFinite(workTotal) && workTotal !== tracked
        ? ` · ${duration(workTotal)} work`
        : "";
    $("balance-total").hidden = !tracked;
    $("balance-total").textContent = `${duration(tracked)} tracked (${decimalHours(tracked)})${workSummary}`;

    const clocks = [...timePerClock].map(([role, elapsed]) => ({
      name: roleName(role),
      color: roleColor(role),
      elapsed: duration(elapsed),
      percentage: Math.round((100 * elapsed) / tracked),
    }));
    const legendKey = JSON.stringify(clocks);
    if (displayedRoles === legendKey) return;
    displayedRoles = legendKey;
    const items = clocks.map(({ name, color, elapsed, percentage }) => {
      const li = document.createElement("li");
      const key = document.createElement("span");
      key.className = "timeline-key";
      key.style.setProperty("--clock-color", color);
      const amount = document.createElement("span");
      amount.className = "timeline-clock-total";
      const share = document.createElement("b");
      share.textContent = percentage ? `${percentage}%` : "<1%";
      amount.append(share, elapsed);
      li.append(key, name, amount);
      return li;
    });
    $("timeline-legend").replaceChildren(...items);
  }

  function renderOverview({ start, end, segments, switches }, workTotal) {
    const hasActivity = Boolean(segments.length || switches.length);
    $("timeline-empty").hidden = hasActivity;
    $("timeline-overview").hidden = !hasActivity;
    $("timeline-switch-hint").hidden = segments.length <= 1 && !switches.length;
    $("timeline-switch-hint").textContent = switches.length
      ? "Select a dot to adjust a switch. Gaps show untracked time."
      : "Gaps show untracked time.";
    switchList.hidden = !switches.length;
    renderBalance(segments, workTotal);

    // Use the recorded window so a short shift stays legible. Internal gaps
    // still take up their actual share of the timeline.
    const first = Math.min(segments[0]?.start ?? end, switches[0]?.at ?? end);
    const windowEnd = segments.reduce(
      (last, segment) => Math.max(last, segment.end),
      switches.at(-1)?.at ?? first,
    );
    const last = Math.max(first + 1, windowEnd);
    const atPercent = (at) => `${(100 * (at - first)) / (last - first)}%`;

    const intervalDetails = [];
    const blocks = segments.map((segment) => {
      const block = document.createElement("span");
      const name = roleName(segment.role);
      block.className = "timeline-segment";
      block.style.left = atPercent(segment.start);
      block.style.right = `${(100 * (last - segment.end)) / (last - first)}%`;
      block.style.setProperty("--clock-color", roleColor(segment.role));
      block.toggleAttribute("data-running", segment.running);
      const startLabel = shortTime.format(segment.start);
      const endLabel =
        segment.end === end ? "24:00" : shortTime.format(segment.end);
      block.title = `${name} · ${startLabel}–${endLabel}${segment.running ? " (running)" : ""}`;
      const detail = document.createElement("li");
      detail.textContent = block.title;
      intervalDetails.push(detail);
      return block;
    });
    $("timeline-segments").replaceChildren(...blocks);
    $("timeline-intervals").replaceChildren(...intervalDetails);

    const axisKey = `${first}:${last}:${end}`;
    if (displayedAxis !== axisKey) {
      displayedAxis = axisKey;
      const labelTimes = [first];
      if (last - first >= 30 * 60000) labelTimes.push((first + last) / 2);
      labelTimes.push(last);
      const formatter = last - first < 10 * 60000 ? shortTime : axisTime;
      const ticks = labelTimes.map((at) => {
        const tick = document.createElement("span");
        tick.className = "timeline-tick";
        tick.style.left = atPercent(at);
        tick.textContent = at === end ? "24:00" : formatter.format(at);
        return tick;
      });
      $("timeline-ticks").replaceChildren(...ticks);
    }

    const markerKey = JSON.stringify([
      start,
      switches.map((point) => [
        point,
        roleName(point.from),
        roleName(point.to),
      ]),
    ]);
    if (displayedMarkers === markerKey) {
      for (const { dot, point } of markerElements.values()) {
        dot.style.left = atPercent(point.at);
      }
      return;
    }
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

  function refresh(
    timeline,
    { now = Date.now(), revealFromId, workTotal, isToday = true } = {},
  ) {
    latestNow = now;
    const previousDay = displayedDay;
    $("timeline-title").textContent = isToday ? "Today’s balance" : "Day balance";
    renderOverview(timeline, workTotal);
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
      } else {
        renderEditorClocks(point, end);
        updatePreview();
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
