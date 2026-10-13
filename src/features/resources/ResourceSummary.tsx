import { object, str, type RecordData } from "../../shared/api/client";
import { Badge, label } from "../../shared/ui/primitives";

export function ResourceSummary({ resource }: { resource: RecordData }) {
  const context = object(resource.academic_context),
    file = object(resource.file);
  const fields = {
    Description: resource.description,
    Author: resource.author,
    Subject: resource.subject,
    Module: resource.module,
    Source: resource.source,
    "Publication year": resource.publication_year,
    "Uploaded by": resource.uploaded_by || object(resource.creator).name,
    University: object(context.university).name,
    Faculty: object(context.faculty).name,
    Department: object(context.department).name,
    Organization: object(context.organization).name,
    "Academic level": context.level,
    Semester: context.semester,
    Tags: Array.isArray(resource.tags)
      ? resource.tags.filter((t) => typeof t === "string").join(", ")
      : undefined,
    Filename: file.original_filename,
    "File size":
      typeof file.size_bytes === "number"
        ? `${file.size_bytes.toLocaleString()} bytes`
        : undefined,
    "File version": file.version,
    Updated: str(resource.updated_at).replace("T", " ").slice(0, 19),
  };
  return (
    <div className="resource-summary">
      <strong>{str(resource.title)}</strong>
      <div className="actions">
        <Badge value={resource.status} />
        <Badge value={resource.resource_type_label || resource.resource_type} />
        <Badge value={resource.format || resource.link_type} />
        {str(resource.source_type) && (
          <span className="muted">
            {resource.source_type === "file"
              ? "Uploaded file"
              : resource.source_type === "external"
                ? "External link"
                : label(str(resource.source_type))}
          </span>
        )}
      </div>
      <p>
        {[
          str(resource.author),
          str(resource.subject),
          str(resource.module),
          str(resource.publication_year),
        ]
          .filter(Boolean)
          .join(" · ") || "No additional summary provided."}
      </p>
      <details>
        <summary>Details for {str(resource.title)}</summary>
        <dl className="data-grid">
          {Object.entries(fields)
            .filter(([, value]) => str(value))
            .map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd className="prewrap">{str(value)}</dd>
              </div>
            ))}
        </dl>
      </details>
    </div>
  );
}
