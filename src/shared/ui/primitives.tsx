import * as Dialog from "@radix-ui/react-dialog";
import { X, LoaderCircle, AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { str, object } from "../api/client";
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Loading your workspace…
    </div>
  );
}
export function ErrorPanel({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>We couldn’t complete this request</strong>
        <p>{error instanceof Error ? error.message : "Please try again."}</p>
        {retry && <button onClick={retry}>Check current state</button>}
      </div>
    </div>
  );
}
export function Badge({ value }: { value: unknown }) {
  const s = str(value);
  return s ? (
    <span
      className={`badge ${["approved", "published", "completed", "active", "open", "ok"].includes(s) ? "good" : ["rejected", "failed", "suspended"].includes(s) ? "bad" : ""}`}
    >
      {s.replaceAll("_", " ")}
    </span>
  ) : null;
}
export function Header({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">CREATION WORKSPACE</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog">
          <div className="dialog-head">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            {title} controls and information
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
const hidden =
  /token|password|otp|ip$|credentials_file|storage|idempotency|entity_type|entity_id|public_id|signed|download_url/i;
export const label = (key: string) =>
  key === "revenue"
    ? "Gross course sales"
    : key
        .replace(/^(university|faculty|department|organization|role)_id$/, "$1")
        .replaceAll("revenue", "gross_course_sales")
        .replaceAll("_", " ")
        .replace(/^./, (x) => x.toUpperCase());
export function DataView({
  value,
  depth = 0,
}: {
  value: unknown;
  depth?: number;
}) {
  if (value == null) return <span className="muted">Unavailable</span>;
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  if (typeof value !== "object")
    return <span className="prewrap">{str(value)}</span>;
  if (Array.isArray(value))
    return value.length ? (
      <div className="data-list">
        {value.map((row, i) => (
          <div className="data-row" key={i}>
            <DataView value={row} depth={depth + 1} />
          </div>
        ))}
      </div>
    ) : (
      <span className="muted">No entries</span>
    );
  return (
    <dl className={depth === 0 ? "data-grid" : "data-fields"}>
      {Object.entries(object(value))
        .filter(([k]) => !hidden.test(k) && !["id", "uuid", "slug"].includes(k))
        .map(([key, v]) => (
          <div key={key}>
            <dt>{label(key)}</dt>
            <dd>
              {key === "status" ? (
                <Badge value={v} />
              ) : (
                <DataView value={v} depth={depth + 1} />
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}
