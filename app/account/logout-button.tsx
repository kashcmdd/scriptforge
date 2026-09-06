"use client";
import { useRouter } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", headers: await csrfHeaders() });
    router.push("/");
    router.refresh();
  }

  return (
    <button className="btn-ghost" onClick={logout}>
      Log out
    </button>
  );
}