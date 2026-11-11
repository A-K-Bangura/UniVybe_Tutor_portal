import { object, str, type RecordData } from "../../shared/api/client";
export function targetRestriction(
  actor: RecordData,
  target: RecordData,
  action: string,
  originalAuthority = false,
) {
  const role = str(object(target.role).name);
  if (
    target.user_type === "student" ||
    target.type === "student" ||
    role === "student"
  )
    return action === "role" ? "Student roles cannot be changed here." : "";
  if (
    str(actor.id) === str(target.id) ||
    (actor.uuid && actor.uuid === target.uuid)
  )
    return "You cannot change your own account.";
  if (target.is_original_super_admin === true)
    return "The Original Super Admin is protected.";
  if (role === "super_admin" && !originalAuthority)
    return "Only the Original Super Admin can manage this account.";
  if (
    (role === "admin" || action === "role") &&
    object(actor.role).name !== "super_admin"
  )
    return "Only a Super Admin can perform this action.";
  if (
    ["approve", "reject"].includes(action) &&
    target.status === "pending" &&
    ["admin", "super_admin"].includes(role) &&
    target.created_by != null &&
    str(target.created_by) === str(actor.id)
  )
    return "Another Super Admin must decide on an account you created.";
  return "";
}
