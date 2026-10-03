import { str, object, rows, type RecordData } from "../../shared/api/client";
import { Badge } from "../../shared/ui/primitives";
export function OpportunityPreview({ data }: { data: RecordData }) {
  const cover = object(data.cover_image);
  return (
    <div className="opportunity-preview">
      {str(cover.url) && (
        <img className="preview-image" src={str(cover.url)} alt="" />
      )}
      <Badge
        value={
          data.is_open === true
            ? "open"
            : data.is_open === false
              ? "closed"
              : data.status
        }
      />
      <h2>{str(data.title)}</h2>
      <p>{str(data.short_description)}</p>
      <p>
        {str(data.organization_name)} · {str(data.location)}
      </p>
      <p>
        Application deadline: {str(data.application_deadline) || "No deadline"}
      </p>
      {data.closed_reason != null && (
        <p>{str(data.closed_reason).replaceAll("_", " ")}</p>
      )}
      {["description", "eligibility", "requirements", "contact_information"]
        .filter((key) => data[key])
        .map((key) => (
          <section key={key}>
            <h3>{key.replaceAll("_", " ")}</h3>
            <p className="prewrap">{str(data[key])}</p>
          </section>
        ))}
      <div className="actions">
        {rows(data.actions)
          .filter((action) => {
            try {
              const url = new URL(str(action.url));
              return (
                ["http:", "https:"].includes(url.protocol) &&
                !url.username &&
                !url.password
              );
            } catch {
              return false;
            }
          })
          .map((action, i) => (
            <a
              className={`button ${action.is_primary === true ? "primary" : ""}`}
              key={i}
              href={str(action.url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {str(action.label || action.type)} ↗
            </a>
          ))}
      </div>
    </div>
  );
}
