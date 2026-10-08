import { redirect } from "next/navigation";

/** Connecting an agent now happens in the dashboard, behind a sign-in. */
export default function ConnectPage(): never {
  redirect("/dashboard/agents");
}
