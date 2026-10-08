import { redirect } from "next/navigation";

/** Publishing now happens in the dashboard, behind a sign-in. */
export default function PublishPage(): never {
  redirect("/dashboard/apis");
}
