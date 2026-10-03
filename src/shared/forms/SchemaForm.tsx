import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useBlocker } from "react-router-dom";
import {
  problem,
  str,
  request,
  page,
  rows,
  object,
  type RecordData,
} from "../api/client";
import { ErrorPanel, Modal, label } from "../ui/primitives";
import { MediaField } from "../uploads/MediaField";
import { useSession } from "../auth/session";
const RichTextField = lazy(() => import("./RichTextField"));
async function lookupAll(path: string, signal?: AbortSignal) {
  const records: RecordData[] = [];
  let last = 1;
  for (let index = 1; index <= last; index++) {
    const result = page(
      await request(
        `${path}?per_page=50&page=${index}`,
        "GET",
        undefined,
        signal,
        true,
      ),
    );
    records.push(...result.items);
    last = result.last;
  }
  return records;
}
export interface Field {
  name: string;
  label?: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "textarea"
    | "number"
    | "select"
    | "boolean"
    | "array"
    | "json"
    | "date"
    | "url"
    | "richtext";
  // Fields that explicitly accept HTML use the rich editor.
  required?: boolean;
  options?: string[] | { value: string; label: string }[];
  help?: string;
  min?: number;
  max?: number;
}
export function serialize(fields: Field[], input: RecordData): RecordData {
  const result: RecordData = {};
  for (const f of fields) {
    const value = input[f.name];
    if (value === "" || value === undefined || value === null) {
      if (f.type === "array") result[f.name] = [];
      else if (f.required) result[f.name] = value;
      continue;
    }
    result[f.name] =
      f.type === "number" || (f.name.endsWith("_id") && f.type === "select")
        ? Number(value)
        : f.type === "array"
          ? typeof value === "string"
            ? value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
            : value
          : f.type === "json"
            ? typeof value === "string"
              ? JSON.parse(value)
              : value
            : value;
  }
  if (result.suggested_is_paid === false) {
    delete result.suggested_price;
    delete result.suggested_coin_reward;
  }
  if (result.is_paid === false) delete result.price;
  return result;
}
export function SchemaForm({
  fields,
  initial = {},
  submit,
  button = "Save changes",
  validate,
  onDirty,
  externalDirty = false,
  onDiscard,
  preview,
}: {
  fields: Field[];
  initial?: RecordData;
  submit: (values: RecordData) => Promise<void>;
  button?: string;
  validate?: (data: RecordData) => string | undefined;
  onDirty?: (dirty: boolean) => void;
  externalDirty?: boolean;
  onDiscard?: () => void;
  preview?: (values: RecordData) => ReactNode;
}) {
  const shape: Record<string, z.ZodType> = {};
  const currentRole = useSession((s) => s.user?.role);
  const roleChoices = useQuery({
    queryKey: ["lookup", "signup-roles"],
    queryFn: async ({ signal }) => {
      const response = await request("roles", "GET", undefined, signal, true);
      return rows(object(response.data).roles);
    },
    enabled: fields.some((f) => f.name === "role_id"),
  });
  for (const f of fields)
    shape[f.name] =
      f.type === "boolean"
        ? z.boolean().optional()
        : z.unknown().superRefine((value, ctx) => {
            if (f.required && (value == null || str(value).trim() === ""))
              ctx.addIssue({
                code: "custom",
                message: "This field is required.",
              });
            if (
              f.required &&
              f.type === "richtext" &&
              !str(value)
                .replace(/<[^>]*>/g, "")
                .trim()
            )
              ctx.addIssue({ code: "custom", message: "Add post content." });
            if (
              value &&
              f.type === "number" &&
              ![
                "suggested_price",
                "price",
                "pack_price",
                "rate_leones",
              ].includes(f.name) &&
              !Number.isInteger(Number(value))
            )
              ctx.addIssue({
                code: "custom",
                message: "Enter a whole number.",
              });
            if (
              value &&
              [
                "suggested_price",
                "price",
                "pack_price",
                "rate_leones",
              ].includes(f.name) &&
              (!/^\d+(\.\d{1,2})?$/.test(str(value)) ||
                (f.name === "price" || f.name === "suggested_price"
                  ? Number(value) < 0
                  : Number(value) <= 0))
            )
              ctx.addIssue({
                code: "custom",
                message: "Enter a valid SLE amount with at most two decimals.",
              });
            if (
              value !== "" &&
              value != null &&
              f.type === "number" &&
              (!Number.isFinite(Number(value)) ||
                Number(value) < (f.min ?? 0) ||
                (f.max !== undefined && Number(value) > f.max))
            )
              ctx.addIssue({
                code: "custom",
                message: "Enter a number within the allowed range.",
              });
            if (value && f.type === "json") {
              try {
                JSON.parse(str(value));
              } catch {
                ctx.addIssue({ code: "custom", message: "Enter valid JSON." });
              }
            }
            if (value && f.type === "url") {
              try {
                const u = new URL(str(value));
                if (
                  !["http:", "https:"].includes(u.protocol) ||
                  u.username ||
                  u.password ||
                  /\s/.test(str(value))
                )
                  throw new Error();
              } catch {
                ctx.addIssue({
                  code: "custom",
                  message:
                    "Enter a valid HTTP or HTTPS URL without credentials.",
                });
              }
            }
          });
  const defaults = Object.fromEntries(
    fields.map((f) => [
      f.name,
      f.type === "boolean"
        ? Boolean(initial[f.name])
        : f.type === "array" && Array.isArray(initial[f.name])
          ? (initial[f.name] as unknown[]).map(str).join("\n")
          : f.type === "json" && typeof initial[f.name] === "object"
            ? JSON.stringify(initial[f.name], null, 2)
            : (initial[f.name] ?? ""),
    ]),
  );
  const form = useForm<RecordData>({
    defaultValues: defaults,
    resolver: zodResolver(z.object(shape)),
  });
  const university = useWatch({ control: form.control, name: "university_id" }),
    liveValues = useWatch({ control: form.control }),
    faculty = useWatch({ control: form.control, name: "faculty_id" });
  const institution = fields.some((f) => f.name === "university_id");
  const universities = useQuery({
    queryKey: ["lookup", "universities"],
    queryFn: ({ signal }) => lookupAll("universities", signal),
    enabled: institution,
  });
  const faculties = useQuery({
    queryKey: ["lookup", "faculties", university],
    queryFn: ({ signal }) =>
      lookupAll(`universities/${str(university)}/faculties`, signal),
    enabled: institution && !!university,
  });
  const departments = useQuery({
    queryKey: ["lookup", "departments", university, faculty],
    queryFn: ({ signal }) =>
      lookupAll(
        `universities/${str(university)}/faculties/${str(faculty)}/departments`,
        signal,
      ),
    enabled: institution && !!university && !!faculty,
  });
  const organizations = useQuery({
    queryKey: ["lookup", "organizations"],
    queryFn: ({ signal }) => lookupAll("organizations", signal),
    enabled: fields.some((f) => f.name === "organization_id"),
  });
  const [error, setError] = useState<unknown>(),
    [saved, setSaved] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const { isSubmitting, errors } = form.formState;
  const isDirty = form.formState.isDirty || externalDirty;
  const blocker = useBlocker(isDirty && !isSubmitting);
  useEffect(() => {
    onDirty?.(isDirty);
    const warn = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty, onDirty]);
  const save = form.handleSubmit(async (input) => {
    setError(undefined);
    setSaved(false);
    try {
      const values = serialize(fields, input);
      for (const field of fields)
        if (
          input[field.name] === "" &&
          defaults[field.name] !== "" &&
          field.type !== "array"
        )
          values[field.name] = ["number", "url", "date", "json"].includes(
            field.type || "",
          )
            ? null
            : "";
      const message = validate?.(values);
      if (message) throw new Error(message);
      await submit(values);
      form.reset(input);
      setSaved(true);
      if (blocker.state === "blocked") blocker.proceed();
    } catch (e) {
      const p = problem(e);
      setError(e instanceof Error && !p.status ? e : p);
      if (p.uncertain) setUncertain(true);
      for (const [key, messages] of Object.entries(p.fields))
        form.setError(key, { message: messages.join(" ") });
    }
  });
  return (
    <>
      <form onSubmit={save} className="editor-form">
        {[roleChoices, universities, faculties, departments, organizations]
          .filter((q) => q.isError)
          .map((q, i) => (
            <ErrorPanel
              key={i}
              error={q.error}
              retry={() => void q.refetch()}
            />
          ))}
        {error !== undefined && <ErrorPanel error={error} />}
        {uncertain && (
          <p className="notice">
            The server outcome is uncertain. Check the latest record before
            repeating this mutation. Automatic retries are disabled.
          </p>
        )}
        {Object.entries(problem(error).fields).length > 0 && (
          <ul className="field-error" role="alert">
            {Object.entries(problem(error).fields).map(([key, messages]) => (
              <li key={key}>
                {label(key)}: {messages.join(" ")}
              </li>
            ))}
          </ul>
        )}
        <div className="form-grid">
          {fields.map((f) => (
            <div
              className={
                ["textarea", "array", "json", "richtext"].includes(f.type || "")
                  ? "field wide"
                  : "field"
              }
              key={f.name}
            >
              <label htmlFor={`field-${f.name}`}>
                {f.label || label(f.name)}
                {f.required && " *"}
              </label>
              {f.name === "organization_id" ? (
                <select id={`field-${f.name}`} {...form.register(f.name)}>
                  <option value="">Select organization…</option>
                  {organizations.data?.map((r) => (
                    <option key={str(r.id)} value={str(r.id)}>
                      {str(r.name)}
                    </option>
                  ))}
                </select>
              ) : institution &&
                ["university_id", "faculty_id", "department_id"].includes(
                  f.name,
                ) ? (
                <select
                  id={`field-${f.name}`}
                  {...form.register(f.name)}
                  onChange={(e) => {
                    form.setValue(f.name, e.target.value, {
                      shouldDirty: true,
                    });
                    if (f.name === "university_id") {
                      form.setValue("faculty_id", "", { shouldDirty: true });
                      form.setValue("department_id", "", { shouldDirty: true });
                    }
                    if (f.name === "faculty_id")
                      form.setValue("department_id", "", { shouldDirty: true });
                  }}
                >
                  <option value="">General / select…</option>
                  {(f.name === "university_id"
                    ? universities.data
                    : f.name === "faculty_id"
                      ? faculties.data
                      : departments.data
                  )?.map((r) => (
                    <option key={str(r.id)} value={str(r.id)}>
                      {str(r.name)}
                    </option>
                  ))}
                </select>
              ) : f.type === "boolean" ? (
                <input
                  id={`field-${f.name}`}
                  type="checkbox"
                  {...form.register(f.name)}
                />
              ) : f.type === "select" ? (
                <select id={`field-${f.name}`} {...form.register(f.name)}>
                  <option value="">Select…</option>
                  {f.name === "role_id" &&
                    [
                      ...(roleChoices.data || []),
                      ...(currentRole?.id
                        ? [{ id: currentRole.id, name: currentRole.name }]
                        : []),
                    ].map((r) => (
                      <option key={str(r.id)} value={str(r.id)}>
                        {str(r.display_name || r.name)}
                      </option>
                    ))}
                  {f.options?.map((o) =>
                    typeof o === "string" ? (
                      <option key={o} value={o}>
                        {label(o)}
                      </option>
                    ) : (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ),
                  )}
                </select>
              ) : f.type === "richtext" ? (
                <Suspense fallback={<p>Loading editor…</p>}>
                  <RichTextField
                    value={str(initial[f.name])}
                    onChange={(value) =>
                      form.setValue(f.name, value, { shouldDirty: true })
                    }
                  />
                </Suspense>
              ) : ["textarea", "array", "json"].includes(f.type || "") ? (
                <textarea
                  id={`field-${f.name}`}
                  rows={f.type === "json" ? 7 : 4}
                  {...form.register(f.name)}
                />
              ) : (
                <input
                  id={`field-${f.name}`}
                  type={f.type === "url" ? "text" : f.type || "text"}
                  step={f.type === "number" ? "any" : undefined}
                  {...form.register(f.name)}
                />
              )}{" "}
              {["media_url", "thumbnail_url"].includes(f.name) && (
                <MediaField
                  purpose={
                    f.name === "thumbnail_url"
                      ? "thumbnail"
                      : fields.some((x) => x.name === "content_type")
                        ? "lesson_media"
                        : "feed_media"
                  }
                  onComplete={(url) =>
                    form.setValue(f.name, url, { shouldDirty: true })
                  }
                />
              )}{" "}
              {f.help && <small>{f.help}</small>}
              {errors[f.name] && (
                <small className="field-error" role="alert">
                  {str(errors[f.name]?.message)}
                </small>
              )}
            </div>
          ))}
        </div>
        {preview && (
          <section className="form-section">
            <h3>Local presentation preview</h3>
            {preview(liveValues)}
          </section>
        )}
        <div className="save-bar">
          <span role="status">
            {isSubmitting
              ? "Saving…"
              : isDirty
                ? "Unsaved changes"
                : saved
                  ? "Saved and confirmed"
                  : "Ready to edit"}
          </span>
          <button
            type="submit"
            className="primary"
            disabled={isSubmitting || uncertain}
          >
            {isSubmitting ? "Saving…" : button}
          </button>
        </div>
      </form>
      <Modal
        title="You have unsaved changes"
        open={blocker.state === "blocked"}
        onClose={() => blocker.state === "blocked" && blocker.reset()}
      >
        <p>Save your changes before leaving this editor.</p>
        <div className="actions">
          <button
            onClick={() => blocker.state === "blocked" && blocker.reset()}
          >
            Stay
          </button>
          <button
            onClick={() => {
              form.reset();
              onDiscard?.();
              if (blocker.state === "blocked") blocker.proceed();
            }}
          >
            Discard
          </button>
          <button className="primary" onClick={() => void save()}>
            Save and leave
          </button>
        </div>
      </Modal>
    </>
  );
}
