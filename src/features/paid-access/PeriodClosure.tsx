import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { request, object, str } from "../../shared/api/client";
import {
  Modal,
  DataView,
  ErrorPanel,
  Loading,
} from "../../shared/ui/primitives";
export function PeriodClosure({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const cache = useQueryClient(),
    [typed, setTyped] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  const q = useQuery({
    queryKey: ["closure-preview", id],
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) =>
      object(
        (
          await request(
            `admin/academic-periods/${encodeURIComponent(id)}/closure-preview`,
            "GET",
            undefined,
            signal,
          )
        ).data,
      ),
  });
  const current = q.data;
  return (
    <Modal
      title="Confirm academic period closure"
      open
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorPanel error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <DataView value={current?.period} />
          <h3>Closure impact</h3>
          <DataView value={current?.impact} />
          <DataView value={current?.warnings} />
          <p>
            Closing permanently expires paid access and forfeits unused unlocks
            for this period. Progress, enrollments and payments are preserved.
            There is no reopen.
          </p>
          {error !== undefined && <ErrorPanel error={error} />}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (typed !== "CLOSE" || !current?.confirmation_code) return;
              setBusy(true);
              setError(undefined);
              try {
                await request(
                  `admin/academic-periods/${encodeURIComponent(id)}/close`,
                  "POST",
                  {
                    confirmation_code: current.confirmation_code,
                    reason: reason || null,
                  },
                );
                await cache.invalidateQueries({ queryKey: ["paid-access"] });
                onClose();
              } catch (err) {
                setTyped("");
                setError(err);
                await q.refetch();
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Reason (optional)
              <textarea
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <label>
              Type CLOSE to confirm
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                required
                pattern="CLOSE"
              />
            </label>
            <div className="actions">
              <button type="button" disabled={busy} onClick={onClose}>
                Cancel
              </button>
              <button
                className="primary"
                disabled={
                  busy ||
                  q.isFetching ||
                  q.isRefetchError ||
                  object(current?.period).status !== "active" ||
                  typed !== "CLOSE" ||
                  !str(current?.confirmation_code)
                }
              >
                Close period permanently
              </button>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}
