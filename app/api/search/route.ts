import { NextRequest, NextResponse } from "next/server";
import { searchFiches } from "@/lib/db/search";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const results = searchFiches(query);
  return NextResponse.json({ results });
}
