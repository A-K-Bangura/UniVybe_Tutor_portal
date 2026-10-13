import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
export function BackNavigation() {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  let to = `/${parts.slice(0, -1).join("/")}`;
  let label: string;
  if (parts[0] === "reviews") {
    to = "/dashboard";
    label = "Back to overview";
  } else if (parts[0] === "coins" && parts.length === 2) {
    to = parts[1] === "exchanges" ? "/dashboard" : "/coins/exchanges";
    label =
      parts[1] === "exchanges" ? "Back to overview" : "Back to exchange queue";
  } else if (parts[0] === "settings") {
    to = "/profile";
    label = "Back to profile";
  } else if (parts[0] === "courses" && parts.length === 3)
    label = "Back to course";
  else if (parts[0] === "coins") label = "Back to exchange queue";
  else label = `Back to ${parts[0] === "feed" ? "community feed" : parts[0]}`;
  // Parent links work after direct entry and remain subject to the router's dirty-form blocker.
  return (
    <nav className="back-navigation" aria-label="Back navigation">
      <Link to={to}>
        <ArrowLeft size={16} />
        {label}
      </Link>
    </nav>
  );
}
