import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../../shared/auth/session";
import {
  ApiError,
  entity,
  object,
  request,
  rows,
  str,
  type RecordData,
} from "../../shared/api/client";
import {
  Header,
  DataView,
  ErrorPanel,
  Loading,
  Modal,
  Badge,
} from "../../shared/ui/primitives";
import { SchemaForm } from "../../shared/forms/SchemaForm";
import { userFields } from "./config";
import { targetRestriction } from "./governance";
import { GuidanceForm, Input } from "../guidance/Form";

export default function UserEditor() {
  const { id } = useParams();
  const actor = useSession((s) => s.user!);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [roleId, setRoleId] = useState("");
  const [action, setAction] = useState("");
  const [notice, setNotice] = useState("");
  const roles = useQuery({
    queryKey: ["admin-roles", actor.id],
    queryFn: async ({ signal }) =>
      rows(
        object((await request("admin/roles", "GET", undefined, signal)).data)
          .roles,
      ),
  });
  const detail = useQuery({
    queryKey: ["detail", "users", id],
    enabled: !!id,
    queryFn: async ({ signal }) =>
      entity(
        await request(
          `admin/users/${encodeURIComponent(id!)}`,
          "GET",
          undefined,
          signal,
        ),
        "user",
      ),
  });
  if (roles.isPending || (id && detail.isPending)) return <Loading />;
  if (roles.isError)
    return (
      <ErrorPanel error={roles.error} retry={() => void roles.refetch()} />
    );
  if (detail.isError)
    return (
      <ErrorPanel error={detail.error} retry={() => void detail.refetch()} />
    );
  const target = detail.data || {};
  const original = roles.data.some(
    (r) => r.name === "super_admin" && r.can_assign === true,
  );
  const selected = roles.data.find((r) => str(r.id) === roleId);
  const pending = selected?.account_requires_super_admin_approval === true;
  const student =
    target.user_type === "student" ||
    target.type === "student" ||
    object(target.role).name === "student" ||
    (!target.role_id && !target.role);
  const record = student && id ? { ...target, user_type: "student" } : target;
  const restriction = (a: string) =>
    targetRestriction(actor, record, a, original);
  const targetKey = str(target.uuid || target.id || id);
  return (
    <>
      <Header
        title={id ? str(target.full_name || target.email) : "Create user"}
      >
        <Badge value={target.status} />
        {id && student && (
          <>
            <Link
              className="button"
              to={`/course-pack-purchases?student_id=${encodeURIComponent(str(target.id))}`}
            >
              Pack purchases
            </Link>
            <Link
              className="button"
              to={`/course-access?student_id=${encodeURIComponent(str(target.id))}`}
            >
              Course access
            </Link>
          </>
        )}
        {id &&
          student &&
          ["admin", "super_admin"].includes(actor.role.name) && (
            <Link
              className="button primary"
              to={`/ambassadors/new?student_id=${encodeURIComponent(targetKey)}`}
            >
              Designate ambassador
            </Link>
          )}
      </Header>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {!id ? (
        <>
          <section className="panel">
            <label>
              Account role
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <option value="">Choose role</option>
                {roles.data
                  .filter(
                    (r) =>
                      r.can_create_account === true && r.name !== "super_admin",
                  )
                  .map((r) => (
                    <option key={str(r.id)} value={str(r.id)}>
                      {str(r.display_name || r.name)}
                    </option>
                  ))}
              </select>
            </label>
            {pending && (
              <p className="notice">
                This Admin account will await Super Admin approval. A different
                Super Admin must approve it.
              </p>
            )}
          </section>
          <SchemaForm
            fields={userFields.filter(
              (f) => f.name !== "role_id" && !(pending && f.name === "status"),
            )}
            initial={{ status: "approved" }}
            button="Create user"
            submit={async (values) => {
              const fresh = rows(
                object((await request("admin/roles")).data).roles,
              ).find((r) => str(r.id) === roleId);
              if (
                !fresh ||
                fresh.can_create_account !== true ||
                fresh.name === "super_admin"
              )
                throw new ApiError(
                  "Choose a role you are permitted to create.",
                );
              const response = await request("admin/users", "POST", {
                ...values,
                role_id: Number(roleId),
                ...(fresh.account_requires_super_admin_approval === true
                  ? { status: "pending" }
                  : {}),
              });
              setNotice(str(response.message));
              const created = entity(response, "user");
              await cache.invalidateQueries({
                queryKey: ["collection", "users"],
              });
              navigate(
                `/users/${encodeURIComponent(str(created.uuid || created.id))}`,
              );
            }}
          />
        </>
      ) : (
        <>
          {target.is_original_super_admin === true && (
            <p className="notice">Original Super Admin · Protected account</p>
          )}
          {target.awaiting_super_admin_approval === true && (
            <p className="notice">Awaiting Super Admin approval</p>
          )}
          <section className="panel">
            <DataView value={target} />
          </section>
          <div className="actions">
            {["approve", "reject", "suspend", "delete"]
              .filter(() => !restriction("suspend"))
              .filter((a) =>
                a === "approve"
                  ? ["pending", "rejected", "suspended"].includes(
                      str(target.status),
                    )
                  : a === "reject"
                    ? target.status === "pending"
                    : true,
              )
              .map((a) => (
                <button
                  key={a}
                  disabled={!!restriction(a)}
                  title={restriction(a) || undefined}
                  onClick={() => setAction(a)}
                >
                  {a === "approve" && target.status === "suspended"
                    ? "Reinstate"
                    : a[0].toUpperCase() + a.slice(1)}
                </button>
              ))}
            {!student &&
              actor.role.name === "super_admin" &&
              !restriction("role") && (
                <button
                  disabled={!!restriction("role")}
                  title={restriction("role") || undefined}
                  onClick={() => setAction("role")}
                >
                  Change role
                </button>
              )}
          </div>
          {restriction("approve") && (
            <p className="notice">{restriction("approve")}</p>
          )}
        </>
      )}
      {action && (
        <Modal
          open
          title={action === "role" ? "Change role" : `Confirm ${action}`}
          onClose={() => setAction("")}
        >
          <p>
            {action === "role"
              ? "Changing the role signs this person out of every session. Their account status and content ownership stay unchanged."
              : "The server checks your current authority before applying this action."}
          </p>
          <GuidanceForm
            initial={{}}
            button="Confirm action"
            save={async (values) => {
              const freshRoles = rows(
                object((await request("admin/roles")).data).roles,
              );
              const current = entity(
                await request(`admin/users/${encodeURIComponent(targetKey)}`),
                "user",
              );
              const denied = targetRestriction(
                actor,
                student ? { ...current, user_type: "student" } : current,
                action,
                freshRoles.some(
                  (r) => r.name === "super_admin" && r.can_assign === true,
                ),
              );
              if (denied) throw new ApiError(denied);
              let body: RecordData = values;
              if (action === "role") {
                const role = freshRoles.find(
                  (r) =>
                    str(r.id) === str(values.role_id) && r.can_assign === true,
                );
                if (!role)
                  throw new ApiError(
                    "Choose a role you are permitted to assign.",
                  );
                body = { role_id: Number(role.id), reason: values.reason };
              }
              try {
                const response = await request(
                  `admin/users/${encodeURIComponent(targetKey)}${action === "delete" ? "" : `/${action}`}`,
                  action === "delete" ? "DELETE" : "PUT",
                  action === "delete" ? undefined : body,
                );
                setNotice(str(response.message));
                setAction("");
                await cache.invalidateQueries();
                if (action === "delete") navigate("/users");
              } catch (error) {
                await cache.invalidateQueries();
                throw error;
              }
            }}
          >
            {(values) => (
              <>
                {action === "role" && (
                  <label>
                    New role
                    <select name="role_id" required defaultValue="">
                      <option value="">Choose role</option>
                      {roles.data
                        .filter(
                          (r) =>
                            r.can_assign === true &&
                            str(r.id) !==
                              str(object(target.role).id || target.role_id),
                        )
                        .map((r) => (
                          <option key={str(r.id)} value={str(r.id)}>
                            {str(r.display_name || r.name)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {action !== "delete" && (
                  <Input
                    name={
                      action === "role" || action === "reject"
                        ? "reason"
                        : "comment"
                    }
                    title={
                      action === "role" || action === "reject"
                        ? "Reason"
                        : "Comment"
                    }
                    type="textarea"
                    maxLength={1000}
                    required={
                      action === "reject" ||
                      (action === "role" &&
                        [
                          str(object(target.role).name),
                          str(
                            roles.data.find(
                              (r) => str(r.id) === str(values.role_id),
                            )?.name,
                          ),
                        ].some((r) => ["admin", "super_admin"].includes(r)))
                    }
                    values={values}
                  />
                )}
              </>
            )}
          </GuidanceForm>
        </Modal>
      )}
    </>
  );
}
