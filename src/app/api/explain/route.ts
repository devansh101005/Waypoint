import { NextResponse } from "next/server";
import { z } from "zod";
import { explainStep } from "@/lib/explain";
import { getStore } from "@/lib/store";

const bodySchema = z.object({
  pathId: z.uuid(),
  resourceId: z.string().min(1),
});

/**
 * Phrase one step of the plan.
 *
 * The model is handed only that step's reasons object — never the catalogue —
 * and its reply is rejected if it names a skill the step has nothing to do
 * with. On rejection, or if the gateway is down, a deterministic rendering of
 * the same facts is returned instead, so this endpoint always answers.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "invalid_request", detail: describe(error) },
      { status: 400 },
    );
  }

  const store = getStore();
  const path = await store.getPath(body.pathId);
  if (!path)
    return NextResponse.json({ error: "unknown_path" }, { status: 404 });

  const index = path.items.findIndex((i) => i.resource.id === body.resourceId);
  if (index === -1) {
    return NextResponse.json({ error: "not_on_this_path" }, { status: 404 });
  }

  const item = path.items[index];
  const graph = await store.graph();

  const skills = graph.all();
  const explanation = await explainStep(
    { title: item.resource.title, position: index + 1, reasons: item.reasons },
    {
      knownSkillNames: skills.map((s) => s.name),
      skillNameById: Object.fromEntries(skills.map((s) => [s.id, s.name])),
    },
  );

  return NextResponse.json(explanation);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
