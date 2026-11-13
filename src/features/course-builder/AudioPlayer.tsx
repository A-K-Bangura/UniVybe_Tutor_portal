import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  object,
  request,
  str,
  type RecordData,
} from "../../shared/api/client";
import { ErrorPanel } from "../../shared/ui/primitives";
import { audioPath, audioTime } from "./audio";
export function AudioPlayer({ data }: { data: RecordData }) {
  const audio = useRef<HTMLAudioElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [playing, setPlaying] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  const [position, setPosition] = useState(0),
    [speed, setSpeed] = useState("1");
  const [loaded, setLoaded] = useState(false);
  const metadata = object(data.media_metadata);
  const duration = Number(metadata.duration_seconds) || 0;
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  async function play() {
    const element = audio.current;
    if (!element) return;
    if (!element.paused) {
      element.pause();
      return;
    }
    setBusy(true);
    setError(undefined);
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    try {
      const result = object(
        (
          await request(
            `${audioPath}/${encodeURIComponent(str(data.id))}/audio-url`,
            "GET",
            undefined,
            abort.signal,
          )
        ).data,
      );
      const url = new URL(str(result.playback_url));
      if (url.protocol !== "https:" || url.username || url.password)
        throw new ApiError("Invalid audio playback response.");
      if (abort.signal.aborted) return;
      const offset = element.ended ? 0 : element.currentTime;
      element.onloadedmetadata = () => {
        element.currentTime = offset;
        element.playbackRate = Number(speed);
      };
      element.src = url.href;
      setLoaded(true);
      element.currentTime = offset;
      element.playbackRate = Number(speed);
      await element.play();
    } catch (e) {
      if (!abort.signal.aborted) setError(e);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="audio-block" aria-label="Audio recording">
      <h3>{str(metadata.title) || "Audio recording"}</h3>
      <p className="muted">
        {audioTime(duration)} · {str(metadata.format).toUpperCase()}{" "}
        {metadata.size_bytes
          ? `· ${(Number(metadata.size_bytes) / 1024 / 1024).toFixed(1)} MB`
          : ""}
      </p>
      <audio
        ref={audio}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={() => setPosition(audio.current?.currentTime || 0)}
        onError={() => {
          setPlaying(false);
          setError(
            new ApiError(
              "Playback failed or the link expired. Press Play to request a fresh link.",
            ),
          );
        }}
      />
      <div className="actions">
        <button
          type="button"
          disabled={busy || !data.id}
          onClick={() => void play()}
        >
          {busy ? "Loading audio…" : playing ? "Pause audio" : "Play audio"}
        </button>
        <span>
          {audioTime(position)} / {audioTime(duration)}
        </span>
        <label>
          Playback speed
          <select
            value={speed}
            onChange={(e) => {
              setSpeed(e.target.value);
              if (audio.current)
                audio.current.playbackRate = Number(e.target.value);
            }}
          >
            {["0.75", "1", "1.25", "1.5", "2"].map((rate) => (
              <option key={rate} value={rate}>
                {rate}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Seek audio
        <input
          type="range"
          min="0"
          max={duration}
          step="0.1"
          value={Math.min(position, duration)}
          disabled={!duration || !loaded}
          onChange={(e) => {
            if (audio.current)
              audio.current.currentTime = Number(e.target.value);
            setPosition(Number(e.target.value));
          }}
        />
      </label>
      {!data.id && <p>Save the recording to preview the verified audio.</p>}
      {error !== undefined && <ErrorPanel error={error} />}
    </section>
  );
}
