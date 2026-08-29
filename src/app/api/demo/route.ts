import { NextResponse } from "next/server";
import { z } from "zod";
import { serialisePath } from "@/lib/serialise";
import { generatePath, masteryFromIntake } from "@/lib/service";
import { getStore } from "@/lib/store";

/**
 * Create a learner from explicit skill slugs and plan for them, skipping the
 * language model entirely.
 *
 * This exists so the planner and the whole path UI can be driven — and
 * demonstrated — with no API key and no database. It is also what the
 * browser-level verification drives, so the tests of the user journey do not
 * depend on a third-party gateway being up.
 */

const skillRef = z.object({
  skillId: z.string().min(1),
  level: z.number().int().min(1).max(5),
});

const bodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  goalText: z.string().max(500).optional(),
  goalSkills: z.array(skillRef).min(1).max(10),
  statedSkills: z.array(skillRef).max(50).optional(),
  hoursPerWeek: z.number().positive().max(80).optional(),
  deadlineWeeks: z.number().positive().max(260).optional(),
});

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
  const graph = await store.graph();

  const unknown = [...body.goalSkills, ...(body.statedSkills ?? [])]
    .map((s) => s.skillId)
    .filter((id) => !graph.has(id));
  if (unknown.length > 0) {
    return NextResponse.json(
      {
        error: "unknown_skills",
        detail: `Not in the skill graph: ${unknown.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const statedSkills = body.statedSkills ?? [];
  const learner = await store.createLearner({
    name: body.name ?? "Demo learner",
    goalText: body.goalText ?? "",
    goalSummary: body.goalText ?? "",
    goalSkills: body.goalSkills,
    statedSkills,
    mastery: masteryFromIntake(statedSkills),
    constraints: {
      ...(body.hoursPerWeek ? { hoursPerWeek: body.hoursPerWeek } : {}),
      ...(body.deadlineWeeks ? { deadlineWeeks: body.deadlineWeeks } : {}),
    },
  });

  try {
    const result = await generatePath(store, learner);
    return NextResponse.json(serialisePath(result, graph));
  } catch (error) {
    return NextResponse.json(
      { error: "planning_failed", detail: describe(error) },
      { status: 500 },
    );
  }
}

/** The skill catalogue, so the demo UI can offer real goals to pick from. */
export async function GET() {
  const store = getStore();
  const graph = await store.graph();
  const resources = await store.resources();

  const taught = new Set(
    resources.flatMap((r) => r.teaches.map((t) => t.skillId)),
  );

  return NextResponse.json({
    storeKind: store.kind,
    resourceCount: resources.length,
    skills: graph
      .all()
      .map((s) => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        prereqCount: graph.directPrereqs(s.id).length,
        teachable: taught.has(s.id),
      }))
      .sort(
        (a, b) =>
          a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name),
      ),
  });
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
