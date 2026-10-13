import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
const storageKey = "univybe.builderOutlinePercent";
export function ResizableBuilder({
  outline,
  children,
}: {
  outline: ReactNode;
  children: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [percent, setPercent] = useState(() => {
    const saved = Number(localStorage.getItem(storageKey));
    return Number.isFinite(saved) && saved >= 20 && saved <= 50 ? saved : 25;
  });
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const available = Math.max(1, width - 16);
  const minimum = Math.max(
    20,
    (Math.min(220, available * 0.4) / available) * 100,
  );
  const maximum = Math.min(
    50,
    ((available - Math.min(320, available * 0.55)) / available) * 100,
  );
  const clamped = Math.max(minimum, Math.min(maximum, percent));
  const resize = (value: number) => {
    const next = Math.max(minimum, Math.min(maximum, value));
    setPercent(next);
    localStorage.setItem(storageKey, String(next));
  };
  return (
    <div
      ref={container}
      className={`builder resizable-builder ${dragging ? "is-resizing" : ""}`}
      style={
        {
          "--builder-columns": `minmax(0, ${clamped}fr) 16px minmax(0, ${100 - clamped}fr)`,
        } as CSSProperties
      }
    >
      {outline}
      <div
        className="builder-divider"
        role="separator"
        tabIndex={0}
        aria-label="Resize course outline"
        aria-orientation="vertical"
        aria-valuemin={Math.round(minimum)}
        aria-valuemax={Math.round(maximum)}
        aria-valuenow={Math.round(clamped)}
        aria-valuetext={`Outline ${Math.round(clamped)} percent, editor ${Math.round(100 - clamped)} percent`}
        title="Drag to resize. Use arrow keys to adjust; Home/End for limits."
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const bounds = container.current?.getBoundingClientRect();
          if (bounds)
            resize(((event.clientX - bounds.left - 8) / available) * 100);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
        onLostPointerCapture={() => setDragging(false)}
        onKeyDown={(event) => {
          const next =
            event.key === "ArrowLeft"
              ? clamped - 2
              : event.key === "ArrowRight"
                ? clamped + 2
                : event.key === "Home"
                  ? minimum
                  : event.key === "End"
                    ? maximum
                    : undefined;
          if (next !== undefined) {
            event.preventDefault();
            resize(next);
          }
        }}
      >
        <span />
      </div>
      {children}
    </div>
  );
}
