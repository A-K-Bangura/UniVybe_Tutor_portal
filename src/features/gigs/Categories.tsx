import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, str, type RecordData } from "../../shared/api/client";
import {
  Badge,
  ErrorPanel,
  Header,
  Loading,
  Modal,
} from "../../shared/ui/primitives";
import { gigCategories, key } from "./api";
import { GigForm, Input } from "./Form";

export default function GigCategories() {
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: ["gig-categories", true],
    queryFn: ({ signal }) => gigCategories(true, signal),
  });
  const [editing, setEditing] = useState<RecordData>();
  const [deleting, setDeleting] = useState<RecordData>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  async function refresh() {
    await cache.invalidateQueries({ queryKey: ["gig-categories"] });
  }
  return (
    <>
      <Header
        title="Gig categories"
        subtitle="Deactivate categories to retire them. Categories used by any gig cannot be deleted."
      >
        <button
          className="primary"
          onClick={() => setEditing({ is_active: true, sort_order: 0 })}
        >
          Create category
        </button>
      </Header>
      {error !== undefined && (
        <ErrorPanel error={error} retry={() => void q.refetch()} />
      )}
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorPanel error={q.error} retry={() => void q.refetch()} />
      ) : (
        <div className="gig-list">
          {q.data.map((category) => (
            <article className="panel" key={str(category.id)}>
              <h2>{str(category.name)}</h2>
              <Badge value={category.is_active ? "active" : "inactive"} />
              <p>{str(category.description)}</p>
              <p>
                {str(category.gigs_count)} gigs · Display order{" "}
                {str(category.sort_order)}
              </p>
              <div className="actions">
                <button disabled={busy} onClick={() => setEditing(category)}>
                  Edit category
                </button>
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(undefined);
                    try {
                      await request(
                        `admin/gig-categories/${key(category.id)}`,
                        "PUT",
                        { is_active: !category.is_active },
                      );
                      await refresh();
                    } catch (err) {
                      setError(err);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {category.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() => setDeleting(category)}
                >
                  Delete category
                </button>
              </div>
            </article>
          ))}
          {q.data.length === 0 && <p>No gig categories yet.</p>}
        </div>
      )}
      {editing && (
        <Modal
          title={editing.id ? "Edit category" : "Create category"}
          open
          onClose={() => setEditing(undefined)}
        >
          <GigForm
            initial={editing}
            save={async (values) => {
              const body: RecordData = {};
              for (const name of [
                "name",
                "slug",
                "description",
                "sort_order",
                "is_active",
              ]) {
                const value =
                  name === "sort_order"
                    ? Number(values[name])
                    : name === "is_active"
                      ? values[name] === true
                      : str(values[name]).trim();
                if (name === "slug" && !value) continue;
                if (!editing.id || value !== editing[name])
                  body[name] = name === "description" && !value ? null : value;
              }
              await request(
                `admin/gig-categories${editing.id ? `/${key(editing.id)}` : ""}`,
                editing.id ? "PUT" : "POST",
                body,
              );
              await refresh();
              setEditing(undefined);
            }}
          >
            {(values) => (
              <>
                <Input
                  name="name"
                  title="Name"
                  values={values}
                  required
                  maxLength={80}
                />
                <Input
                  name="slug"
                  title="Slug"
                  values={values}
                  maxLength={100}
                  help="Optional on creation. Lowercase letters, numbers and single hyphens."
                />
                <Input
                  name="description"
                  title="Description"
                  values={values}
                  type="textarea"
                  maxLength={255}
                />
                <Input
                  name="sort_order"
                  title="Display order"
                  values={values}
                  type="number"
                  min={0}
                  max={65535}
                  step="1"
                />
                <label>
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={values.is_active === true}
                  />{" "}
                  Active
                </label>
              </>
            )}
          </GigForm>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete category"
          open
          onClose={() => setDeleting(undefined)}
        >
          <GigForm
            initial={{}}
            button="Delete category"
            save={async () => {
              await request(
                `admin/gig-categories/${key(deleting.id)}`,
                "DELETE",
              );
              await refresh();
              setDeleting(undefined);
            }}
          >
            {() => (
              <p>
                Delete {str(deleting.name)}? The server will refuse if any gig
                has ever used it. Deactivate it to retire it instead.
              </p>
            )}
          </GigForm>
        </Modal>
      )}
    </>
  );
}
