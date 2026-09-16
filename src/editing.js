export function assertUnchanged(current, original) {
  if (JSON.stringify(current) !== JSON.stringify(original))
    throw new Error("This record changed in another window. Reload the record or cancel this edit.");
}

export function localInputValue(timestamp) {
  return new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60000)
    .toISOString().slice(0, 23);
}

export function inputTimestamp(value, original) {
  // Keep the original instant on unchanged fields, including DST's repeated hour.
  return original !== undefined && value === localInputValue(original)
    ? original : new Date(value).getTime();
}
