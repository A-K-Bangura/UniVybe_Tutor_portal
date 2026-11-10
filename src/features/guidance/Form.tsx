import { useEffect, useId, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useBlocker } from "react-router-dom";
import { problem, str, type RecordData } from "../../shared/api/client";
import { ErrorPanel, Modal } from "../../shared/ui/primitives";

export function GuidanceForm({
  initial,
  children,
  save,
  button = "Save changes",
  canSubmit = false,
  extraDirty = false,
  disabled = false,
  protect = false,
  onDirty,
}: {
  initial: RecordData;
  children: (values: RecordData) => ReactNode;
  save: (values: RecordData, submit: boolean) => Promise<void>;
  button?: string;
  canSubmit?: boolean;
  extraDirty?: boolean;
  disabled?: boolean;
  protect?: boolean;
  onDirty?: (dirty: boolean) => void;
}) {
  const form = useForm<RecordData>({ defaultValues: initial });
  const [error, setError] = useState<unknown>();
  const [uncertain, setUncertain] = useState(false);
  const dirty = form.formState.isDirty || extraDirty;
  const values = useWatch({ control: form.control }) as RecordData;
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  async function send(submit: boolean) {
    await form.handleSubmit(async (values) => {
      setError(undefined);
      try {
        await save(values, submit);
        form.reset(values);
      } catch (err) {
        setError(problem(err));
        if (problem(err).uncertain) setUncertain(true);
      }
    })();
  }
  // Conditional controls update the retained draft by name.
  return (
    <>
      <form
        className="panel gig-form guidance-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send(false);
        }}
        onChange={(e) => {
          const target = e.target as unknown as HTMLInputElement;
          if (target.name)
            form.setValue(
              target.name,
              target.type === "checkbox" ? target.checked : target.value,
              { shouldDirty: true },
            );
        }}
      >
        <fieldset
          disabled={disabled || uncertain || form.formState.isSubmitting}
        >
          {children(values)}
        </fieldset>
        {error !== undefined && (
          <>
            <ErrorPanel error={error} />
            <ul className="error" aria-label="Field errors">
              {Object.entries(problem(error).fields).map(([name, messages]) => (
                <li key={name}>
                  {name.replaceAll("_", " ")}: {messages.join(" ")}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="actions">
          <button
            className="primary"
            disabled={disabled || uncertain || form.formState.isSubmitting}
            type="submit"
          >
            {form.formState.isSubmitting ? "Saving…" : button}
          </button>
          {canSubmit && (
            <button
              disabled={disabled || uncertain || form.formState.isSubmitting}
              type="button"
              onClick={(e) => {
                if (e.currentTarget.form?.reportValidity()) void send(true);
              }}
            >
              Save and submit for approval
            </button>
          )}
        </div>
      </form>
      {protect && dirty && !form.formState.isSubmitting && <DirtyGuard />}
    </>
  );
}
function DirtyGuard() {
  const blocker = useBlocker(true);
  return (
    <Modal
      title="Unsaved guidance changes"
      open={blocker.state === "blocked"}
      onClose={() => blocker.state === "blocked" && blocker.reset()}
    >
      <p>Your changes have not been saved.</p>
      <div className="actions">
        <button onClick={() => blocker.state === "blocked" && blocker.reset()}>
          Stay
        </button>
        <button
          onClick={() => blocker.state === "blocked" && blocker.proceed()}
        >
          Discard and leave
        </button>
      </div>
    </Modal>
  );
}
export function Input({
  name,
  title,
  values,
  type = "text",
  required = false,
  maxLength,
  min,
  max,
  step,
  help,
  placeholder,
}: {
  name: string;
  title: string;
  values: RecordData;
  type?: string;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: string;
  help?: string;
  placeholder?: string;
}) {
  const helpId = useId();
  return (
    <label>
      {title}
      {required ? " *" : ""}
      {type === "textarea" ? (
        <textarea
          name={name}
          aria-label={`${title}${required ? " *" : ""}`}
          aria-describedby={help ? helpId : undefined}
          defaultValue={str(values[name])}
          required={required}
          maxLength={maxLength}
        />
      ) : (
        <input
          name={name}
          aria-label={`${title}${required ? " *" : ""}`}
          aria-describedby={help ? helpId : undefined}
          type={type}
          placeholder={placeholder}
          defaultValue={str(values[name])}
          required={required}
          maxLength={maxLength}
          min={min}
          max={max}
          step={step}
        />
      )}
      {help && <small id={helpId}>{help}</small>}
    </label>
  );
}
export function Select({
  name,
  title,
  values,
  options,
  required = false,
}: {
  name: string;
  title: string;
  values: RecordData;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <label>
      {title}
      {required ? " *" : ""}
      <select
        name={name}
        aria-label={`${title}${required ? " *" : ""}`}
        defaultValue={str(values[name])}
        required={required}
      >
        <option value="">Choose…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
