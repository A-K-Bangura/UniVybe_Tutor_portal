import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  ArrowUpRight,
  Files,
  Briefcase,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { useSession, can } from "../../shared/auth/session";
import { request, object, str } from "../../shared/api/client";
import {
  Header,
  Loading,
  ErrorPanel,
  DataView,
} from "../../shared/ui/primitives";
export default function Dashboard() {
  const user = useSession((s) => s.user!),
    role = user.role.name,
    admin = ["admin", "moderator"].includes(role),
    contributor = role === "contributor";
  const endpoint = contributor
    ? "tutor/feed/stats"
    : `${admin ? "admin" : "tutor"}/analytics/dashboard`;
  const q = useQuery({
    queryKey: ["dashboard", role],
    queryFn: async ({ signal }) =>
      object((await request(endpoint, "GET", undefined, signal)).data),
  });
  const sourceMetrics = object(
    q.data?.[contributor ? "stats" : admin ? "platform" : "teaching"],
  );
  const metrics = admin
    ? {
        ...object(sourceMetrics.user_metrics),
        ...object(sourceMetrics.content_metrics),
        ...sourceMetrics,
      }
    : sourceMetrics;
  const pairs = Object.entries(metrics)
    .filter(([, v]) => typeof v === "number")
    .slice(0, 4);
  return (
    <>
      <Header
        title={`Good to see you, ${str(user.firstname) || "creator"}.`}
        subtitle="A space to make progress, share what you know, and open new doors."
      />
      <section className="welcome">
        <div>
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h2>
            Small lessons.
            <br />
            Lasting possibilities.
          </h2>
          <p>Turn your knowledge into something learners can carry forward.</p>
          <Link
            className="button primary"
            to={
              can(role, "courses")
                ? "/courses/new"
                : contributor
                  ? "/feed/new"
                  : "/analytics"
            }
          >
            {can(role, "courses")
              ? "Create a course"
              : contributor
                ? "Share with the community"
                : "Explore platform insights"}
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="art-orbit" />
          <BookOpen size={76} />
          <span className="art-pill">Ideas worth sharing ✧</span>
        </div>
      </section>
      <section className="metric-grid">
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorPanel error={q.error} retry={() => void q.refetch()} />
        ) : (
          pairs.map(([key, value]) => (
            <div className="metric" key={key}>
              <span>{key.replaceAll("_", " ")}</span>
              <strong>{str(value)}</strong>
              <small>Latest workspace totals</small>
            </div>
          ))
        )}
      </section>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-heading">
            <h2>Your workspace</h2>
            <span className="muted">Make your next move</span>
          </div>
          {[
            {
              area: "courses",
              title: "Courses",
              description: "Build focused learning experiences",
              icon: BookOpen,
            },
            {
              area: "resources",
              title: "Resource library",
              description: "Give learners useful materials",
              icon: Files,
            },
            {
              area: "opportunities",
              title: "Opportunities",
              description: "Connect learners to what’s next",
              icon: Briefcase,
            },
            {
              area: "feed",
              title: "Community feed",
              description: "Share ideas with the community",
              icon: MessageSquare,
            },
            {
              area: "reviews",
              title: "Review queues",
              description: "Help good work reach learners",
              icon: ShieldCheck,
            },
          ]
            .filter((x) => can(role, x.area))
            .map((x) => (
              <Link
                className="workspace-link"
                key={x.area}
                to={x.area === "reviews" ? "/reviews/courses" : `/${x.area}`}
              >
                <div className="shortcut-icon">
                  <x.icon size={22} />
                </div>
                <div>
                  <strong>{x.title}</strong>
                  <p>{x.description}</p>
                </div>
                <ArrowUpRight size={18} />
              </Link>
            ))}
        </section>
        <section className="panel">
          <h2>At a glance</h2>
          <p className="muted">
            {contributor
              ? "See how your contributions reach the community."
              : admin
                ? "Keep track of activity across your workspace."
                : "Follow the progress of your teaching and course sales."}
          </p>
          {q.data && (
            <DataView
              value={
                contributor
                  ? q.data.stats
                  : admin
                    ? q.data.realtime
                    : object(q.data.teaching).revenue
              }
            />
          )}
          <Link className="text-link" to={contributor ? "/feed" : "/analytics"}>
            Explore details ↗
          </Link>
        </section>
      </div>
    </>
  );
}
