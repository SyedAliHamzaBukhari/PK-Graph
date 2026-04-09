import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { source_concept_id, target_concept_id, relationship_type, strength } =
      await req.json();

    if (!source_concept_id || !target_concept_id) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }

    const link = await prisma.links.create({
      data: {
        source_concept_id: Number(source_concept_id),
        target_concept_id: Number(target_concept_id),
        relationship_type: relationship_type ?? "related_to",
        strength: strength ?? 0.5,
      },
    });

    await prisma.concept_summaries.updateMany({
       where: { concept_id: { in: [Number(source_concept_id), Number(target_concept_id)] } },
       data: { link_count: { increment: 1 } },
    });

    return NextResponse.json(link, { status: 201 });
  } catch (e) {
    console.error("create link failed:", e);
    return NextResponse.json({ error: "create failed" }, { status: 500 });
  }
}
