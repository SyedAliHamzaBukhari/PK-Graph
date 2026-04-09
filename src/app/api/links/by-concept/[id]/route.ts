import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const conceptId = Number(params.id);
  if (Number.isNaN(conceptId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const links = await prisma.links.findMany({
    where: {
      OR: [
        { source_concept_id: conceptId },
        { target_concept_id: conceptId },
      ],
    },
    include: {
      concepts_links_source_concept_idToconcepts: {
        select: { id: true, name: true },
      },
      concepts_links_target_concept_idToconcepts: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json({ success: true, data: links });
}
