import { NextResponse } from "next/server";
import { z } from "zod";
import { askAboutPlan } from "@/lib/ask";
import { getStore } from "@/lib/store";

const bodySchema = z.object({
  pathId: z.uuid(),
  question: z.string().min(1).max(500),
});

/** Answer a learner's question about their own plan, grounded in that plan. */
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
  if (path.items.length === 0) {
    return NextResponse.json(
      {
        error: "empty_path",
        detail: "There is no plan to answer questions about yet.",
      },
      { status: 409 },
    );
  }

  try {
    const graph = await store.graph();
    const result = await askAboutPlan(body.question, path, graph);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "assistant_unavailable",
        detail: describe(error),
        hint: "Check RIKKO_API_KEY and LLM_BASE_URL.",
      },
      { status: 502 },
    );
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
