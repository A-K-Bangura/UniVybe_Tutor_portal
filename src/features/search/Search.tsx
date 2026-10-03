import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "../../shared/auth/session";
import { request, object, rows, str } from "../../shared/api/client";
import {
  Header,
  Loading,
  ErrorPanel,
  DataView,
} from "../../shared/ui/primitives";
export default function Search() {
  const role = useSession((s) => s.user!.role.name),
    prefix = ["admin", "moderator"].includes(role) ? "admin" : "tutor",
    [text, setText] = useState(""),
    [debounced, setDebounced] = useState(""),
    [offset, setOffset] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(text);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [text]);
  const q = useQuery({
    queryKey: ["search", prefix, debounced, offset],
    queryFn: async ({ signal }) =>
      object(
        (
          await request(
            `${prefix}/search?q=${encodeURIComponent(debounced)}&limit=15&offset=${offset}`,
            "GET",
            undefined,
            signal,
          )
        ).data,
      ),
    enabled: debounced.length > 1,
  });
  return (
    <>
      <Header
        title="Search the workspace"
        subtitle="Search supported courses, people, and feed posts. Resources and opportunities have their own collection search."
      />
      <div className="toolbar">
        <input
          className="wide-input"
          aria-label="Search query"
          placeholder="What are you looking for?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      {debounced.length > 1 &&
        (q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorPanel error={q.error} />
        ) : (
          <div className="panel">
            <p>{str(q.data.total_count)} results</p>
            {rows(q.data.results).map((r, i) => (
              <div className="data-row" key={i}>
                <DataView value={r} />
              </div>
            ))}
            <button
              disabled={!q.data.has_more}
              onClick={() => setOffset(offset + 15)}
            >
              More results
            </button>
          </div>
        ))}
    </>
  );
}
