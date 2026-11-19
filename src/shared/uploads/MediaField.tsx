import { useRef, useState, useEffect } from "react";
import { uploadMedia } from "./workflows";
import { ErrorPanel } from "../ui/primitives";
export function MediaField({
  purpose,
  onComplete,
  label,
  accept,
  onUploadingChange,
}: {
  purpose: string;
  onComplete: (url: string) => void;
  label?: string;
  accept?: string;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [stage, setStage] = useState(""),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    onUploadingChange?.(busy);
  }, [busy, onUploadingChange]);
  return (
    <div className="media-upload">
      <label>
        {label || `Upload ${purpose === "thumbnail" ? "cover image" : "media"}`}
        <input
          type="file"
          disabled={busy}
          accept={
            accept ||
            (purpose === "thumbnail"
              ? "image/jpeg,image/png"
              : purpose === "feed_media"
                ? "image/jpeg,image/png,image/gif"
                : "image/*,video/mp4,video/quicktime")
          }
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            e.target.value = "";
            setStage("");
            if (accept && !accept.split(",").includes(file.type)) {
              setError(new Error("Choose a supported image file."));
              return;
            }
            setBusy(true);
            setError(undefined);
            controller.current = new AbortController();
            try {
              const result = await uploadMedia(
                file,
                purpose,
                setStage,
                controller.current.signal,
              );
              onComplete(result.url);
            } catch (err) {
              setError(err);
              setStage("Upload incomplete. Your editor values are retained.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <span role="status">{stage}</span>
      {busy && (
        <button type="button" onClick={() => controller.current?.abort()}>
          Cancel upload
        </button>
      )}
      {error !== undefined && <ErrorPanel error={error} />}
    </div>
  );
}
