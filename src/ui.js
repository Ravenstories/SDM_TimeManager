export const $ = id => document.getElementById(id);
export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function button(text, action, label) {
  const node = el("button", text);
  node.type = "button";
  if (label) node.setAttribute("aria-label", label);
  node.onclick = action;
  return node;
}
export function errorAt(id, error) {
  $(id).hidden = !error; $(id).textContent = error?.message || error || "";
}
export function roleOptions(select, state, {archived = true, all = false} = {}) {
  const old = select.value;
  select.replaceChildren();
  if (all) select.append(new Option("All responsibilities",""));
  for (const r of state.responsibilities.filter(r => archived || !r.archived)) {
    const option = new Option(r.name + (r.archived ? " (archived)" : ""), r.id);
    select.append(option);
  }
  if ([...select.options].some(o => o.value === old)) select.value = old;
}
export const dateTime = t => new Date(t).toLocaleString([], {year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"});

