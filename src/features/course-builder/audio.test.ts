import { expect, it } from "vitest";
import { blockDefaults, blockPayload, blockIssues } from "./blocks";
import { encodeWav } from "./audio";
it("audio edits send only writable metadata and omit forbidden fields", () => {
  const initial = {
    id: 1,
    content_type: "audio",
    media_metadata: {
      title: "Old",
      format: "wav",
      duration_seconds: 4,
      size_bytes: 100,
      original_filename: "note.wav",
    },
  };
  const values = { ...blockDefaults(initial), audio_title: "" };
  expect(blockPayload(values, initial)).toEqual({
    is_published: false,
    media_metadata: { title: null },
  });
  expect(blockPayload(values, {})).toEqual({
    content_type: "audio",
    is_published: false,
    media_metadata: { title: null },
  });
  expect(blockIssues(values)).toEqual({});
  expect(
    blockIssues({ ...values, audio_title: "x".repeat(151) }),
  ).toHaveProperty("audio_title");
});
it("recorded WAV headers carry verifiable duration and clipped PCM samples", () => {
  const buffer = encodeWav(new Float32Array([0, 2, -2]), 48000),
    view = new DataView(buffer);
  expect(new TextDecoder().decode(buffer.slice(0, 4))).toBe("RIFF");
  expect(view.getUint32(24, true)).toBe(48000);
  expect(view.getUint32(40, true)).toBe(6);
  expect(view.getInt16(46, true)).toBe(32767);
  expect(view.getInt16(48, true)).toBe(-32768);
});
