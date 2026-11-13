import axios from "axios";
import { ApiError, object, request, str } from "../../shared/api/client";
export const audioPath = "tutor/content/mini-lesson-blocks";
// MediaRecorder WebM may omit duration metadata. Export microphone recordings as
// PCM WAV so the server can verify duration directly from the file header.
export function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2),
    view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, value < 0 ? value * 32768 : value * 32767, true);
  }
  return buffer;
}
export async function uploadAudio(
  file: File,
  progress: (text: string) => void,
  signal: AbortSignal,
) {
  if (!file.size) throw new ApiError("Choose a non-empty recording.");
  progress("Preparing audio upload…");
  const data = object(
    (
      await request(
        `${audioPath}/audio-uploads`,
        "POST",
        { filename: file.name, size_bytes: file.size },
        signal,
      )
    ).data,
  );
  const url = new URL(str(data.upload_url));
  if (
    url.protocol !== "https:" ||
    data.method !== "PUT" ||
    !str(data.upload_token)
  )
    throw new ApiError("Invalid audio upload authorization.");
  if (file.size > Number(data.max_size_bytes))
    throw new ApiError("The recording exceeds the upload size limit.");
  progress("Uploading audio…");
  await axios.put(url.href, file, {
    headers: object(data.headers) as Record<string, string>,
    signal,
    timeout: 180000,
    onUploadProgress: (e) =>
      progress(
        `Uploading audio… ${e.total ? Math.round((e.loaded / e.total) * 100) : 0}%`,
      ),
  });
  progress("Recording uploaded. Verifying audio…");
  return str(data.upload_token);
}
export const audioTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
