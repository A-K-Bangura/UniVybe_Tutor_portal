import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useBlocker } from "react-router-dom";
import {
  blockDefaults,
  blockIssues,
  blockLink,
  blockPayload,
  blockTypes,
  textTypes,
  type BlockValues,
} from "./blocks";
import { Block } from "./Preview";
import {
  ApiError,
  entity,
  request,
  object,
  problem,
  str,
  type RecordData,
} from "../../shared/api/client";
import { AudioInput } from "./AudioInput";
import { AudioPlayer } from "./AudioPlayer";
import { audioPath, uploadAudio } from "./audio";
import { DataView, ErrorPanel, Modal } from "../../shared/ui/primitives";
import { MediaField } from "../../shared/uploads/MediaField";
import { LessonRichText } from "./LessonRichText";
import { hasHtml, lessonText, richTextTypes } from "./richText";

export function BlockForm({
  initial,
  submit,
  onDirty,
  checkLatest,
  onLoaded,
}: {
  initial: RecordData;
  submit: (values: RecordData) => Promise<void>;
  onDirty: (dirty: boolean) => void;
  checkLatest: () => Promise<RecordData[]>;
  onLoaded: (record: RecordData) => void;
}) {
  const form = useForm<BlockValues>({ defaultValues: blockDefaults(initial) });
  const live = useWatch({ control: form.control }) as BlockValues;
  const { isDirty, isSubmitting, errors } = form.formState;
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [checking, setChecking] = useState(false);
  const [latest, setLatest] = useState<RecordData>();
  const [checked, setChecked] = useState("");
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [audioFile, setAudioFile] = useState<File>();
  const [recording, setRecording] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [progress, setProgress] = useState("");
  const [pendingType, setPendingType] = useState("");
  const [richBackup, setRichBackup] = useState("");
  const dirty = isDirty || recording || !!audioFile;
  const blocker = useBlocker(dirty && !isSubmitting && !replacing);
  useEffect(() => {
    onDirty(dirty);
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      onDirty(false);
    };
  }, [dirty, onDirty]);
  const save = form.handleSubmit(async (values) => {
    if (
      uncertain ||
      recording ||
      replacing ||
      (initial.id && values.content_type === "audio" && audioFile)
    )
      return;
    form.clearErrors();
    const issues = blockIssues(values);
    if (Object.keys(issues).length) {
      if (issues.media_metadata) setMetadataOpen(true);
      for (const [field, messages] of Object.entries(issues))
        form.setError(field as keyof BlockValues, {
          message: messages.join(" "),
        });
      return;
    }
    setError(undefined);
    setSaved(false);
    let commitAttempted = false;
    try {
      const payload = blockPayload(values, initial);
      if (values.content_type === "audio" && !initial.id) {
        if (!audioFile)
          throw new ApiError("Choose or record an audio file before saving.");
        payload.upload_token = await uploadAudio(
          audioFile,
          setProgress,
          new AbortController().signal,
        );
      }
      commitAttempted = true;
      await submit(payload);
      setAudioFile(undefined);
      setProgress("");
      form.reset(values);
      setSaved(true);
      if (blocker.state === "blocked") blocker.proceed();
    } catch (err) {
      setProgress("");
      setError(err);
      if (problem(err).fields.media_metadata) setMetadataOpen(true);
      if (commitAttempted && problem(err).uncertain) setUncertain(true);
      for (const [field, messages] of Object.entries(problem(err).fields))
        form.setError(
          (field === "media_metadata.label"
            ? "link_label"
            : field) as keyof BlockValues,
          { message: messages.join(" ") },
        );
    }
  });
  const text = live.content_type === "text",
    audio = live.content_type === "audio",
    link = text && live.text_type === "link",
    prompt = text && live.text_type === "prompt";
  const destination = link ? blockLink(live.content || "") : undefined;
  function fieldError(name: keyof BlockValues) {
    return (
      errors[name] && (
        <small className="field-error" role="alert">
          {str(errors[name]?.message)}
        </small>
      )
    );
  }
  async function checkCurrent() {
    setChecking(true);
    setLatest(undefined);
    setChecked("");
    try {
      const records = await checkLatest();
      if (!initial.id)
        setChecked(
          "Saved blocks have been refreshed in the outline. Review them before creating another block; this draft remains locked to prevent duplicates.",
        );
      else {
        const record = records.find(
          (record) => str(record.id) === str(initial.id),
        );
        if (record) {
          setLatest(record);
          setChecked(
            "Review the saved block below. Loading it replaces your retained draft.",
          );
        } else
          setChecked(
            "This block is no longer in the mini-lesson. Your draft is retained.",
          );
      }
    } catch (err) {
      setError(err);
    } finally {
      setChecking(false);
    }
  }
  return (
    <>
      <form className="editor-form block-form" onSubmit={save} noValidate>
        {error !== undefined && <ErrorPanel error={error} />}
        {Object.keys(errors).length > 0 && (
          <p className="field-error" role="alert">
            Check the highlighted fields before saving.
          </p>
        )}
        {Object.entries(problem(error).fields).length > 0 && (
          <ul className="field-error" role="alert">
            {Object.entries(problem(error).fields).map(([field, messages]) => (
              <li key={field}>
                {field}: {messages.join(" ")}
              </li>
            ))}
          </ul>
        )}
        {uncertain && (
          <section className="notice">
            <p>
              The save outcome is uncertain. Your draft is kept and saving is
              blocked until the saved version is reviewed.
            </p>
            <button
              type="button"
              disabled={checking}
              onClick={() => void checkCurrent()}
            >
              Check saved blocks
            </button>
            {checked && <p role="status">{checked}</p>}
            {latest && (
              <>
                <Block data={latest} />
                <DataView
                  value={{
                    content_type: latest.content_type,
                    text_type: latest.text_type,
                    media_metadata: latest.media_metadata,
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    form.reset(blockDefaults(latest));
                    setAudioFile(undefined);
                    setUncertain(false);
                    setError(undefined);
                    setLatest(undefined);
                    onLoaded(latest);
                  }}
                >
                  Load saved block
                </button>
              </>
            )}
          </section>
        )}
        <fieldset disabled={isSubmitting || replacing} className="block-fields">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="block-content-type">Content type *</label>
              <select
                id="block-content-type"
                disabled={initial.content_type === "audio" || recording}
                {...form.register("content_type")}
              >
                {blockTypes
                  .filter(
                    (type) =>
                      !initial.id ||
                      initial.content_type === "audio" ||
                      type !== "audio",
                  )
                  .map((type) => (
                    <option key={type}>{type}</option>
                  ))}
              </select>
              {fieldError("content_type")}
            </div>
            {text && (
              <div className="field">
                <label htmlFor="block-text-type">Text type</label>
                <select
                  id="block-text-type"
                  {...form.register("text_type")}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (
                      richTextTypes.includes(live.text_type) &&
                      !richTextTypes.includes(next) &&
                      hasHtml(live.content)
                    ) {
                      setPendingType(next);
                      return;
                    }
                    form.setValue("text_type", next, { shouldDirty: true });
                  }}
                  value={live.text_type}
                >
                  {textTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                {fieldError("text_type")}
              </div>
            )}
            {audio && (
              <div className="field wide">
                <label htmlFor="audio-title">Audio title</label>
                <input
                  id="audio-title"
                  maxLength={150}
                  {...form.register("audio_title")}
                />
                {fieldError("audio_title")}
                <AudioInput
                  file={audioFile}
                  onChange={setAudioFile}
                  onRecording={setRecording}
                />
                {!!initial.id && (
                  <>
                    <p>
                      Save title and publishing edits separately. Replacing the
                      recording keeps the current title and block position.
                    </p>
                    <button
                      type="button"
                      disabled={!audioFile || recording || uncertain}
                      onClick={async () => {
                        if (!audioFile) return;
                        setReplacing(true);
                        setError(undefined);
                        let replacementAttempted = false;
                        try {
                          const token = await uploadAudio(
                            audioFile,
                            setProgress,
                            new AbortController().signal,
                          );
                          replacementAttempted = true;
                          const updated = entity(
                            await request(
                              `${audioPath}/${encodeURIComponent(str(initial.id))}/audio`,
                              "POST",
                              { upload_token: token },
                            ),
                            "block",
                          );
                          setAudioFile(undefined);
                          setProgress("Recording replaced.");
                          onLoaded(updated);
                          await checkLatest();
                        } catch (e) {
                          setProgress("");
                          setError(e);
                          if (replacementAttempted && problem(e).uncertain)
                            setUncertain(true);
                        } finally {
                          setReplacing(false);
                        }
                      }}
                    >
                      Replace recording
                    </button>
                    <AudioPlayer
                      key={`${str(object(initial.audio_file).version)}-${str(initial.updated_at)}`}
                      data={initial}
                    />
                  </>
                )}
                {progress && <p role="status">{progress}</p>}
              </div>
            )}
            {!audio && (
              <div className="field wide">
                <label htmlFor="block-content">
                  {link ? "Link URL" : prompt ? "Prompt text" : "Content"}
                </label>
                {link ? (
                  <input
                    id="block-content"
                    type="text"
                    inputMode="url"
                    {...form.register("content")}
                  />
                ) : text && richTextTypes.includes(live.text_type) ? (
                  <LessonRichText
                    value={live.content || ""}
                    disabled={isSubmitting || replacing}
                    invalid={!!errors.content}
                    onChange={(value) =>
                      form.setValue("content", value, { shouldDirty: true })
                    }
                  />
                ) : (
                  <textarea
                    id="block-content"
                    className={prompt ? "prompt-editor" : undefined}
                    rows={prompt ? 12 : 5}
                    spellCheck={prompt ? false : undefined}
                    {...form.register("content")}
                  />
                )}
                {fieldError("content")}
                {richBackup && (
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue("text_type", "plain", {
                        shouldDirty: true,
                      });
                      form.setValue("content", richBackup, {
                        shouldDirty: true,
                      });
                      setRichBackup("");
                    }}
                  >
                    Restore formatted draft
                  </button>
                )}
                {prompt && (
                  <>
                    <small>
                      Plain text for students to copy. Line breaks, indentation,
                      tags, placeholders and code are preserved. The API trims
                      only outer whitespace.
                    </small>
                    <span className="muted" role="status">
                      {Array.from(live.content || "").length.toLocaleString()}{" "}
                      characters
                    </span>
                  </>
                )}
                {link && (
                  <>
                    <small>
                      One HTTP or HTTPS URL, up to 2048 characters. No
                      credentials, spaces or line breaks.
                    </small>
                    {destination ? (
                      <a
                        className="button"
                        href={destination.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Check link
                      </a>
                    ) : (
                      <button type="button" disabled>
                        Check link
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {link && (
              <div className="field wide">
                <label htmlFor="block-link-label">Link label</label>
                <input id="block-link-label" {...form.register("link_label")} />
                <small>
                  Optional: up to 100 characters on one line, without a web
                  address. Put longer instructions in a plain block before the
                  link.
                </small>
                {fieldError("link_label")}
              </div>
            )}
            {!text && !audio && (
              <div className="field wide">
                <label htmlFor="block-media-url">Media url</label>
                <input id="block-media-url" {...form.register("media_url")} />
                <small>
                  Paste a media URL, including YouTube watch, share or embed
                  URLs, rather than iframe code.
                </small>
                {fieldError("media_url")}
                <MediaField
                  purpose="lesson_media"
                  onComplete={(url) =>
                    form.setValue("media_url", url, { shouldDirty: true })
                  }
                />
              </div>
            )}
            {!audio && !link && !prompt && (
              <details
                className="field wide"
                open={metadataOpen}
                onToggle={(event) => setMetadataOpen(event.currentTarget.open)}
              >
                <summary>Advanced media metadata (optional)</summary>
                <p className="muted">
                  Leave this unchanged unless you need extra media properties
                  such as a caption.
                </p>
                <label htmlFor="block-metadata">Media metadata (JSON)</label>
                <textarea
                  id="block-metadata"
                  rows={4}
                  {...form.register("media_metadata")}
                />
                {fieldError("media_metadata")}
              </details>
            )}
            <label className="field">
              <span>
                Make this block available when the course is published
              </span>
              <input type="checkbox" {...form.register("is_published")} />
            </label>
          </div>
        </fieldset>
        {!audio && (
          <section className="form-section" aria-label="Block preview">
            <h3>Local presentation preview</h3>
            <Block
              data={{
                ...live,
                media_metadata: link
                  ? {
                      ...object(initial.media_metadata),
                      label: live.link_label,
                    }
                  : prompt
                    ? null
                    : live.media_metadata,
              }}
            />
          </section>
        )}
        <div className="save-bar">
          <span role="status">
            {isSubmitting
              ? "Saving…"
              : dirty
                ? "Unsaved changes"
                : saved
                  ? "Saved and confirmed"
                  : "Ready to edit"}
          </span>
          <button
            className="primary"
            type="submit"
            disabled={
              isSubmitting ||
              uncertain ||
              recording ||
              replacing ||
              (!!initial.id && audio && !!audioFile)
            }
          >
            {isSubmitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
      <Modal
        title="Convert formatted content?"
        open={!!pendingType}
        onClose={() => setPendingType("")}
      >
        <p>
          {pendingType} blocks use literal text. Converting removes formatting;
          a copy of your formatted draft will remain available here until you
          leave this editor.
        </p>
        <pre className="prewrap">{lessonText(live.content || "")}</pre>
        <div className="actions">
          <button type="button" onClick={() => setPendingType("")}>
            Keep rich text
          </button>
          <button
            type="button"
            onClick={() => {
              setRichBackup(live.content);
              form.setValue("content", lessonText(live.content), {
                shouldDirty: true,
              });
              form.setValue("text_type", pendingType, { shouldDirty: true });
              setPendingType("");
            }}
          >
            Convert to literal text
          </button>
        </div>
      </Modal>
      <Modal
        title="You have unsaved changes"
        open={blocker.state === "blocked"}
        onClose={() => blocker.state === "blocked" && blocker.reset()}
      >
        <p>Save your block before leaving this editor.</p>
        <div className="actions">
          <button
            onClick={() => blocker.state === "blocked" && blocker.reset()}
          >
            Stay
          </button>
          <button
            onClick={() => {
              form.reset();
              if (blocker.state === "blocked") blocker.proceed();
            }}
          >
            Discard
          </button>
          <button
            className="primary"
            disabled={
              uncertain ||
              recording ||
              replacing ||
              (!!initial.id && audio && !!audioFile)
            }
            onClick={() => void save()}
          >
            Save and leave
          </button>
        </div>
      </Modal>
    </>
  );
}
