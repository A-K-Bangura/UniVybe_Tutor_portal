import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../shared/auth/session";
import {
  object,
  request,
  rows,
  str,
  type RecordData,
} from "../../shared/api/client";
import {
  Badge,
  DataView,
  ErrorPanel,
  Header,
  Loading,
  Modal,
  label,
} from "../../shared/ui/primitives";
import { uploadMedia } from "../../shared/uploads/workflows";
import {
  adminActions,
  contentPayload,
  gigCategories,
  gigDetail,
  gigEntity,
  gigOptions,
  initialValues,
  key,
  settingsPayload,
} from "./api";
import { GigForm, Input, Select } from "./Form";
import { Applicants } from "./Applicants";

export default function GigEditor({ admin = false }: { admin?: boolean }) {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ["gig", id, admin],
    queryFn: ({ signal }) => gigDetail(id!, admin, signal),
    enabled: !!id,
    staleTime: Infinity,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const categories = useQuery({
    queryKey: ["gig-categories", false],
    queryFn: ({ signal }) => gigCategories(false, signal),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const options = useQuery({
    queryKey: ["gig-options"],
    queryFn: ({ signal }) => gigOptions(signal),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  if ((id && q.isPending) || categories.isPending || options.isPending)
    return <Loading />;
  if (q.isError || categories.isError || options.isError)
    return (
      <ErrorPanel
        error={q.error || categories.error || options.error}
        retry={() => {
          if (id) void q.refetch();
          void categories.refetch();
          void options.refetch();
        }}
      />
    );
  return (
    <GigWorkspace
      key={`${id || "new"}:${str(q.data?.updated_at)}:${str(q.data?.status)}`}
      gig={
        q.data || {
          pricing_type: "fixed",
          work_mode: "remote",
          capacity_type: "open",
        }
      }
      id={id}
      admin={admin}
      categories={categories.data!}
      options={options.data!}
      refresh={() => void q.refetch()}
    />
  );
}
function GigWorkspace({
  gig,
  id,
  admin,
  categories,
  options,
  refresh,
}: {
  gig: RecordData;
  id?: string;
  admin: boolean;
  categories: RecordData[];
  options: RecordData;
  refresh: () => void;
}) {
  const role = useSession((s) => s.user!.role.name),
    navigate = useNavigate(),
    cache = useQueryClient();
  const [action, setAction] = useState<string>();
  const [cover, setCover] = useState<RecordData | null>();
  const [uploadError, setUploadError] = useState<unknown>();
  const [stage, setStage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const permissions = object(gig.permissions),
    deleted = !!gig.deleted_at;
  const editable = !deleted && (!id || permissions.can_edit === true);
  const initial = initialValues(gig);
  const choices = (name: string) =>
    rows(options[name]).map((v) => ({
      value: str(v.value),
      label: str(v.label),
    }));
  async function reconcile(response: RecordData) {
    const updated = gigEntity(response);
    cache.setQueryData(["gig", id, admin], updated);
    await cache.invalidateQueries({ queryKey: ["gigs"] });
    if (id && admin)
      await cache.invalidateQueries({ queryKey: ["gig", id, admin] });
    if (!id)
      navigate(`/gigs/${str(updated.uuid || updated.id)}`, { replace: true });
  }
  async function save(values: RecordData, submit: boolean) {
    let selectedCover = cover;
    if (
      selectedCover === undefined &&
      str(values.cover_url) !== str(initial.cover_url)
    )
      selectedCover = str(values.cover_url).trim()
        ? { source: "external", url: str(values.cover_url).trim() }
        : null;
    await reconcile(
      await request(
        `tutor/gigs${id ? `/${key(id)}` : ""}`,
        id ? "PUT" : "POST",
        contentPayload(values, gig, selectedCover, submit),
      ),
    );
    setCover(undefined);
  }
  const currentCover = cover === undefined ? object(gig.cover_image) : cover;
  return (
    <>
      <Header
        title={id ? str(gig.title) : "Create gig"}
        subtitle="Every gig needs admin approval. Enter contact details for this gig; students receive them after expressing interest."
      >
        <Badge value={gig.status} />
        {id && (
          <button disabled={dirty || uploading} onClick={refresh}>
            Refresh gig
          </button>
        )}
        <Link className="button" to={admin ? "/reviews/gigs" : "/gigs"}>
          Back to gigs
        </Link>
      </Header>
      {gig.rejection_reason && (
        <div className="error">Needs changes: {str(gig.rejection_reason)}</div>
      )}
      {deleted && (
        <div className="panel">
          This gig was deleted. Its details and audit history are read-only.
        </div>
      )}
      {id && (
        <section className="panel">
          <div className="gig-summary">
            <span>
              {str(gig.price_label)} ·{" "}
              {str(gig.work_mode_label || gig.work_mode)}
            </span>
            <span>
              {str(gig.applicant_count)} interested ·{" "}
              {str(gig.worked_with_count || 0)} worked with
            </span>
            <span>
              {gig.spots_remaining == null
                ? "No capacity limit"
                : `${str(gig.spots_remaining)} spots remaining`}
            </span>
            <span>
              {gig.is_accepting_interest
                ? "Accepting interest"
                : `Not accepting interest${gig.closed_reason ? `: ${str(gig.closed_reason).replaceAll("_", " ")}` : ""}`}
            </span>
          </div>
          {gig.creator_in_good_standing === false && (
            <p className="error">
              The creator’s account is not in good standing. This gig is hidden
              from public discovery.
            </p>
          )}
          {gig.closed_by_role === "admin" && role !== "admin" && (
            <p>Closed by an admin. Only an admin can reopen it.</p>
          )}
          {dirty && <p>Save your content changes before managing this gig.</p>}
          <fieldset
            className="gig-action-controls"
            disabled={dirty || uploading}
          >
            <div className="actions">
              {!deleted && (
                <>
                  {permissions.can_submit === true && (
                    <button onClick={() => setAction("submit")}>
                      Submit for approval
                    </button>
                  )}
                  {permissions.can_manage_settings === true && (
                    <button onClick={() => setAction("settings")}>
                      Capacity and deadline
                    </button>
                  )}
                  {permissions.can_close === true && (
                    <button onClick={() => setAction("close")}>
                      Close gig
                    </button>
                  )}
                  {permissions.can_reopen === true && (
                    <button onClick={() => setAction("reopen")}>
                      Reopen gig
                    </button>
                  )}
                  {role === "admin" &&
                    adminActions(gig).map((name) => (
                      <button key={name} onClick={() => setAction(name)}>
                        {label(name)}
                      </button>
                    ))}
                  {permissions.can_delete === true && (
                    <button
                      className="danger"
                      onClick={() => setAction("delete")}
                    >
                      Delete gig
                    </button>
                  )}
                </>
              )}
            </div>
          </fieldset>
        </section>
      )}
      {editable ? (
        <GigForm
          protect
          onDirty={setDirty}
          initial={initial}
          save={save}
          button={id ? "Save changes" : "Save draft"}
          canSubmit={!id || permissions.can_submit === true}
          extraDirty={cover !== undefined}
          disabled={uploading}
        >
          {(values) => (
            <>
              <div className="form-grid">
                <Input
                  name="title"
                  title="Title"
                  values={values}
                  required
                  maxLength={200}
                />
                <Select
                  name="category_id"
                  title="Category"
                  values={values}
                  required
                  options={[
                    ...categories.map((c) => ({
                      value: str(c.id),
                      label: str(c.name),
                    })),
                    ...(!categories.some(
                      (c) => str(c.id) === str(object(gig.category).id),
                    ) && gig.category
                      ? [
                          {
                            value: str(object(gig.category).id),
                            label: `${str(object(gig.category).name)} (inactive — choose an active category before submitting)`,
                          },
                        ]
                      : []),
                  ]}
                />
                <Input
                  name="short_description"
                  title="Short description"
                  values={values}
                  required
                  type="textarea"
                  maxLength={500}
                />
                <Input
                  name="description"
                  title="Description"
                  values={values}
                  type="textarea"
                  maxLength={10000}
                />
                <Input
                  name="requirements"
                  title="Requirements"
                  values={values}
                  type="textarea"
                  maxLength={5000}
                />
                <Select
                  name="pricing_type"
                  title="Pricing type"
                  values={values}
                  required
                  options={choices("pricing_types")}
                />
                <Input
                  name="price_amount"
                  title={`Price amount (${str(options.currency) || "SLE"})`}
                  values={values}
                  type="number"
                  step="0.01"
                  min={0.01}
                  max={9999999999.99}
                  required={values.pricing_type === "fixed"}
                />
                {values.pricing_type === "negotiable" && (
                  <Input
                    name="price_max"
                    title="Maximum indicative price"
                    values={values}
                    type="number"
                    step="0.01"
                    min={0.01}
                    max={9999999999.99}
                  />
                )}
                <Select
                  name="work_mode"
                  title="Work mode"
                  values={values}
                  required
                  options={choices("work_modes")}
                />
                {values.work_mode !== "remote" && (
                  <>
                    <Input
                      name="location"
                      title="Location"
                      values={values}
                      maxLength={200}
                    />
                    <Input
                      name="address"
                      title="Address"
                      values={values}
                      maxLength={300}
                    />
                  </>
                )}
                <Input
                  name="contact_whatsapp"
                  title="Contact WhatsApp"
                  values={values}
                  type="tel"
                  maxLength={30}
                  help="Sierra Leone numbers accept local format. Other countries need their country code."
                />
                <Input
                  name="contact_email"
                  title="Contact email"
                  values={values}
                  type="email"
                  maxLength={255}
                  help="Provide WhatsApp, email, or both for this gig."
                />
                <CapacityFields values={values} options={options} />
                <Input
                  name="expected_start_date"
                  title="Expected start date"
                  values={values}
                  type="date"
                />
                <Input
                  name="expected_completion_date"
                  title="Expected completion date"
                  values={values}
                  type="date"
                />
                <Input
                  name="skills"
                  title="Skills"
                  values={values}
                  type="textarea"
                  help={`One per line; up to ${str(object(options.limits).max_skills)} skills, 60 characters each.`}
                />
                <Input
                  name="tags"
                  title="Tags"
                  values={values}
                  type="textarea"
                  help={`One per line; up to ${str(object(options.limits).max_tags)} tags, 40 characters each.`}
                />
                <label>
                  Cover image URL
                  <input
                    name="cover_url"
                    type="url"
                    defaultValue={str(values.cover_url)}
                    onChange={(e) =>
                      setCover(
                        e.target.value.trim()
                          ? { source: "external", url: e.target.value.trim() }
                          : null,
                      )
                    }
                  />
                  <small>
                    Use a direct HTTPS image URL or upload below. An unchanged
                    cover is preserved.
                  </small>
                </label>
              </div>
              {currentCover?.url && (
                <img
                  className="gig-cover"
                  src={str(currentCover.url)}
                  alt="Gig cover"
                />
              )}
              <label>
                Upload cover image
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    setUploadError(undefined);
                    controller.current = new AbortController();
                    try {
                      const media = await uploadMedia(
                        file,
                        "thumbnail",
                        setStage,
                        controller.current.signal,
                      );
                      setCover({
                        source: "cloudinary",
                        public_id: media.public_id,
                        url: media.url,
                      });
                    } catch (err) {
                      setUploadError(err);
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </label>
              <p role="status">{stage}</p>
              {uploadError !== undefined && <ErrorPanel error={uploadError} />}
              <button type="button" onClick={() => setCover(null)}>
                Remove cover image
              </button>
              <p>
                UniVybe verifies no payment or delivery. Arrange conversation
                and payment through WhatsApp or email.
              </p>
            </>
          )}
        </GigForm>
      ) : (
        <section className="panel">
          <h2>Gig details</h2>
          <p>Content editing is unavailable in this state.</p>
          <DataView
            value={{
              short_description: gig.short_description,
              description: gig.description,
              requirements: gig.requirements,
              category: gig.category,
              location: gig.location,
              address: gig.address,
              contact: gig.contact,
              application_deadline: gig.application_deadline,
              expected_start_date: gig.expected_start_date,
              expected_completion_date: gig.expected_completion_date,
              skills: gig.skills,
              tags: gig.tags,
            }}
          />
          {!!object(gig.cover_image).url && (
            <img
              className="gig-cover"
              src={str(object(gig.cover_image).url)}
              alt="Gig cover"
            />
          )}
        </section>
      )}
      {id && !deleted && permissions.can_view_applicants === true && (
        <Applicants
          id={id}
          canRate={!dirty && permissions.can_rate_workers === true}
          options={options}
        />
      )}
      {admin && id && (
        <section className="panel">
          <h2>Audit history</h2>
          <DataView value={gig.events || []} />
        </section>
      )}
      {action && id && (
        <Modal
          title={
            action === "settings"
              ? "Capacity and deadline"
              : `${label(action)} gig`
          }
          open
          onClose={() => setAction(undefined)}
        >
          <GigForm
            initial={initial}
            button={
              action === "settings" ? "Save settings" : `${label(action)} gig`
            }
            save={async (values) => {
              const privileged =
                role === "admin" && !["submit", "settings"].includes(action);
              const prefix = `${privileged ? "admin" : "tutor"}/gigs/${key(id)}`;
              let body: RecordData = {};
              if (["settings", "reopen"].includes(action))
                body = settingsPayload(values, gig);
              if (action === "reject") body.reason = values.reason;
              if (action === "approve") body.comment = values.comment || null;
              if (["close", "reopen", "unpublish"].includes(action))
                body.note = values.note || null;
              const method =
                action === "delete"
                  ? "DELETE"
                  : !privileged &&
                      ["submit", "close", "reopen"].includes(action)
                    ? "POST"
                    : "PUT";
              const response = await request(
                `${prefix}${action === "delete" ? "" : `/${action}`}`,
                method,
                body,
              );
              if (action === "delete") {
                await cache.invalidateQueries({ queryKey: ["gigs"] });
                navigate(admin ? "/reviews/gigs" : "/gigs");
              } else await reconcile(response);
              setAction(undefined);
            }}
          >
            {(values) => (
              <>
                {action === "delete" && (
                  <p>
                    Delete this gig? Applicants, ratings and history are
                    retained by the backend.
                  </p>
                )}
                {action === "submit" && (
                  <p>
                    This gig will wait for admin approval before it becomes
                    public.
                  </p>
                )}
                {["settings", "reopen"].includes(action) && (
                  <>
                    <p>
                      Reopening requires a future or cleared deadline and room
                      for more applicants.
                    </p>
                    <CapacityFields values={values} options={options} />
                  </>
                )}
                {action === "reject" && (
                  <Input
                    name="reason"
                    title="Rejection reason"
                    values={values}
                    required
                    type="textarea"
                    maxLength={2000}
                  />
                )}
                {action === "approve" && (
                  <Input
                    name="comment"
                    title="Review comment"
                    values={values}
                    type="textarea"
                    maxLength={1000}
                  />
                )}
                {["close", "reopen", "unpublish"].includes(action) && (
                  <Input
                    name="note"
                    title="Note"
                    values={values}
                    type="textarea"
                    maxLength={1000}
                  />
                )}
                {action === "restore" && (
                  <p>
                    Restore this unpublished gig to its previous state. A
                    previously closed gig stays closed.
                  </p>
                )}
              </>
            )}
          </GigForm>
        </Modal>
      )}
    </>
  );
}
function CapacityFields({
  values,
  options,
}: {
  values: RecordData;
  options: RecordData;
}) {
  return (
    <>
      <Select
        name="capacity_type"
        title="Capacity"
        values={values}
        required
        options={rows(options.capacity_types).map((v) => ({
          value: str(v.value),
          label: str(v.label),
        }))}
      />
      {values.capacity_type === "limited" && (
        <Input
          name="applicant_limit"
          title="Applicant limit"
          values={values}
          type="number"
          required
          min={1}
          max={Number(object(options.limits).max_applicant_limit) || 10000}
          step="1"
        />
      )}
      <Input
        name="application_deadline"
        title="Application deadline"
        values={values}
        help="Enter YYYY-MM-DD (end of day in Sierra Leone) or an ISO date-time. Leave blank to remove the deadline. Unchanged instants are preserved."
      />
    </>
  );
}
