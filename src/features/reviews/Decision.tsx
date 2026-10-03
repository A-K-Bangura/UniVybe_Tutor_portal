import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { request, str, object, type RecordData } from "../../shared/api/client";
import { SchemaForm } from "../../shared/forms/SchemaForm";
import { Modal, label, ErrorPanel } from "../../shared/ui/primitives";
import { f } from "../courses/fields";
export function Decision({
  kind,
  id,
  action,
  onClose,
  onDeleted,
  creator = false,
  extra = {},
  snapshot = {},
}: {
  kind: string;
  id: string;
  action: string;
  onClose: () => void;
  onDeleted?: () => void;
  creator?: boolean;
  extra?: RecordData;
  snapshot?: RecordData;
}) {
  const cache = useQueryClient(),
    [result, setResult] = useState<string>(),
    [uncertain, setUncertain] = useState(false);
  const rejection = action.includes("reject") || action === "fail",
    coin = kind === "coins/exchanges";
  const fields = rejection
    ? [f(kind === "feed" ? "rejection_reason" : "reason", "textarea", true)]
    : action === "complete"
      ? [f("payout_reference", "text", true)]
      : [
          f(
            kind === "feed"
              ? "moderation_notes"
              : coin || ["unpublish", "close", "reopen"].includes(action)
                ? "note"
                : "comment",
            "textarea",
          ),
        ];
  if (kind === "courses" && ["approve", "pricing"].includes(action)) {
    fields.push(f("is_paid", "boolean"), f("price", "number"));
    if (action === "approve") fields.push(f("coin_reward", "number"));
  }
  if (kind === "courses" && action === "coin-reward")
    fields.push(f("coin_reward", "number", true));
  if (action === "reopen")
    fields.push({
      ...f("application_deadline", "date"),
      help: "Leave blank to explicitly remove the expired deadline.",
    });
  const path =
    `${creator ? "tutor" : "admin"}/${kind}/${id ? `${encodeURIComponent(id)}/` : ""}${action === "delete" ? "" : action}`.replace(
      /\/$/,
      "",
    );
  return (
    <Modal
      title={
        coin && action === "complete"
          ? "Record payment completed"
          : label(action)
      }
      open
      onClose={onClose}
    >
      <p>
        {action === "delete"
          ? "This removes the record. Review linked content and dependencies before confirming."
          : coin && action === "complete"
            ? `Record the payment you manually sent: SLE ${str(snapshot.leone_amount)} to ${str(snapshot.mobile_money_number)}. This portal does not send money.`
            : "This action changes the server record. The current server policy will be checked."}
      </p>
      {uncertain ? (
        <ErrorPanel
          error={
            new Error(
              "Outcome uncertain. Inspect the refreshed record before repeating this action. No automatic retry was sent.",
            )
          }
          retry={() => {
            void cache.invalidateQueries();
            onClose();
          }}
        />
      ) : result ? (
        <>
          <p role="status">{result}</p>
          <button onClick={onClose}>Done</button>
        </>
      ) : (
        <SchemaForm
          fields={action === "delete" ? [] : fields}
          initial={{
            is_paid:
              action === "approve" && !snapshot.pricing_approved_at
                ? snapshot.suggested_is_paid
                : snapshot.is_paid,
            price:
              action === "approve" && !snapshot.pricing_approved_at
                ? snapshot.suggested_price
                : snapshot.price,
            coin_reward:
              action === "approve" && !snapshot.coin_reward_approved_at
                ? snapshot.suggested_coin_reward
                : snapshot.coin_reward,
          }}
          validate={(values) =>
            kind === "courses" &&
            values.is_paid === true &&
            !(Number(values.price) > 0)
              ? "A paid course requires a positive final price."
              : kind === "courses" &&
                  values.is_paid === false &&
                  Number(values.coin_reward) > 0
                ? "Free courses cannot award Vybe Coins. Set the reward to zero."
                : undefined
          }
          button={action === "delete" ? "Confirm deletion" : "Confirm action"}
          submit={async (values) => {
            try {
              if (action === "reopen" && !values.application_deadline)
                values.application_deadline = null;
              const r = await request(
                path,
                action === "delete"
                  ? "DELETE"
                  : action.startsWith("bulk")
                    ? "POST"
                    : "PUT",
                { ...values, ...extra },
              );
              if (action === "delete") onDeleted?.();
              await cache.invalidateQueries();
              setResult(
                object(r.data).updated_count !== undefined
                  ? `${str(object(r.data).updated_count)} posts updated`
                  : str(r.message) || "Confirmed by server",
              );
            } catch (e) {
              await cache.invalidateQueries();
              const uncertainError = object(e);
              if (uncertainError.uncertain === true) setUncertain(true);
              throw e;
            }
          }}
        />
      )}
    </Modal>
  );
}
