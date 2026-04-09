import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const q = typeof body.q === "string" ? body.q : "";

    const concepts = await prisma.concepts.findMany({
      where: {
        name: {
          contains: q,
        },
      },
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json({ data: concepts }, { status: 200 });
  } catch (err) {
    console.error("search concepts error:", err);
    return NextResponse.json(
      { error: "search failed" },
      { status: 500 }
    );
  }
}
