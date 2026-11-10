import { object, rows, str, type RecordData } from "../../shared/api/client";

export default function RoutingSummary({ data }: { data: RecordData }) {
  const totals = object(data.totals);
  return (
    <section
      className="guidance-routing-summary"
      aria-labelledby="routing-summary-title"
    >
      <div className="guidance-routing-heading">
        <h2 id="routing-summary-title">Contacts provided</h2>
        <p>Assignments matching your current filters.</p>
      </div>
      <dl className="guidance-metrics">
        {[
          ["routed", "Total contacts"],
          ["to_guides", "Connected to guides"],
          ["to_central", "Central contact"],
          ["general", "Get Help requests"],
          ["onboarding", "Onboarding requests"],
        ].map(([key, label]) => (
          <div
            className={`panel guidance-metric${key === "routed" ? " guidance-metric-total" : ""}`}
            key={key}
          >
            <dt>{label}</dt>
            <dd>{str(totals[key]) || "0"}</dd>
          </div>
        ))}
      </dl>
      <div className="guidance-breakdowns">
        {[
          ["by_category", "Question categories", "No categories recorded."],
          ["by_guide", "Guide assignments", "No guide assignments recorded."],
          ["by_match_tier", "Matching breakdown", "No matches recorded."],
        ].map(([key, title, empty]) => (
          <section className="panel" key={key}>
            <h3>{title}</h3>
            {rows(data[key]).length ? (
              <ul>
                {rows(data[key]).map((row, i) => (
                  <li key={i}>
                    <span>
                      {str(object(row.category ?? row.guide).name) ||
                        str(row.match_tier).replaceAll("_", " ") ||
                        "Unavailable"}
                    </span>
                    <strong>{str(row.count)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="guidance-breakdown-empty">{empty}</p>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
