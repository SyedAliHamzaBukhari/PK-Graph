import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const conceptId = Number(params.id);

if (Number.isNaN(conceptId)) {
  return NextResponse.json({ error: "invalid id" }, { status: 400 });
}

const notes = await prisma.notes.findMany({
  where: { concept_id: conceptId },
});


  return NextResponse.json(notes);
}
