import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  Menu,
  X,
  BookOpen,
  LayoutDashboard,
  Files,
  Briefcase,
  MessageSquare,
  ShieldCheck,
  Route,
  Users,
  Building2,
  Coins,
  ChartNoAxesCombined,
  FileChartColumn,
  Activity,
  Search,
  UserRound,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useSession, can } from "../shared/auth/session";
import { queryClient } from "./query-client";
import { request, str } from "../shared/api/client";
import wordmark from "../assets/logo-word-black.webp";
import whiteWordmark from "../assets/logo-word-white.webp";
import { ThemeToggle } from "../shared/ui/ThemeToggle";
import { useAppearance } from "../shared/lib/appearance";
import { BackNavigation } from "../shared/ui/BackNavigation";
const destinations = [
  ["dashboard", "Overview", LayoutDashboard],
  ["courses", "Courses", BookOpen],
  ["resources", "Resource library", Files],
  ["opportunities", "Opportunities", Briefcase],
  ["gigs", "My gigs", Briefcase],
  ["gigs-admin", "Gig reviews", ShieldCheck],
  ["feed", "Community feed", MessageSquare],
  ["reviews", "Review queues", ShieldCheck],
  ["roadmaps", "Roadmaps", Route],
  ["users", "People", Users],
  ["universities", "Institutions", Building2],
  ["organizations", "Organizations", Building2],
  ["coins", "Vybe Coins", Coins],
  ["analytics", "Analytics", ChartNoAxesCombined],
  ["reports", "Reports", FileChartColumn],
  ["system-health", "System health", Activity],
] as const;
export function Shell() {
  const user = useSession((s) => s.user!),
    theme = useAppearance((s) => s.theme),
    clear = useSession((s) => s.clear),
    [open, setOpen] = useState(false),
    [logoutMessage, setLogoutMessage] = useState("");
  const [sidebarClosed, setSidebarClosed] = useState(
    () => localStorage.getItem("univybe.sidebarClosed") === "true",
  );
  const toggleSidebar = () =>
    setSidebarClosed((closed) => {
      localStorage.setItem("univybe.sidebarClosed", String(!closed));
      return !closed;
    });
  return (
    <div className={`app-shell ${sidebarClosed ? "sidebar-closed" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside
        id="workspace-navigation"
        aria-label="Workspace navigation"
        className={`sidebar ${open ? "mobile-open" : ""}`}
      >
        <div className="brand">
          <Link to="/dashboard">
            <img
              src={theme === "dark" ? whiteWordmark : wordmark}
              alt="UniVybe"
            />
          </Link>
          <button
            className="mobile-only"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          CREATOR WORKSPACE <span>{user.role.name}</span>
        </div>
        <nav>
          {destinations
            .filter(([area]) => can(user.role.name, area))
            .map(([area, title, Icon]) => (
              <NavLink
                key={area}
                to={
                  area === "reviews"
                    ? "/reviews/courses"
                    : area === "gigs-admin"
                      ? "/reviews/gigs"
                      : area === "coins"
                        ? "/coins/exchanges"
                        : `/${area}`
                }
                onClick={() => setOpen(false)}
              >
                <Icon size={19} />
                {title}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-bottom">
          {user.role.name === "admin" && (
            <details>
              <summary>Administration tools</summary>
              {[
                "reviews/users",
                "reviews/courses",
                "reviews/feed",
                "reviews/resources",
                "reviews/opportunities",
                "reviews/gigs",
                "gig-categories",
                "faculties",
                "departments",
                "resources/access-settings",
                "resources/purchases",
                "coins/settings",
                "coins/ledger",
              ].map((path) => (
                <NavLink
                  key={path}
                  to={"/" + path}
                  onClick={() => setOpen(false)}
                >
                  {path.replaceAll("/", " · ").replaceAll("-", " ")}
                </NavLink>
              ))}
            </details>
          )}
          <NavLink to="/profile">
            <UserRound size={18} /> Your profile
          </NavLink>
          <NavLink to="/settings/security">
            <Settings size={18} /> Security
          </NavLink>
          <button
            onClick={async () => {
              try {
                await request("tutor/auth/logout", "POST");
              } catch {
                setLogoutMessage(
                  "Signed out locally; server revocation could not be confirmed.",
                );
              }
              await queryClient.cancelQueries();
              queryClient.clear();
              clear();
            }}
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
        <small>{logoutMessage}</small>
      </aside>
      {open && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <ThemeToggle />
          <button
            className="desktop-only"
            aria-label={sidebarClosed ? "Open sidebar" : "Close sidebar"}
            aria-expanded={!sidebarClosed}
            aria-controls="workspace-navigation"
            onClick={toggleSidebar}
          >
            {sidebarClosed ? (
              <PanelLeftOpen size={20} />
            ) : (
              <PanelLeftClose size={20} />
            )}
          </button>
          <button
            className="mobile-only"
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls="workspace-navigation"
            onClick={() => setOpen(true)}
          >
            <Menu size={22} />
          </button>
          <span className="topbar-context">
            Workspace <span>/</span> {user.role.name}
          </span>
          {can(user.role.name, "search") && (
            <Link
              className="topbar-search"
              to="/search"
              aria-label="Search workspace"
            >
              <Search size={17} />
              <span>Search workspace</span>
              <kbd>⌕</kbd>
            </Link>
          )}
          <Link to="/profile" className="topbar-profile">
            <div className="avatar small">
              {str(user.firstname).slice(0, 1) || "U"}
            </div>
            <span>
              {str(user.firstname) || "Your profile"}
              <small>{user.role.name}</small>
            </span>
          </Link>
        </header>
        <main id="main">
          <BackNavigation />
          <Outlet />
        </main>
        <footer>UniVybe · A workspace for possibility.</footer>
      </div>
    </div>
  );
}
