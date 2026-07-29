import { NextRequest, NextResponse } from "next/server";
import { readAsset, mimeTypeForExtension } from "@/lib/content/assets";
import { InvalidPathError } from "@/lib/content/paths";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  try {
    const buffer = await readAsset(segments);
    const extension = segments[segments.length - 1].split(".").pop() ?? "";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeTypeForExtension(extension),
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    if (error instanceof InvalidPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Image introuvable" }, { status: 404 });
    }
    throw error;
  }
}
