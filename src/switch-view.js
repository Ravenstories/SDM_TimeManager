import { localDate } from "./domain.js";

const clockTime = new Intl.DateTimeFormat(undefined, {
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

function sameSwitch(first, second) {
  return (
    first?.sessionId === second?.sessionId &&
    first?.from === second?.from &&
    first?.to === second?.to &&
    first?.start === second?.start &&
    first?.at === second?.at
  );
}

function shiftLabel(ms) {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return (
    [hours && hours + "h", minutes && minutes + "m", remaining && remaining + "s"]
      .filter(Boolean)
      .join(" ") || "less than a second"
  );
}

export function setupSwitchAdjustment({ save }) {
  const $ = (id) => document.getElementById(id);
  const section = $("switch-adjustment");
  const toggle = $("switch-toggle");
  const editor = $("switch-editor");
  const slider = $("switch-slider");
  const saveButton = $("switch-save");
  const cancelButton = $("switch-cancel");
  const earlier = $("switch-earlier");
  const later = $("switch-later");
  const status = $("switch-status");
  const errorMessage = $("switch-error");

  let current = null;
  let saving = false;

  function formatTime(at) {
    const includeDate =
      localDate(current.start) !== localDate() || localDate(current.at) !== localDate();
    return (includeDate ? datedTime : clockTime).format(at);
  }

  function proposedTime() {
    const secondsEarlier = Number(slider.max) - slider.valueAsNumber;
    return Math.max(current.start, current.at - secondsEarlier * 1000);
  }

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", String(open));
    editor.hidden = !open;
  }

  function showStatus(message) {
    status.textContent = message;
    status.hidden = !message;
    section.hidden = !current && !message;
  }

  function renderPreview() {
    const at = proposedTime();
    const moved = current.at - at;
    const timeLabel = formatTime(at);
    const transfer = moved
      ? "Move " + shiftLabel(moved) + " from " + current.from.toUpperCase() + " to " + current.to.toUpperCase() + "."
      : "No time moved.";
    $("switch-time").textContent = timeLabel;
    $("switch-transfer").textContent = transfer;
    slider.setAttribute("aria-valuetext", timeLabel + ". " + transfer);
    slider.style.setProperty(
      "--switch-progress",
      (100 * slider.valueAsNumber) / Number(slider.max) + "%",
    );
    slider.disabled = saving;
    cancelButton.disabled = saving;
    earlier.disabled = saving || at === current.start;
    later.disabled = saving || moved === 0;
    saveButton.disabled = saving || moved === 0;
  }

  function refresh(switchPoint, { reveal = false } = {}) {
    const next = switchPoint?.at > switchPoint?.start ? switchPoint : null;
    if (sameSwitch(current, next)) {
      if (next && reveal) setOpen(true);
      return;
    }

    const focusWasInEditor = editor.contains(document.activeElement);
    const discarded =
      !saving && current && !editor.hidden && proposedTime() !== current.at;
    current = next;
    toggle.hidden = !next;
    setOpen(Boolean(next && reveal));
    showStatus(discarded && !reveal ? "The latest switch changed. Your adjustment was cleared." : "");
    errorMessage.hidden = true;

    if (next) {
      const from = next.from.toUpperCase();
      const to = next.to.toUpperCase();
      section.dataset.from = next.from;
      $("switch-direction").textContent = from + " → " + to + " · " + formatTime(next.at);
      $("switch-start").textContent = from + " started · " + formatTime(next.start);
      $("switch-original").textContent = "Recorded switch · " + formatTime(next.at);
      slider.max = String(Math.ceil((next.at - next.start) / 1000));
      slider.value = slider.max;
      renderPreview();
    }

    if (!saving && focusWasInEditor && editor.hidden) (next ? toggle : $("pause")).focus();
  }

  function cancel() {
    slider.value = slider.max;
    errorMessage.hidden = true;
    renderPreview();
    setOpen(false);
    toggle.focus();
  }

  toggle.onclick = () => {
    if (saving) return;
    if (editor.hidden) {
      showStatus("");
      setOpen(true);
    } else {
      cancel();
    }
  };
  cancelButton.onclick = cancel;
  function updatePreview() {
    errorMessage.hidden = true;
    renderPreview();
  }

  function nudge(seconds) {
    slider.valueAsNumber = Math.min(
      Number(slider.max),
      Math.max(0, slider.valueAsNumber + seconds),
    );
    updatePreview();
  }

  slider.oninput = updatePreview;
  earlier.onclick = () => nudge(-60);
  later.onclick = () => nudge(60);
  editor.onsubmit = async (event) => {
    event.preventDefault();
    if (saving || !current || proposedTime() === current.at) return;
    const expected = current;
    const at = proposedTime();
    const timeLabel = formatTime(at);
    saving = true;
    saveButton.textContent = "Saving…";
    renderPreview();

    try {
      if (!(await save(expected, at))) throw new Error("Could not save the adjustment. Try again.");
      if (current && current.sessionId !== expected.sessionId) return;
      setOpen(false);
      showStatus("Switch adjusted to " + timeLabel + ".");
      if (current) toggle.focus();
    } catch (error) {
      const message = error.message || "Could not save the adjustment. Try again.";
      if (editor.hidden) showStatus(message);
      else {
        errorMessage.textContent = message;
        errorMessage.hidden = false;
      }
    } finally {
      saving = false;
      saveButton.textContent = "Save adjustment";
      if (current) renderPreview();
    }
  };

  return { refresh };
}
