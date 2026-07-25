// Shared types for the rhythm game.

export const LANE_COUNT = 4;

// Default keyboard bindings, one key per lane (0..LANE_COUNT-1).
export const LANE_KEYS = ["d", "f", "j", "k"] as const;

// Lane colors — cosmic glow palette: cyan / magenta / gold / violet.
export const LANE_COLORS = ["#3aa0ff", "#ff4fa3", "#ffc23d", "#9d6bff"] as const;

export type Note = {
  // Seconds from the start of the audio when the note should be struck.
  time: number;
  // Lane index, 0..LANE_COUNT-1.
  lane: number;
};

export type Chart = {
  title: string;
  artist: string;
  // Audio filename this chart was authored against (informational only —
  // the player loads audio from a local file each session).
  audioName: string;
  // Scroll speed multiplier used when authoring (affects note travel time).
  approachSeconds: number;
  notes: Note[];
};

export function emptyChart(): Chart {
  return {
    title: "Untitled",
    artist: "",
    audioName: "",
    approachSeconds: 1.8,
    notes: [],
  };
}

// Normalize / validate a parsed JSON blob into a Chart. Throws on garbage.
export function parseChart(raw: unknown): Chart {
  if (!raw || typeof raw !== "object") throw new Error("Chart is not an object");
  const obj = raw as Record<string, unknown>;
  const notesRaw = obj.notes;
  if (!Array.isArray(notesRaw)) throw new Error("Chart has no notes array");

  const notes: Note[] = [];
  for (const n of notesRaw) {
    if (!n || typeof n !== "object") continue;
    const nn = n as Record<string, unknown>;
    const time = Number(nn.time);
    const lane = Number(nn.lane);
    if (!Number.isFinite(time) || !Number.isInteger(lane)) continue;
    if (lane < 0 || lane >= LANE_COUNT) continue;
    notes.push({ time, lane });
  }
  notes.sort((a, b) => a.time - b.time);

  const approach = Number(obj.approachSeconds);
  return {
    title: typeof obj.title === "string" ? obj.title : "Untitled",
    artist: typeof obj.artist === "string" ? obj.artist : "",
    audioName: typeof obj.audioName === "string" ? obj.audioName : "",
    approachSeconds: Number.isFinite(approach) && approach > 0 ? approach : 1.8,
    notes,
  };
}
