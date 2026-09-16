export function assertUnchanged(current, original) {
  if (JSON.stringify(current) !== JSON.stringify(original))
    throw new Error(
      "This record changed in another window. Reload the record or cancel this edit.",
    );
}

export function localInputValue(timestamp) {
  return new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 23);
}

export function inputTimestamp(value, original) {
  // Keep the original instant on unchanged fields, including DST's repeated hour.
  const canonical = (text) => {
    const match =
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
        text,
      );
    return match
      ? match[1] +
          ":" +
          (match[2] || "00") +
          "." +
          (match[3] || "").padEnd(3, "0")
      : null;
  };
  if (
    original !== undefined &&
    canonical(value) === canonical(localInputValue(original))
  )
    return original;
  const timestamp = new Date(value).getTime();
  if (
    !Number.isFinite(timestamp) ||
    canonical(value) !== canonical(localInputValue(timestamp))
  )
    throw new Error(
      "Choose a valid local date and time. This time may not exist at a daylight-saving transition.",
    );
  return timestamp;
}
