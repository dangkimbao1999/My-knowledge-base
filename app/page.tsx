import { redirect } from "next/navigation";
import { getOptionalAuth } from "@/lib/auth";

export default async function HomePage() {
  const auth = await getOptionalAuth();
  redirect(auth ? "/write" : "/auth");
}
