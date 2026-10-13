import {
  useState,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  request,
  object,
  rows,
  page,
  str,
  problem,
  type RecordData,
} from "../../shared/api/client";
import { ErrorPanel, Loading } from "../../shared/ui/primitives";
import { DiscoveryFilters } from "./DiscoveryFilters";
import { ResourceSummary } from "./ResourceSummary";
import {
  initialResourceFilters,
  hasResourceFilters,
  type ResourceFiltersValue,
} from "./discovery";
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
  const [filters, setFilters] = useState(initialResourceFilters),
    [applied, setApplied] = useState<ResourceFiltersValue>(),
    [available, setAvailable] = useState<ReturnType<typeof page>>(),
    [known, setKnown] = useState<RecordData[]>([]),
    [selection, setSelection] = useState<number[] | null>(null),
    [error, setError] = useState<unknown>(),
    [fetchError, setFetchError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [fetching, setFetching] = useState(false),
    [uncertain, setUncertain] = useState(false),
    cache = useQueryClient();
  const abort = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => abort.current?.abort(), []);
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
  const ids = selection || current.data?.map((r) => Number(r.id)) || [];
  useEffect(() => {
    onDirty(selection !== null);
    return () => onDirty(false);
  }, [selection, onDirty]);
  async function fetchResources(index = 1, criteria = filters) {
    if (!hasResourceFilters(criteria) || fetching) return;
    setFetching(true);
    setFetchError(undefined);
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    try {
      const params = new URLSearchParams({
        per_page: "15",
        page: String(index),
      });
      for (const [key, value] of Object.entries(criteria))
        if (key !== "tags" && value.trim()) params.set(key, value.trim());
      const tags = [
        ...new Set(
          criteria.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ];
      if (tags.length > 15 || tags.some((t) => t.length > 40))
        throw new Error("Use at most 15 tags, each up to 40 characters.");
      for (const key of ["publication_year", "course_id"] as const) {
        if (
          criteria[key] &&
          (!Number.isInteger(Number(criteria[key])) ||
            (key === "course_id" && Number(criteria[key]) < 1))
        )
          throw new Error(
            "Publication year and course ID must be whole numbers; course ID must be positive.",
          );
      }
      for (const tag of tags) params.append("tags[]", tag);
      const result = page(
        await request(
          `student/resources?${params}`,
          "GET",
          undefined,
          controller.signal,
          true,
        ),
      );
      if (controller.signal.aborted) return;
      setAvailable(result);
      setApplied({ ...criteria });
      setKnown((previous) => [
        ...new Map(
          [...previous, ...result.items].map((r) => [Number(r.id), r]),
        ).values(),
      ]);
    } catch (e) {
      if (!controller.signal.aborted) setFetchError(e);
    } finally {
      if (!controller.signal.aborted) setFetching(false);
    }
  }
  async function reconcile() {
    const result = await current.refetch();
    if (result.isError) {
      setError(result.error);
      return;
    }
    if (
      selection &&
      JSON.stringify(result.data?.map((r) => Number(r.id))) ===
        JSON.stringify(selection)
    )
      setSelection(null);
    setUncertain(false);
    setError(undefined);
  }
  async function saveSelection() {
    if (selection === null) return;
    if (uncertain || busy)
      throw new Error("Check current attachments before saving again.");
    setBusy(true);
    setError(undefined);
    try {
      await request(`tutor/courses/${id}/resources`, "PUT", {
        resource_ids: ids,
      });
      setSelection(null);
      await cache.invalidateQueries({ queryKey: ["attachments", id] });
    } catch (e) {
      setError(e);
      if (problem(e).uncertain) setUncertain(true);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  useImperativeHandle(saveRef, () => ({
    save: saveSelection,
    discard: () => setSelection(null),
  }));
  const locked = busy || uncertain || current.isPending || current.isError;
  return (
    <section className="form-section" aria-label="Resource attachments">
      <h2>Resource attachments</h2>
      <p>Attach approved resources. Detaching keeps the original resource.</p>
      {current.isPending ? (
        <Loading />
      ) : current.isError ? (
        <ErrorPanel
          error={current.error}
          retry={() => void current.refetch()}
        />
      ) : (
        <>
          <h3>Selected resources ({ids.length})</h3>
          {ids.length === 0 && <p>No resources attached yet.</p>}
          {ids.map((resourceId, i) => {
            const resource = [...known, ...(current.data || [])].find(
              (r) => Number(r.id) === resourceId,
            ) || { id: resourceId, title: `Resource ${resourceId}` };
            return (
              <div className="resource-selection-card" key={resourceId}>
                <ResourceSummary resource={resource} />
                <div className="actions">
                  <span>Position {i + 1}</span>
                  <button
                    type="button"
                    aria-label={`Move ${str(resource.title)} up`}
                    disabled={locked || i === 0}
                    onClick={() => {
                      const n = [...ids];
                      [n[i - 1], n[i]] = [n[i], n[i - 1]];
                      setSelection(n);
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      setSelection(ids.filter((x) => x !== resourceId))
                    }
                  >
                    Detach {str(resource.title)}
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            disabled={locked || selection === null}
            onClick={() => void saveSelection().catch(() => undefined)}
          >
            Save ordered attachments
          </button>
          {error !== undefined && (
            <ErrorPanel
              error={error}
              retry={uncertain ? () => void reconcile() : undefined}
            />
          )}
          {uncertain && (
            <p>
              The save result is uncertain. Check current state before saving
              again. Your selection has been kept.
            </p>
          )}
        </>
      )}
      <h3>Find resources to attach</h3>
      <p>
        Set at least one filter, then click Fetch resources. Changing filters
        does not fetch results.
      </p>
      <DiscoveryFilters
        values={filters}
        onChange={setFilters}
        disabled={fetching || busy}
      />
      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={fetching || busy || !hasResourceFilters(filters)}
          onClick={() => void fetchResources()}
        >
          Fetch resources
        </button>
        <button
          type="button"
          disabled={fetching || busy}
          onClick={() => {
            setFilters(initialResourceFilters);
            setAvailable(undefined);
            setApplied(undefined);
            setFetchError(undefined);
          }}
        >
          Clear resource filters
        </button>
      </div>
      {fetching && <Loading />}
      {fetchError !== undefined && <ErrorPanel error={fetchError} />}
      {available && (
        <>
          <p>
            {available.total} matching approved resources. Results use the last
            fetched filters.
          </p>
          {available.items.length === 0 && (
            <p>No matching resources. Adjust the filters and fetch again.</p>
          )}
          {available.items.map((resource) => {
            const selected = ids.includes(Number(resource.id));
            return (
              <div className="resource-selection-card" key={str(resource.id)}>
                <ResourceSummary resource={resource} />
                <button
                  type="button"
                  disabled={
                    locked || selected || !Number.isInteger(Number(resource.id))
                  }
                  onClick={() => setSelection([...ids, Number(resource.id)])}
                >
                  {selected
                    ? `Selected: ${str(resource.title)}`
                    : `Attach ${str(resource.title)}`}
                </button>
              </div>
            );
          })}
          <div className="pagination">
            <button
              type="button"
              disabled={fetching || available.current <= 1}
              onClick={() =>
                void fetchResources(available.current - 1, applied)
              }
            >
              Previous resources
            </button>
            <span>
              Page {available.current} of {available.last}
            </span>
            <button
              type="button"
              disabled={fetching || available.current >= available.last}
              onClick={() =>
                void fetchResources(available.current + 1, applied)
              }
            >
              Next resources
            </button>
          </div>
        </>
      )}
    </section>
  );
}
