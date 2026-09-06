import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import EditForm from "../edit-form";

export default async function EditScriptPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const script = db
    .prepare("SELECT id, title, game, description, body, version, created_by FROM scripts WHERE id = ?")
    .get(id) as
    | {
        id: number;
        title: string;
        game: string;
        description: string | null;
        body: string;
        version: number;
        created_by: number | null;
      }
    | undefined;

  if (!script) notFound();

  if (!isAdmin(session.email) && script.created_by !== session.userId) {
    redirect(`/scripts/${id}`);
  }

  return <EditForm script={script} />;
}