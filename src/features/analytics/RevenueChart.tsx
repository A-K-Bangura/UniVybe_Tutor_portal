import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { str, type RecordData } from "../../shared/api/client";
export default function RevenueChart({ data }: { data: RecordData[] }) {
  return (
    <section className="panel">
      <h2>Gross course sales by payment date (SLE)</h2>
      <p>Only dates returned by the server are plotted.</p>
      {data.length ? (
        <>
          <div
            style={{ height: 260, width: "100%" }}
            aria-label="Gross course sales chart"
          >
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid stroke="#edf0f5" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="linear"
                  dataKey="revenue"
                  name="Gross sales (SLE)"
                  stroke="#5b3fd1"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details>
            <summary>View chart data</summary>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Gross sales (SLE)</th>
                  <th>Confirmed payments</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={str(row.date)}>
                    <td>{str(row.date)}</td>
                    <td>{str(row.revenue)}</td>
                    <td>{str(row.payments_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : (
        <p>No course payments returned for this period.</p>
      )}
    </section>
  );
}
