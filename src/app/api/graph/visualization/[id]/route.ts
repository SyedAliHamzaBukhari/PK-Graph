import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, context: any) {
  try {
    const { params } = await context!;
    const rawId = params?.id;
    if (!rawId) {
      return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
    }

    const rootId = Number(rawId);
    if (Number.isNaN(rootId)) {
      return NextResponse.json({ success: false, error: "invalid id" }, { status: 400 });
    }

    // parse depth from query string, default 1, cap to avoid runaway queries
    const url = new URL(req.url);
    let depth = Number(url.searchParams.get("depth") ?? "1");
    if (Number.isNaN(depth) || depth < 1) depth = 1;
    if (depth > 5) depth = 5; // safety cap

    // BFS-like expansion: start from rootId and expand up to `depth` hops
    const visited = new Set<number>([rootId]);
    let frontier = [rootId];
    const collectedLinks: Array<any> = [];

    for (let level = 0; level < depth; level++) {
      if (frontier.length === 0) break;

      // find links where either end is in the current frontier
      const found = await prisma.links.findMany({
        where: {
          OR: [
            { source_concept_id: { in: frontier } },
            { target_concept_id: { in: frontier } }
          ]
        },
        orderBy: { strength: "desc" },
      });

      // add new links (dedupe by id) and gather newly discovered node ids
      const beforeLinkIds = new Set(collectedLinks.map((l) => l.id));
      const newlyDiscovered = new Set<number>();
      for (const l of found) {
        if (!beforeLinkIds.has(l.id)) collectedLinks.push(l);
        if (!visited.has(l.source_concept_id)) newlyDiscovered.add(l.source_concept_id);
        if (!visited.has(l.target_concept_id)) newlyDiscovered.add(l.target_concept_id);
      }

      // update visited and set new frontier
      for (const n of newlyDiscovered) visited.add(n);
      frontier = Array.from(newlyDiscovered);
    }

    // fetch all concept rows for visited ids
    const idsArray = Array.from(visited);
    const concepts = await prisma.concepts.findMany({
      where: { id: { in: idsArray } },
      select: { id: true, name: true, type: true },
    });

    // map to nodes/edges expected by the UI (ids as strings)
    const nodes = concepts.map((c) => ({
      data: {
        id: String(c.id),
        label: c.name,
        type: c.type ?? "concept",
        root: c.id === rootId,
      },
    }));

    // dedupe edges (just in case) and format
    const edgeMap = new Map<string, any>();
    for (const l of collectedLinks) {
      const edgeId = `link-${l.id}`;
      if (!edgeMap.has(edgeId)) {
        edgeMap.set(edgeId, {
          data: {
            id: edgeId,
            source: String(l.source_concept_id),
            target: String(l.target_concept_id),
            label: l.relationship_type ?? "related_to",
            strength: Number(l.strength ?? 0.5),
          },
        });
      }
    }
    const edges = Array.from(edgeMap.values());

    return NextResponse.json({ success: true, data: { nodes, edges } }, { status: 200 });
  } catch (err) {
    console.error("graph visualization error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
