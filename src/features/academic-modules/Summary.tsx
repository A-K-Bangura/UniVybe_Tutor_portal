import { object } from "../../shared/api/client";
import { moduleLabel } from "./api";
export function AcademicModuleSummary({ value }: { value: unknown }) {
  const module = object(value),
    label = moduleLabel(module);
  return label ? (
    <span className="academic-module-summary">
      {label}
      {module.is_active === false && <span className="badge">Retired</span>}
    </span>
  ) : null;
}
