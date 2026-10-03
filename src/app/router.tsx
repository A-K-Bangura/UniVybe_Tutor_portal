import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useRouteError,
} from "react-router-dom";
import { useSession, can } from "../shared/auth/session";
import { Auth, AccountStatus, Onboarding } from "../features/auth/Auth";
import { Shell } from "./Shell";
import { Loading, ErrorPanel } from "../shared/ui/primitives";
const Dashboard = lazy(() => import("../features/dashboard/Dashboard")),
  Collection = lazy(() => import("../features/catalog/Collection")),
  Editor = lazy(() => import("../features/catalog/Editor")),
  Profile = lazy(() => import("../features/profile/Profile")),
  Coins = lazy(() => import("../features/coins/Coins")),
  Insights = lazy(() => import("../features/analytics/Insights")),
  Search = lazy(() => import("../features/search/Search")),
  ResourceSettings = lazy(() => import("../features/resources/Settings"));
function Guard({ area }: { area?: string }) {
  const s = useSession();
  if (s.state === "booting") return <Loading />;
  if (s.state === "anonymous") return <Navigate to="/login" replace />;
  if (s.state === "onboarding") return <Navigate to="/onboarding" replace />;
  if (s.state === "restricted" || s.state === "unavailable")
    return <Navigate to="/account-status" replace />;
  if (area && !can(s.user!.role.name, area))
    return (
      <div className="center-state">
        <h1>Access restricted</h1>
        <p>Your role does not have access to this workspace.</p>
      </div>
    );
  return (
    <Suspense fallback={<Loading />}>
      <Outlet />
    </Suspense>
  );
}
function RouteError() {
  const error = useRouteError();
  return <ErrorPanel error={error} />;
}
const kinds = [
  "courses",
  "resources",
  "opportunities",
  "feed",
  "users",
  "roadmaps",
  "universities",
  "faculties",
  "departments",
  "organizations",
];
export const router = createBrowserRouter([
  { path: "/login", element: <Auth />, errorElement: <RouteError /> },
  { path: "/signup", element: <Auth signup /> },
  { path: "/onboarding", element: <Onboarding /> },
  { path: "/account-status", element: <AccountStatus /> },
  {
    element: <Guard />,
    errorElement: <RouteError />,
    children: [
      {
        element: <Shell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "dashboard", element: <Dashboard /> },
          ...kinds.map((kind) => ({
            element: <Guard area={kind} />,
            children: [
              { path: kind, element: <Collection kind={kind} /> },
              { path: `${kind}/new`, element: <Editor kind={kind} /> },
              { path: `${kind}/:id`, element: <Editor kind={kind} /> },
            ],
          })),
          {
            element: <Guard area="reviews" />,
            children: [
              "users",
              "courses",
              "resources",
              "opportunities",
              "feed",
            ].map((kind) => ({
              path: `reviews/${kind}`,
              element: <Collection kind={kind} review />,
            })),
          },
          {
            element: <Guard area="coins" />,
            children: [
              { path: "coins/settings", element: <Coins view="settings" /> },
              { path: "coins/exchanges", element: <Coins view="exchanges" /> },
              {
                path: "coins/exchanges/:id",
                element: <Coins view="exchanges" />,
              },
              { path: "coins/ledger", element: <Coins view="ledger" /> },
            ],
          },
          {
            element: <Guard area="resources-admin" />,
            children: [
              {
                path: "resources/access-settings",
                element: <ResourceSettings />,
              },
              {
                path: "resources/purchases",
                element: <ResourceSettings purchases />,
              },
            ],
          },
          {
            element: <Guard area="analytics" />,
            children: [
              { path: "analytics", element: <Insights view="analytics" /> },
              {
                path: "courses/:id/analytics",
                element: <Insights view="course" />,
              },
            ],
          },
          {
            element: <Guard area="reports" />,
            children: [
              { path: "reports", element: <Insights view="reports" /> },
            ],
          },
          {
            element: <Guard area="system-health" />,
            children: [
              {
                path: "system-health",
                element: <Insights view="system-health" />,
              },
            ],
          },
          {
            element: <Guard area="search" />,
            children: [{ path: "search", element: <Search /> }],
          },
          { path: "profile", element: <Profile /> },
          { path: "settings/security", element: <Profile security /> },
          {
            path: "*",
            element: (
              <div className="center-state">
                <h1>Page not found</h1>
                <a href="/dashboard">Return to workspace</a>
              </div>
            ),
          },
        ],
      },
    ],
  },
]);
