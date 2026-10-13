import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { analyticsCharts } from "./charts";
import { str, type RecordData } from "../../shared/api/client";
const colors = ["#8065e8", "#259d96", "#d49035"];
export default function AnalyticsCharts({
  data,
  view,
  admin,
}: {
  data: RecordData;
  view: string;
  admin: boolean;
}) {
  const charts = analyticsCharts(data, view, admin);
  return (
    <div className="analytics-chart-grid">
      {charts.map((chart) => (
        <section
          className="panel analytics-chart"
          key={chart.title}
          aria-label={chart.title}
        >
          <h2>{chart.title}</h2>
          <p>
            {chart.unit === "SLE"
              ? "Confirmed course sales before fees or revenue sharing."
              : view === "content-performance"
                ? "Content counts; lesson and quiz performance measurement is not yet available."
                : "For the selected period, using available observations."}
          </p>
          {chart.data.length ? (
            <>
              <div
                className="chart-canvas"
                role="img"
                aria-label={`${chart.title}. A data table follows.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  {chart.kind === "line" ? (
                    <LineChart
                      data={chart.data}
                      margin={{ top: 8, right: 16, left: 0, bottom: 16 }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                        minTickGap={24}
                      />
                      <YAxis
                        domain={chart.unit === "%" ? [0, 100] : [0, "auto"]}
                        tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface)",
                          borderColor: "var(--border)",
                          color: "var(--text)",
                        }}
                      />
                      <Legend />
                      {chart.series.map((series, i) => (
                        <Line
                          key={series.key}
                          dataKey={series.key}
                          name={series.name}
                          stroke={colors[i % colors.length]}
                          strokeWidth={2}
                          type="linear"
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  ) : (
                    <BarChart
                      data={chart.data}
                      margin={{ top: 8, right: 16, left: 0, bottom: 28 }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                        tickFormatter={(v) =>
                          str(v).length > 18
                            ? `${str(v).slice(0, 18)}…`
                            : str(v)
                        }
                      />
                      <YAxis
                        domain={chart.unit === "%" ? [0, 100] : [0, "auto"]}
                        tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface)",
                          borderColor: "var(--border)",
                          color: "var(--text)",
                        }}
                      />
                      <Legend />
                      {chart.series.map((series, i) => (
                        <Bar
                          key={series.key}
                          dataKey={series.key}
                          name={series.name}
                          fill={colors[i % colors.length]}
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                        />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              <details>
                <summary>View chart data</summary>
                <div className="chart-table custom-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Observation</th>
                        {chart.series.map((s) => (
                          <th key={s.key}>{s.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {chart.data.map((point, i) => (
                        <tr key={i}>
                          <td>{str(point.label)}</td>
                          {chart.series.map((s) => (
                            <td key={s.key}>
                              {point[s.key] === undefined
                                ? "Unavailable"
                                : str(point[s.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <p>No observations available for this chart.</p>
          )}
        </section>
      ))}
    </div>
  );
}
