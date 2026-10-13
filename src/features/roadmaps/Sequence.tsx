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
import { CoursePicker } from "./CoursePicker";
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
    [selected, setSelected] = useState<RecordData[]>([]),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    onDirty(dirty || selected.length > 0);
    return () => onDirty(false);
  }, [dirty, selected.length, onDirty]);
  const ids = (items: RecordData[]) =>
    items.map((r) => Number(r.course_id || object(r.course).id || r.id));
  async function saveOrder() {
    if (!dirty) return;
    await mutate("/order", "PUT", { courses: ids(order) });
  }
  useImperativeHandle(saveRef, () => ({
    save: async () => {
      await saveOrder();
      await addSelected();
    },
    discard: () => {
      setOrder(rows(data.courses));
      setDirty(false);
      setSelected([]);
    },
  }));
  async function addSelected() {
    if (uncertain)
      throw new Error("Check the latest roadmap before adding more courses.");
    if (adding) throw new Error("Courses are already being added.");
    setAdding(true);
    try {
      for (const course of selected) {
        await mutate("", "POST", { course_id: Number(course.id) });
        setSelected((current) =>
          current.filter((item) => item.id !== course.id),
        );
      }
    } finally {
      setAdding(false);
    }
  }
  async function reconcile() {
    try {
      const response = await request(`admin/roadmaps/${id}`);
      const fresh = rows(object(object(response.data).roadmap).courses);
      setOrder(fresh);
      setDirty(false);
      setSelected((current) =>
        current.filter((course) => !ids(fresh).includes(Number(course.id))),
      );
      setUncertain(false);
      setError(undefined);
    } catch (e) {
      setError(e);
    }
  }
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
      if (object(e).uncertain === true) setUncertain(true);
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
      {error !== undefined && (
        <ErrorPanel error={error} retry={() => void reconcile()} />
      )}{" "}
      {uncertain && (
        <p className="notice">
          Outcome uncertain. Check current state before repeating the add
          operation.
        </p>
      )}
      <SortableList
        items={order}
        id={(r) => str(r.course_id || object(r.course).id || r.id)}
        onChange={(next) => {
          setOrder(next);
          setDirty(true);
        }}
        disabled={busy || adding}
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
        <button
          disabled={
            busy || adding || dirty || uncertain || selected.length === 0
          }
          onClick={() => void addSelected().catch(() => undefined)}
        >
          Add selected courses
        </button>
        <button
          className="primary"
          disabled={busy || !dirty}
          onClick={() => void saveOrder().catch(() => undefined)}
        >
          Save sequence
        </button>
      </div>
      <CoursePicker
        selected={selected}
        onChange={setSelected}
        existing={ids(order)}
        disabled={busy || adding || uncertain}
      />
    </div>
  );
}
