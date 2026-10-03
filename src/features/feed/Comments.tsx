import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { request, str, object, type RecordData } from "../../shared/api/client";
import { ErrorPanel, Modal } from "../../shared/ui/primitives";
export function Comments({ comments }: { comments: RecordData[] }) {
  const cache = useQueryClient(),
    [choice, setChoice] = useState<{ id: string; action: string }>(),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  return (
    <div className="panel">
      <h2>Comment moderation</h2>
      {comments.length ? (
        comments.map((comment) => (
          <div className="sequence-row" key={str(comment.id)}>
            <div>
              <strong>
                {str(
                  object(comment.user).firstname ||
                    object(comment.user).full_name,
                )}
              </strong>
              <p>{str(comment.content_text || comment.content)}</p>
            </div>
            {comment.is_approved !== true && (
              <button
                onClick={() =>
                  setChoice({ id: str(comment.id), action: "approve" })
                }
              >
                Approve
              </button>
            )}
            <button
              onClick={() =>
                setChoice({ id: str(comment.id), action: "delete" })
              }
            >
              Delete
            </button>
          </div>
        ))
      ) : (
        <p>No comments on this post.</p>
      )}
      <Modal
        title={`${choice?.action === "delete" ? "Delete" : "Approve"} comment`}
        open={!!choice}
        onClose={() => setChoice(undefined)}
      >
        {error !== undefined && <ErrorPanel error={error} />}
        <p>Confirm the moderation action for this comment.</p>
        <button
          disabled={busy}
          onClick={async () => {
            if (!choice) return;
            setBusy(true);
            try {
              await request(
                `admin/feed/comments/${choice.id}${choice.action === "approve" ? "/approve" : ""}`,
                choice.action === "approve" ? "PUT" : "DELETE",
              );
              await cache.invalidateQueries();
              setChoice(undefined);
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          Confirm action
        </button>
      </Modal>
    </div>
  );
}
