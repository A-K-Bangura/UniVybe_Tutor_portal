import {
  object,
  page,
  request,
  rows,
  str,
  type RecordData,
} from "../../shared/api/client";
export const guidePath = "tutor/guidance/guides";
export const adminPath = "admin/guidance";
export const key = (value: unknown) => encodeURIComponent(str(value));
export async function lookup(path: string, signal?: AbortSignal) {
  const result: RecordData[] = [];
  for (let index = 1, last = 1; index <= last; index++) {
    const data = page(
      await request(
        `${path}?per_page=50&page=${index}`,
        "GET",
        undefined,
        signal,
        true,
      ),
    );
    result.push(...data.items);
    last = data.last;
  }
  return result;
}
export function coveragePayload(values: RecordData[]) {
  return values.map((value) =>
    value.scope === "platform" || value.all_universities === true
      ? { all_universities: true }
      : Object.fromEntries(
          ["university", "faculty", "department"].flatMap((name) => {
            const id = value[`${name}_id`] ?? object(value[name]).id;
            return id ? [[`${name}_id`, Number(id)]] : [];
          }),
        ),
  );
}
export function guideDefaults(guide: RecordData): RecordData {
  const pending = object(guide.pending_changes);
  return {
    name: pending.name ?? guide.name ?? "",
    whatsapp_number: pending.whatsapp_number ?? guide.whatsapp_number ?? "",
    description: guide.description ?? "",
    category_ids: rows(pending.categories ?? guide.categories).map((c) =>
      Number(c.id),
    ),
    coverage: rows(pending.coverage ?? guide.coverage),
  };
}
export function guidePayload(
  values: RecordData,
  initial: RecordData,
  creating: boolean,
) {
  const result: RecordData = {};
  for (const name of [
    "name",
    "whatsapp_number",
    "description",
    "category_ids",
    "coverage",
  ]) {
    const value =
      name === "coverage" ? coveragePayload(rows(values[name])) : values[name];
    const original =
      name === "coverage"
        ? coveragePayload(rows(initial[name]))
        : initial[name];
    if (creating || JSON.stringify(value) !== JSON.stringify(original))
      result[name] = value;
  }
  if (values.consent_confirmed === true) result.consent_confirmed = true;
  return result;
}
