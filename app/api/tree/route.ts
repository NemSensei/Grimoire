import { NextResponse } from "next/server";
import { listTree } from "@/lib/content/fs";

export async function GET() {
  const tree = await listTree();
  return NextResponse.json({ tree });
}
