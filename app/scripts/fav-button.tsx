"use client";
import { useState } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

export default function FavButton({
  scriptId,
  initial,
}: {
  scriptId: number;
  initial: boolean;
}) {
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/favorite`, {
        method: "POST",
        headers: await csrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ favorited: !fav }),
      });
      if (res.ok) {
        const data = await res.json();
        setFav(data.favorited === true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`btn-icon${fav ? " is-fav" : ""}`}
      onClick={toggle}
      disabled={busy}
      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={fav}
    >
      {fav ? "★" : "☆"}
    </button>
  );
}