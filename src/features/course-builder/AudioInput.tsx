import { useEffect, useRef, useState } from "react";
import { audioTime, encodeWav } from "./audio";
function LocalPreview({ file }: { file: File }) {
  const element = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (element.current) element.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <audio
      ref={element}
      controls
      preload="metadata"
      aria-label="Unsaved recording preview"
      style={{ width: "100%" }}
    />
  );
}
export function AudioInput({
  file,
  onChange,
  onRecording,
}: {
  file?: File;
  onChange: (file: File | undefined) => void;
  onRecording: (recording: boolean) => void;
}) {
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    mounted = useRef(true);
  const [recording, setRecording] = useState(false),
    [starting, setStarting] = useState(false),
    [seconds, setSeconds] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const began = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - began) / 1000);
      setSeconds(elapsed);
      if (elapsed >= 600 && recorder.current?.state === "recording")
        recorder.current.stop();
    }, 250);
    return () => clearInterval(timer);
  }, [recording]);
  async function record() {
    setStarting(true);
    onRecording(true);
    setError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const mime = ["audio/webm;codecs=opus", "audio/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      if (!mime)
        throw new Error(
          "Recording is not supported in this browser. Upload an MP3, WAV, M4A/AAC or WebM file instead.",
        );
      const current = new MediaRecorder(media, { mimeType: mime });
      recorder.current = current;
      const chunks: Blob[] = [];
      current.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      current.onstop = async () => {
        media.getTracks().forEach((t) => t.stop());
        if (!mounted.current) return;
        setRecording(false);
        setStarting(true);
        let context: AudioContext | undefined;
        try {
          context = new AudioContext();
          const decoded = await context.decodeAudioData(
            await new Blob(chunks, { type: mime }).arrayBuffer(),
          );
          const length = Math.min(
            decoded.length,
            Math.floor(decoded.sampleRate * 600),
          );
          const mono = new Float32Array(length);
          for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
            const samples = decoded.getChannelData(channel);
            for (let i = 0; i < length; i++)
              mono[i] += samples[i] / decoded.numberOfChannels;
          }
          if (mounted.current)
            onChange(
              new File(
                [encodeWav(mono, decoded.sampleRate)],
                "voice-note.wav",
                { type: "audio/wav" },
              ),
            );
        } catch {
          if (mounted.current)
            setError(
              "Could not prepare this recording. Try again or upload an audio file.",
            );
        } finally {
          await context?.close().catch(() => undefined);
          if (mounted.current) {
            setStarting(false);
            onRecording(false);
          }
        }
      };
      current.onerror = () => {
        setError("Recording failed. Try again or choose a file.");
        if (current.state === "recording") current.stop();
      };
      current.start();
      setSeconds(0);
      setRecording(true);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (mounted.current) {
        setError(
          e instanceof Error
            ? e.message
            : "Microphone access failed. Choose a file instead.",
        );
        onRecording(false);
      }
    } finally {
      if (mounted.current) setStarting(false);
    }
  }
  return (
    <section className="audio-input">
      <label>
        Audio file
        <input
          type="file"
          accept=".mp3,.wav,.m4a,.aac,.webm,audio/*"
          disabled={recording || starting}
          onChange={(e) => onChange(e.target.files?.[0])}
        />
      </label>
      <p>
        MP3, WAV, M4A/AAC or WebM/Opus · Up to 10 minutes. Format and duration
        are verified when saved.
      </p>
      <div className="actions">
        <button
          type="button"
          disabled={
            starting ||
            !navigator.mediaDevices?.getUserMedia ||
            typeof MediaRecorder === "undefined"
          }
          onClick={() => (recording ? recorder.current?.stop() : void record())}
        >
          {starting
            ? "Preparing audio…"
            : recording
              ? "Stop recording"
              : "Record audio"}
        </button>
        {recording && (
          <span role="status">Recording {audioTime(seconds)} / 10:00</span>
        )}
        {file && (
          <>
            <span>{file.name}</span>
            <button
              type="button"
              disabled={recording}
              onClick={() => onChange(undefined)}
            >
              Discard recording
            </button>
          </>
        )}
      </div>
      {file && <LocalPreview file={file} />}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
