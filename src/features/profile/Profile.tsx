import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, object, str } from "../../shared/api/client";
import { Header, Badge, Loading, ErrorPanel } from "../../shared/ui/primitives";
import { SchemaForm } from "../../shared/forms/SchemaForm";
import { f } from "../courses/fields";
import { useSession } from "../../shared/auth/session";
export default function Profile({ security = false }: { security?: boolean }) {
  const session = useSession(),
    cache = useQueryClient(),
    [uploadState, setUploadState] = useState(""),
    [error, setError] = useState<unknown>();
  const q = useQuery({
    queryKey: ["own-profile"],
    queryFn: async ({ signal }) =>
      object(
        object((await request("tutor/profile", "GET", undefined, signal)).data)
          .tutor,
      ),
    enabled: !security,
  });
  return (
    <>
      <Header
        title={security ? "Account security" : "Your profile"}
        subtitle="A little about the person behind the work."
      />
      <div className="panel">
        {security ? (
          <SchemaForm
            fields={[
              f("current_password", "password", true),
              f("new_password", "password", true),
              f("new_password_confirmation", "password", true),
            ]}
            button="Change password"
            validate={(v) =>
              str(v.new_password).length < 8
                ? "Use at least eight characters."
                : v.new_password !== v.new_password_confirmation
                  ? "Passwords must match."
                  : undefined
            }
            submit={async (values) => {
              await request("tutor/auth/change-password", "POST", values);
            }}
          />
        ) : q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorPanel error={q.error} retry={() => void q.refetch()} />
        ) : (
          <>
            <div className="profile-heading">
              <div className="avatar">{str(q.data.firstname).slice(0, 1)}</div>
              <div>
                <h2>
                  {str(q.data.firstname)} {str(q.data.lastname)}
                </h2>
                <p>
                  {session.user?.email} · {session.user?.role.name}
                </p>
                <Badge value={session.user?.status} />
              </div>
            </div>
            <SchemaForm
              fields={[
                f("firstname", "text", true),
                f("lastname", "text", true),
                f("phone"),
                f("bio", "textarea"),
                f("qualification"),
                f("expertise_area"),
                f("years_experience", "number"),
                f("date_of_birth", "date"),
                f("gender", "select", false, ["male", "female", "other"]),
              ]}
              initial={q.data}
              submit={async (values) => {
                await request("tutor/profile", "PUT", values);
                await cache.invalidateQueries();
                await session.bootstrap();
              }}
            />
            <div className="form-section">
              <h2>Avatar & credentials</h2>
              <p>
                Credentials are stored privately. Secure retrieval is awaiting a
                backend contract.
              </p>
              {error !== undefined && <ErrorPanel error={error} />}{" "}
              {["avatar", "credential"].map((type) => (
                <label className="field" key={type}>
                  {type === "avatar"
                    ? "Profile photo (up to 2 MB)"
                    : "Credential PDF / DOC / DOCX (up to 10 MB)"}
                  <input
                    type="file"
                    accept={type === "avatar" ? "image/*" : ".pdf,.doc,.docx"}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (
                        file.size >
                        (type === "avatar" ? 2 : 10) * 1024 * 1024
                      ) {
                        setError(new Error("File exceeds the allowed size."));
                        return;
                      }
                      const body = new FormData();
                      body.append(type, file);
                      setUploadState("Uploading…");
                      try {
                        await request(
                          `tutor/profile/${type === "avatar" ? "avatar" : "credentials"}`,
                          "POST",
                          body,
                        );
                        setUploadState("Upload confirmed");
                        await cache.invalidateQueries();
                      } catch (err) {
                        setError(err);
                        setUploadState("Upload failed");
                      }
                    }}
                  />
                </label>
              ))}
              <p role="status">{uploadState}</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
