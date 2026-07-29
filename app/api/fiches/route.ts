import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createFiche } from "@/lib/content/fs";
import { InvalidPathError } from "@/lib/content/paths";
import { reindexAll } from "@/lib/db/search";

const createSchema = z.object({
  folder: z.array(z.string()).default([]),
  title: z.string().min(1),
  content: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const { folder, title, content } = parsed.data;
  const initialContent = content && content.trim().length > 0 ? content : `# ${title}\n`;

  try {
    const path = await createFiche(folder, title, initialContent);
    await reindexAll();
    return NextResponse.json({ path });
  } catch (error) {
    if (error instanceof InvalidPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
