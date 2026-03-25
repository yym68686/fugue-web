export type AnsiNamedTone =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "bright-black"
  | "bright-red"
  | "bright-green"
  | "bright-yellow"
  | "bright-blue"
  | "bright-magenta"
  | "bright-cyan"
  | "bright-white";

export type AnsiTextSegment = {
  bold: boolean;
  color: string | null;
  dim: boolean;
  italic: boolean;
  text: string;
  tone: AnsiNamedTone | null;
  underline: boolean;
};

type AnsiState = Omit<AnsiTextSegment, "text">;

const ANSI_SGR_PATTERN = /\u001b\[([0-9;]*)m/g;
const ANSI_OSC_PATTERN = /\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g;
const ANSI_CONTROL_PATTERN = /\u001b(?:\[[0-9;?]*[ -/]*[@-~]|[@-_])/g;
const ANSI_BASE_TONES = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
] as const satisfies readonly AnsiNamedTone[];

function createAnsiState(): AnsiState {
  return {
    bold: false,
    color: null,
    dim: false,
    italic: false,
    tone: null,
    underline: false,
  };
}

function cloneAnsiState(state: AnsiState): AnsiState {
  return { ...state };
}

function stripUnsupportedAnsi(value: string) {
  return value
    .replace(ANSI_OSC_PATTERN, "")
    .replace(ANSI_CONTROL_PATTERN, "");
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeAnsiInput(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r(?!\n)/g, "\n");
}

function readNamedTone(value: number): AnsiNamedTone | null {
  if (value >= 0 && value <= 7) {
    return ANSI_BASE_TONES[value];
  }

  if (value >= 8 && value <= 15) {
    return `bright-${ANSI_BASE_TONES[value - 8]}` as AnsiNamedTone;
  }

  return null;
}

function readAnsi256Color(value: number) {
  const normalized = Math.max(0, Math.min(255, Math.floor(value)));

  if (normalized >= 16 && normalized <= 231) {
    const offset = normalized - 16;
    const channel = [0, 95, 135, 175, 215, 255];
    const red = channel[Math.floor(offset / 36)];
    const green = channel[Math.floor((offset % 36) / 6)];
    const blue = channel[offset % 6];
    return `rgb(${red} ${green} ${blue})`;
  }

  if (normalized >= 232) {
    const shade = 8 + (normalized - 232) * 10;
    return `rgb(${shade} ${shade} ${shade})`;
  }

  return null;
}

function applyForeground(state: AnsiState, code: number) {
  if (code >= 30 && code <= 37) {
    state.tone = ANSI_BASE_TONES[code - 30];
    state.color = null;
    return;
  }

  if (code >= 90 && code <= 97) {
    state.tone = `bright-${ANSI_BASE_TONES[code - 90]}` as AnsiNamedTone;
    state.color = null;
  }
}

function parseCodes(raw: string) {
  if (!raw) {
    return [0];
  }

  const codes = raw
    .split(";")
    .map((part) => (part === "" ? 0 : Number(part)))
    .filter((part) => Number.isFinite(part));

  return codes.length ? codes : [0];
}

function applySgrCodes(state: AnsiState, raw: string) {
  const codes = parseCodes(raw);

  for (let index = 0; index < codes.length; index += 1) {
    const code = codes[index];

    switch (code) {
      case 0:
        Object.assign(state, createAnsiState());
        break;
      case 1:
        state.bold = true;
        state.dim = false;
        break;
      case 2:
        state.dim = true;
        break;
      case 3:
        state.italic = true;
        break;
      case 4:
        state.underline = true;
        break;
      case 21:
      case 22:
        state.bold = false;
        state.dim = false;
        break;
      case 23:
        state.italic = false;
        break;
      case 24:
        state.underline = false;
        break;
      case 39:
        state.tone = null;
        state.color = null;
        break;
      case 38: {
        const mode = codes[index + 1];

        if (mode === 5 && typeof codes[index + 2] === "number") {
          const value = codes[index + 2];
          const tone = readNamedTone(value);

          state.tone = tone;
          state.color = tone ? null : readAnsi256Color(value);
          index += 2;
        } else if (
          mode === 2 &&
          typeof codes[index + 2] === "number" &&
          typeof codes[index + 3] === "number" &&
          typeof codes[index + 4] === "number"
        ) {
          const red = clampByte(codes[index + 2]);
          const green = clampByte(codes[index + 3]);
          const blue = clampByte(codes[index + 4]);

          state.tone = null;
          state.color = `rgb(${red} ${green} ${blue})`;
          index += 4;
        }
        break;
      }
      default:
        applyForeground(state, code);
        break;
    }
  }
}

function pushSegment(segments: AnsiTextSegment[], text: string, state: AnsiState) {
  const cleaned = stripUnsupportedAnsi(text);

  if (!cleaned) {
    return;
  }

  segments.push({
    ...cloneAnsiState(state),
    text: cleaned,
  });
}

export function parseAnsiText(value: string) {
  const source = normalizeAnsiInput(value);
  const segments: AnsiTextSegment[] = [];
  const state = createAnsiState();
  let lastIndex = 0;

  ANSI_SGR_PATTERN.lastIndex = 0;

  for (let match = ANSI_SGR_PATTERN.exec(source); match; match = ANSI_SGR_PATTERN.exec(source)) {
    const matchIndex = match.index ?? 0;

    pushSegment(segments, source.slice(lastIndex, matchIndex), state);
    applySgrCodes(state, match[1] ?? "");
    lastIndex = matchIndex + match[0].length;
  }

  pushSegment(segments, source.slice(lastIndex), state);

  if (segments.length > 0) {
    return segments;
  }

  const plain = stripUnsupportedAnsi(source);

  return plain
    ? [
        {
          ...createAnsiState(),
          text: plain,
        },
      ]
    : [];
}
