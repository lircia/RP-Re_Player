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
