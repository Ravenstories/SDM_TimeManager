export const v2State = () => ({
  version: 2,
  responsibilities: [
    { id: "vd", name: "VD", classification: "work", archived: false },
    { id: "sit", name: "SIT", classification: "work", archived: false },
    {
      id: "custom_lunch",
      name: "Frokost",
      classification: "nonwork",
      archived: false,
    },
    { id: "old", name: "Old task", classification: "work", archived: true },
    {
      id: "unknown",
      name: "Unclassified",
      classification: "unresolved",
      archived: false,
    },
  ],
  active: { id: "running", responsibilityId: "custom_lunch", start: 300 },
  sessions: [
    { id: "completed", responsibilityId: "old", start: 100, end: 200 },
  ],
  notes: [
    { id: "note", responsibilityId: "custom_lunch", at: 300, text: "Context" },
  ],
  preferences: { timeFormat: "decimal", compact: true },
});
