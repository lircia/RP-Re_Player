import * as Mediabunny from "mediabunny-base";
import { Decoder as EbmlDecoder } from "ebml/lib/ebml.esm.js";

export * from "mediabunny-base";

type SubtitleCue = {
  timestamp: number;
  duration: number;
  text: string;
  settings?: string;
};

function webVttTime(seconds: number) {
  const milliseconds = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const rest = milliseconds % 60_000;
  const wholeSeconds = Math.floor(rest / 1000);
  const millis = rest % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function formatCuesToWebVTT(cues: SubtitleCue[]) {
  return `WEBVTT\n\n${cues.map((cue, index) => {
    const start = webVttTime(cue.timestamp);
    const end = webVttTime(cue.timestamp + Math.max(0, cue.duration));
    const settings = cue.settings ? ` ${cue.settings}` : "";
    return `${index + 1}\n${start} --> ${end}${settings}\n${cue.text}`;
  }).join("\n\n")}\n`;
}

/**
 * `playsvideo` currently follows the mediabunny integration branch.  The
 * published mediabunny package does not expose subtitle tracks yet, while
 * the rest of the application still needs the published package for its
 * normal media demuxing API.  Add the small integration surface that
 * playsvideo needs without pretending that a stable Input has subtitle
 * tracks of its own.
 *
 * This is deliberately limited to Matroska/WebM files.  Other formats return
 * an empty list and continue through the normal playsvideo path unchanged.
 */

type CompatSubtitleCue = {
  timestamp: number;
  duration: number;
  text: string;
  settings?: string;
  assFields?: string;
  layer?: string;
};

type CompatSubtitleTrack = {
  codec: string;
  languageCode: string;
  name: string | null;
  disposition: {
    default: boolean;
    primary: boolean;
    forced: boolean;
    original: boolean;
    commentary: boolean;
    hearingImpaired: boolean;
    visuallyImpaired: boolean;
  };
  getCues(): AsyncIterable<CompatSubtitleCue>;
  exportToText(): Promise<string>;
};

type EbmlTag = {
  name?: string;
  value?: unknown;
  data?: unknown;
  track?: unknown;
  payload?: unknown;
};

type ParsedMatroskaTrack = {
  number: number;
  type: number;
  codec: string;
  privateData: string;
  name: string;
  language: string;
  default: boolean;
  forced: boolean;
  hearingImpaired: boolean;
};

type ParsedMatroskaCue = {
  track: number;
  timestamp: number;
  duration: number;
  payload: string;
};

type InputWithSource = {
  source: {
    getSize(): Promise<number>;
    _read(start: number, end: number, minReadPosition: number, maxReadPosition: number):
      Promise<{ bytes: Uint8Array; offset: number } | null> | { bytes: Uint8Array; offset: number } | null;
  };
};

const subtitleTrackCache = new WeakMap<object, Promise<CompatSubtitleTrack[]>>();

function installSourceApiBridge() {
  type SourcePrototype = {
    _getFileSize?: () => number | null | undefined | Promise<number | null>;
  };
  const sourcePrototype = (Mediabunny.Source as unknown as { prototype: SourcePrototype }).prototype;
  if (sourcePrototype._getFileSize) return;

  // `playsvideo`'s custom Source API calls this method `_retrieveSize`, while
  // the published mediabunny API calls it `_getFileSize`.  UrlSource and
  // BlobSource already implement the latter; this bridge only affects source
  // adapters supplied by playsvideo.
  sourcePrototype._getFileSize = function(this: SourcePrototype) {
    const retrieveSize = (this as SourcePrototype & {
      _retrieveSize?: () => number | null | undefined | Promise<number | null>;
    })._retrieveSize;
    return typeof retrieveSize === "function" ? retrieveSize.call(this) : undefined;
  };
}

function ebmlText(value: unknown) {
  if (typeof value === "string") return value;
  if (value instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(value));
  if (ArrayBuffer.isView(value)) {
    return new TextDecoder().decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }
  return value && typeof (value as { toString?: () => string }).toString === "function"
    ? (value as { toString: () => string }).toString()
    : "";
}

function subtitleCodec(codec: string) {
  const normalized = codec.trim().toUpperCase();
  if (normalized === "S_TEXT/ASS") return "ass";
  if (normalized === "S_TEXT/SSA") return "ssa";
  if (normalized === "S_TEXT/UTF8") return "subrip";
  if (normalized === "S_TEXT/WEBVTT") return "webvtt";
  return normalized.toLowerCase() || "unknown";
}

function assTimestamp(seconds: number) {
  const centiseconds = Math.max(0, Math.floor((Number(seconds) || 0) * 100));
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const rest = Math.floor((centiseconds % 6000) / 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
}

function isEbml(bytes: Uint8Array) {
  return bytes.length >= 4
    && bytes[0] === 0x1a
    && bytes[1] === 0x45
    && bytes[2] === 0xdf
    && bytes[3] === 0xa3;
}

function bytesForRange(result: { bytes: Uint8Array; offset: number }, start: number, end: number) {
  const localStart = start - result.offset;
  const length = end - start;
  if (localStart < 0 || localStart + length > result.bytes.byteLength) return null;
  return result.bytes.subarray(localStart, localStart + length);
}

async function readSourceBytes(source: InputWithSource["source"]): Promise<CompatSubtitleTrack[]> {
  const size = await source.getSize();
  if (!Number.isFinite(size) || size <= 0) return [];

  const first = await source._read(0, Math.min(size, 4), 0, Math.min(size, 4));
  const firstBytes = first && bytesForRange(first, 0, Math.min(size, 4));
  if (!firstBytes || !isEbml(firstBytes)) return [];

  // The integration branch reads the subtitle samples after demuxing.  Keep
  // the compatibility implementation simple and deterministic by feeding the
  // EBML decoder sequential chunks. This avoids creating a second fetch and
  // also works for UrlSource instances without HTTP range support.
  const decoder = new EbmlDecoder();
  const tracks = new Map<number, ParsedMatroskaTrack>();
  const cues: ParsedMatroskaCue[] = [];
  const decoderErrors: unknown[] = [];
  let timecodeScale = 1_000_000;
  let clusterTimecode = 0;
  let currentTrack: Partial<ParsedMatroskaTrack> | null = null;
  let pendingBlock: { track: number; relative: number; payload: string; duration?: number } | null = null;

  decoder.on("error", (error: unknown) => decoderErrors.push(error));
  decoder.on("data", (entry: [string, EbmlTag]) => {
    const [kind, tag] = entry;
    const name = tag.name || "";

    if (name === "TrackEntry" && kind === "start") {
      currentTrack = {};
      return;
    }

    if (currentTrack) {
      if (name === "TrackNumber") currentTrack.number = Number(tag.value);
      else if (name === "TrackType") currentTrack.type = Number(tag.value);
      else if (name === "CodecID") currentTrack.codec = ebmlText(tag.value);
      else if (name === "CodecPrivate") currentTrack.privateData = ebmlText(tag.data ?? tag.value);
      else if (name === "Name") currentTrack.name = ebmlText(tag.value);
      else if (name === "Language" || name === "LanguageIETF") currentTrack.language = ebmlText(tag.value);
      else if (name === "FlagDefault") currentTrack.default = Boolean(tag.value);
      else if (name === "FlagForced") currentTrack.forced = Boolean(tag.value);
      else if (name === "FlagHearingImpaired") currentTrack.hearingImpaired = Boolean(tag.value);

      if (name === "TrackEntry" && kind === "end" && currentTrack.number) {
        tracks.set(currentTrack.number, {
          number: currentTrack.number,
          type: currentTrack.type || 0,
          codec: currentTrack.codec || "",
          privateData: currentTrack.privateData || "",
          name: currentTrack.name || "",
          language: currentTrack.language || "und",
          default: currentTrack.default !== false,
          forced: currentTrack.forced === true,
          hearingImpaired: currentTrack.hearingImpaired === true
        });
        currentTrack = null;
      }
      return;
    }

    if (name === "TimecodeScale") timecodeScale = Number(tag.value) || timecodeScale;
    else if (name === "Timecode") clusterTimecode = Number(tag.value) || 0;
    else if ((name === "Block" || name === "SimpleBlock") && kind === "tag") {
      pendingBlock = {
        track: Number(tag.track),
        relative: Number(tag.value) || 0,
        payload: ebmlText(tag.payload ?? tag.data)
      };
      if (name === "SimpleBlock") {
        cues.push({
          track: pendingBlock.track,
          timestamp: (clusterTimecode + pendingBlock.relative) * timecodeScale / 1_000_000,
          duration: 0,
          payload: pendingBlock.payload
        });
        pendingBlock = null;
      }
    } else if (name === "BlockDuration" && pendingBlock) {
      pendingBlock.duration = Number(tag.value) || 0;
    } else if (name === "BlockGroup" && kind === "end" && pendingBlock) {
      cues.push({
        track: pendingBlock.track,
        timestamp: (clusterTimecode + pendingBlock.relative) * timecodeScale / 1_000_000,
        duration: (pendingBlock.duration || 0) * timecodeScale / 1_000_000,
        payload: pendingBlock.payload
      });
      pendingBlock = null;
    }
  });

  const chunkSize = 8 * 1024 * 1024;
  for (let start = 0; start < size; start += chunkSize) {
    const end = Math.min(size, start + chunkSize);
    const result = await source._read(start, end, start, end);
    if (!result) return [];
    const bytes = bytesForRange(result, start, end);
    if (!bytes) return [];
    decoder.write(bytes);
  }
  decoder.end();
  if (decoderErrors.length > 0) throw decoderErrors[0];

  const subtitleTracks = [...tracks.values()].filter(track => track.type === 17 && track.codec);
  return subtitleTracks.map((track): CompatSubtitleTrack => {
    const trackCues = cues
      .filter(cue => cue.track === track.number)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((cue, index, all) => {
        const nextTimestamp = all[index + 1]?.timestamp;
        const duration = cue.duration > 0
          ? cue.duration
          : Math.max(0.1, (nextTimestamp ?? cue.timestamp + 3) - cue.timestamp);
        const codec = subtitleCodec(track.codec);
        let text = cue.payload;
        let assFields: string | undefined;
        let layer: string | undefined;
        if (codec === "ass" || codec === "ssa") {
          const fields = cue.payload.replace(/^Dialogue:\s*/i, "").split(",");
          // Matroska's S_TEXT/ASS payload starts with ReadOrder and Layer;
          // timing is supplied by the Matroska block itself.
          if (fields.length >= 9) {
            layer = fields[1] || "0";
            assFields = fields.slice(2).join(",");
            text = fields.slice(8).join(",");
          }
        }
        return { timestamp: cue.timestamp, duration, text, assFields, layer };
      });
    const codec = subtitleCodec(track.codec);
    const header = track.privateData.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trimEnd();
    const exportedEvents = trackCues.map(cue => {
      if (codec !== "ass" && codec !== "ssa") return "";
      return `Dialogue: ${cue.layer || "0"},${assTimestamp(cue.timestamp)},${assTimestamp(cue.timestamp + cue.duration)},${cue.assFields || `Default,,0,0,0,,${cue.text}`}`;
    }).filter(Boolean);
    return {
      codec,
      languageCode: track.language || "und",
      name: track.name || null,
      disposition: {
        default: track.default,
        primary: track.default,
        forced: track.forced,
        original: false,
        commentary: false,
        hearingImpaired: track.hearingImpaired,
        visuallyImpaired: false
      },
      async *getCues() {
        yield* trackCues;
      },
      async exportToText() {
        if (codec !== "ass" && codec !== "ssa") return header;
        const script = header.replace(/\n\[Events\][\s\S]*$/i, "").trimEnd();
        return `${script}\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${exportedEvents.join("\n")}`;
      }
    };
  });
}

function installSubtitleTrackApi() {
  const Input = Mediabunny.Input as typeof Mediabunny.Input & {
    prototype: { getSubtitleTracks?: () => Promise<CompatSubtitleTrack[]> };
  };
  if (typeof Input.prototype.getSubtitleTracks === "function") return;
  const getSubtitleTracks = function(this: InputWithSource): Promise<CompatSubtitleTrack[]> {
    const input = this as unknown as object;
    let result = subtitleTrackCache.get(input);
    if (!result) {
      result = readSourceBytes(this.source).catch(() => []);
      subtitleTrackCache.set(input, result);
    }
    return result;
  };
  Input.prototype.getSubtitleTracks = getSubtitleTracks;
}

installSourceApiBridge();
installSubtitleTrackApi();
