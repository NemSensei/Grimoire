import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { acquireOrRefreshLock, releaseLock } from "@/lib/content/edit-locks";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const { username } = await requireUser();

  const result = acquireOrRefreshLock(segments, username);
  if (!result.ok) {
    return NextResponse.json({ heldBy: result.heldBy }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const { username } = await requireUser();

  releaseLock(segments, username);
  return NextResponse.json({ ok: true });
}
