import { saveNote, removeNote, localDate, responsibility } from "./domain.js";
import { localInputValue, inputTimestamp } from "./editing.js";
import { $, el, button, roleOptions, dateTime, errorAt } from "./ui.js";
import { lockForm } from "./ui.js";
export function setupNotes(ctx) {
  let original = null,
    initialized = false,
    dateChosen = false;
  let saving = false;
  const dirty = () => Boolean(original || $("note").value);
  const snapshot = () => ({
    original,
    text: $("note").value,
    responsibilityId: $("note-role").value,
    at: $("note-at").value,
  });
  function persist() {
    $("note-count").textContent = $("note").value.length + " / 5000";
    $("note-date-hint").textContent =
      "This note will be saved to " +
      ($("note-at").value
        ? dateTime(new Date($("note-at").value).getTime())
        : "the chosen date") +
      ".";
    ctx.prefs.set("note-draft-v2", dirty() ? JSON.stringify(snapshot()) : null);
  }
  function defaults() {
    const day = ctx.getDay();
    $("note-at").value = localInputValue(
      day === localDate()
        ? Math.floor(Date.now() / 60000) * 60000
        : new Date(day + "T12:00:00").getTime(),
    );
    dateChosen = false;
    if (ctx.getState().active)
      $("note-role").value = ctx.getState().active.responsibilityId;
    persist();
  }
  function reset() {
    original = null;
    $("note").value = "";
    $("save-note").textContent = "Add note";
    $("cancel-note").textContent = "Clear draft";
    $("reload-note").hidden = true;
    errorAt("note-error", null);
    defaults();
    ctx.prefs.set("draft", null);
  }
  function edit(n, force = false) {
    if (saving) return;
    if (!force && dirty() && !confirm("Discard the current note draft?"))
      return;
    original = structuredClone(n);
    $("note").value = n.text;
    $("note-role").value = n.responsibilityId;
    $("note-at").value = localInputValue(n.at);
    $("save-note").textContent = "Save note";
    $("cancel-note").textContent = "Cancel edit";
    $("reload-note").hidden = true;
    errorAt("note-error", null);
    persist();
    $("note").focus();
  }
  function render() {
    const s = ctx.getState();
    if (!s) return;
    roleOptions($("note-role"), s);
    if (!initialized) {
      initialized = true;
      const saved = ctx.prefs.get("note-draft-v2");
      defaults();
      try {
        if (saved) {
          const d = JSON.parse(saved);
          original = d.original || null;
          $("note").value = d.text || "";
          $("note-role").value = d.responsibilityId;
          $("note-at").value = d.at;
          $("save-note").textContent = original ? "Save note" : "Add note";
        } else $("note").value = ctx.prefs.get("draft", "");
      } catch {
        ctx.warn(
          "A saved note draft could not be read. Your recorded notes are unchanged.",
        );
      }
      persist();
    }
    $("notes").replaceChildren();
    const notes = s.notes
      .filter((n) => localDate(n.at) === ctx.getDay())
      .sort((a, b) => a.at - b.at);
    if (!notes.length)
      $("notes").append(el("p", "No notes saved for this day.", "empty"));
    for (const n of notes) {
      const row = el("article", undefined, "note-row"),
        actions = el("div", undefined, "actions");
      row.append(
        el("strong", responsibility(s, n.responsibilityId).name),
        el("small", dateTime(n.at)),
        el("p", n.text),
      );
      actions.append(
        button("Edit", () => edit(n), "Edit note: " + n.text.slice(0, 40)),
        button(
          "Delete",
          async () => {
            if (confirm("Delete this note?"))
              await ctx.change(
                (current) => removeNote(current, n),
                "Note deleted",
                "note-error",
              );
          },
          "Delete note: " + n.text.slice(0, 40),
        ),
      );
      row.append(actions);
      $("notes").append(row);
    }
  }
  $("note-form").onsubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    saving = true;
    const unlock = lockForm($("note-form"));
    try {
      const expected = original;
      const note = {
        id: expected?.id || crypto.randomUUID(),
        text: $("note").value,
        responsibilityId: $("note-role").value,
        at: inputTimestamp($("note-at").value, expected?.at),
      };
      if (
        await ctx.change(
          (s) => saveNote(s, note, expected),
          "Note saved",
          "note-error",
        )
      ) {
        reset();
        ctx.showDay(localDate(note.at));
      } else $("reload-note").hidden = !original;
    } catch (error) {
      errorAt("note-error", error);
    } finally {
      saving = false;
      unlock();
    }
  };
  $("cancel-note").onclick = () => {
    if (!dirty() || confirm("Discard this unfinished note?")) reset();
  };
  $("reload-note").onclick = () => {
    const latest = ctx.getState().notes.find((n) => n.id === original?.id);
    if (!confirm("Discard your edits and reload the record?")) return;
    if (latest) edit(latest, true);
    else reset();
  };
  for (const id of ["note", "note-role", "note-at"])
    $(id).addEventListener("input", persist);
  $("note-at").addEventListener("input", () => {
    dateChosen = true;
  });
  $("note").addEventListener("focus", () => {
    if (!dirty() && !dateChosen) defaults();
  });
  return {
    render,
    hasDrafts: dirty,
    dayChanged: () => {
      if (!dirty()) defaults();
    },
  };
}
