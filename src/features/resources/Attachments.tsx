import { useState, useEffect, useImperativeHandle, type Ref } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, object, rows, page, str } from "../../shared/api/client";
import { ErrorPanel, Loading } from "../../shared/ui/primitives";
export interface PendingSequence {
  save: () => Promise<void>;
  discard: () => void;
}
export function Attachments({
  id,
  onDirty,
  saveRef,
}: {
  id: string;
  onDirty: (dirty: boolean) => void;
  saveRef: Ref<PendingSequence>;
}) {
  const [search, setSearch] = useState(""),
    [selection, setSelection] = useState<number[] | null>(null),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [pageIndex, setPageIndex] = useState(1),
    cache = useQueryClient();
  const current = useQuery({
    queryKey: ["attachments", id],
    queryFn: async ({ signal }) =>
      rows(
        object(
          (
            await request(
              `tutor/courses/${id}/resources`,
              "GET",
              undefined,
              signal,
            )
          ).data,
        ).resources,
      ),
  });
  const available = useQuery({
    queryKey: ["available-resources", search, pageIndex],
    queryFn: async ({ signal }) =>
      page(
        await request(
          `student/resources?search=${encodeURIComponent(search)}&per_page=50&page=${pageIndex}`,
          "GET",
          undefined,
          signal,
          true,
        ),
      ),
  });
  const ids = selection || current.data?.map((r) => Number(r.id)) || [];
  useEffect(() => {
    onDirty(selection !== null);
    return () => onDirty(false);
  }, [selection, onDirty]);
  async function saveSelection() {
    if (selection === null) return;
    setBusy(true);
    setError(undefined);
    try {
      await request(`tutor/courses/${id}/resources`, "PUT", {
        resource_ids: ids,
      });
      await cache.invalidateQueries({ queryKey: ["attachments", id] });
      setSelection(null);
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  useImperativeHandle(saveRef, () => ({
    save: saveSelection,
    discard: () => setSelection(null),
  }));
  return (
    <section className="form-section">
      <h2>Resource attachments</h2>
      <p>Attach approved resources. Detaching keeps the original resource.</p>
      <input
        aria-label="Find approved resources"
        placeholder="Search resource library"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPageIndex(1);
        }}
      />
      {error !== undefined && <ErrorPanel error={error} />}{" "}
      {available.isPending || current.isPending ? (
        <Loading />
      ) : available.isError || current.isError ? (
        <ErrorPanel error={available.error || current.error} />
      ) : (
        <>
          {ids.map((resourceId, i) => (
            <div className="sequence-row" key={resourceId}>
              <span>
                {str(
                  [...available.data.items, ...current.data].find(
                    (r) => Number(r.id) === resourceId,
                  )?.title,
                ) || `Resource ${resourceId}`}
              </span>
              <button
                disabled={i === 0}
                onClick={() => {
                  const n = [...ids];
                  [n[i - 1], n[i]] = [n[i], n[i - 1]];
                  setSelection(n);
                }}
              >
                ↑
              </button>
              <button
                onClick={() =>
                  setSelection(ids.filter((x) => x !== resourceId))
                }
              >
                Detach
              </button>
            </div>
          ))}
          {available.data.items
            .filter((r) => !ids.includes(Number(r.id)))
            .map((r) => (
              <button
                className="resource-option"
                key={str(r.id)}
                onClick={() => setSelection([...ids, Number(r.id)])}
              >
                + {str(r.title)}
              </button>
            ))}
          <button
            disabled={busy || selection === null}
            onClick={() => void saveSelection().catch(() => undefined)}
          >
            Save ordered attachments
          </button>
          <div className="actions">
            <button
              disabled={pageIndex === 1}
              onClick={() => setPageIndex(pageIndex - 1)}
            >
              Previous resources
            </button>
            <span>
              Page {pageIndex} of {available.data.last}
            </span>
            <button
              disabled={pageIndex >= available.data.last}
              onClick={() => setPageIndex(pageIndex + 1)}
            >
              Next resources
            </button>
          </div>
        </>
      )}
    </section>
  );
}
