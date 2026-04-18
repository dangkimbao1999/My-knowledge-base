"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    setIsSubmitting(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST"
      });
    } finally {
      router.push("/auth");
      router.refresh();
      setIsSubmitting(false);
    }
  }

  return (
    <button className="button-ghost" type="button" onClick={handleLogout} disabled={isSubmitting}>
      {isSubmitting ? "Leaving..." : "Logout"}
    </button>
  );
}
