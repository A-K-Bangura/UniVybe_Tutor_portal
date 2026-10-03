import { f } from "../courses/fields";
export const opportunityFields = [
  f("title", "text", true),
  f("short_description", "textarea", true),
  f("opportunity_type", "select", true),
  f("description", "textarea"),
  f("organization_name"),
  f("eligibility", "textarea"),
  f("requirements", "textarea"),
  f("contact_information", "textarea"),
  f("location"),
  f("start_date", "date"),
  f("end_date", "date"),
  {
    ...f("application_deadline", "date"),
    help: "Date-only deadlines close at the end of the day in Sierra Leone. Event dates do not close applications.",
  },
  f("tags", "array"),
];
