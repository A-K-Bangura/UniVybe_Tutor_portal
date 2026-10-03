import { useState, useEffect, useImperativeHandle, type Ref } from "react";
import type { PendingSequence } from "../resources/Attachments";
import { useQueryClient } from "@tanstack/react-query";
import {
  request,
  rows,
  str,
  object,
  type RecordData,
} from "../../shared/api/client";
import { ErrorPanel, Badge } from "../../shared/ui/primitives";
import { SortableList } from "../../shared/ui/SortableList";
export function RoadmapSequence({
  id,
  data,
  onDirty,
  saveRef,
}: {
  id: string;
  data: RecordData;
  onDirty: (dirty: boolean) => void;
  saveRef: Ref<PendingSequence>;
}) {
  const cache = useQueryClient(),
    [order, setOrder] = useState(rows(data.courses)),
    [course, setCourse] = useState(""),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  const ids = (items: RecordData[]) =>
    items.map((r) => Number(r.course_id || object(r.course).id || r.id));
  async function saveOrder() {
    if (!dirty) return;
    await mutate("/order", "PUT", { courses: ids(order) });
  }
  useImperativeHandle(saveRef, () => ({
    save: saveOrder,
    discard: () => {
      setOrder(rows(data.courses));
      setDirty(false);
    },
  }));
  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      const response = await request(
        `admin/roadmaps/${id}/courses${path}`,
        method,
        body,
      );
      setOrder(rows(object(object(response.data).roadmap).courses));
      await cache.invalidateQueries();
      setError(undefined);
      setDirty(false);
    } catch (e) {
      setError(e);
      await cache.invalidateQueries();
      throw e;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel">
      <h2>Course sequence</h2>
      <p>
        Unavailable/deleted slots are retained. Removing a reference keeps
        course progress.
      </p>
      {error !== undefined && <ErrorPanel error={error} />}{" "}
      <SortableList
        items={order}
        id={(r) => str(r.course_id || object(r.course).id || r.id)}
        onChange={(next) => {
          setOrder(next);
          setDirty(true);
        }}
        disabled={busy}
        render={(r, i) => (
          <div className="sequence-row" key={str(r.course_id || r.id)}>
            <span>{i + 1}</span>
            <strong>
              {str(object(r.course).title || r.title) || "Unavailable course"}
            </strong>
            <Badge
              value={
                r.is_available === false
                  ? "unavailable"
                  : object(r.course).status
              }
            />
            <button
              disabled={busy || i === 0}
              onClick={() => {
                const n = [...order];
                [n[i - 1], n[i]] = [n[i], n[i - 1]];
                setOrder(n);
                setDirty(true);
              }}
            >
              ↑
            </button>
            <button
              disabled={busy || i === order.length - 1}
              onClick={() => {
                const n = [...order];
                [n[i + 1], n[i]] = [n[i], n[i + 1]];
                setOrder(n);
                setDirty(true);
              }}
            >
              ↓
            </button>
            <button
              disabled={busy || dirty}
              onClick={() =>
                void mutate(
                  `/${str(r.course_id || object(r.course).id || r.id)}`,
                  "DELETE",
                ).catch(() => undefined)
              }
            >
              Remove
            </button>
          </div>
        )}
      />
      <div className="actions">
        <input
          type="number"
          aria-label="Course ID to add"
          placeholder="Course ID"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        />
        <button
          disabled={
            busy ||
            dirty ||
            !course ||
            !Number.isInteger(Number(course)) ||
            Number(course) <= 0
          }
          onClick={() =>
            void mutate("", "POST", { course_id: Number(course) }).catch(
              () => undefined,
            )
          }
        >
          Add course
        </button>
        <button
          className="primary"
          disabled={busy || !dirty}
          onClick={() => void saveOrder().catch(() => undefined)}
        >
          Save sequence
        </button>
      </div>
    </div>
  );
}
