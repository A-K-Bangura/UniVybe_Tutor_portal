// Capture before the browser's number-input wheel action. Blurring preserves
// ordinary page/container scrolling without changing the value or input type.
export function protectNumberInputsFromWheel() {
  const onWheel = (event: WheelEvent) => {
    const input = event.target;
    if (
      input instanceof HTMLInputElement &&
      input.type === "number" &&
      input === document.activeElement
    ) {
      input.blur();
    }
  };
  document.addEventListener("wheel", onWheel, { capture: true, passive: true });
  return () => document.removeEventListener("wheel", onWheel, true);
}
