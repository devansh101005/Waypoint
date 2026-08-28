import type { SkillId, SkillNode } from "./types";

/**
 * The prerequisite DAG over skills.
 *
 * This is the structure the whole planner rests on: it decides which resources
 * are even eligible at each step, so it is kept as a plain in-memory index
 * (the corpus is a few hundred skills) rather than a graph database.
 */
export class SkillGraph {
  private readonly nodes: Map<SkillId, SkillNode>;
  /** skill -> direct prerequisites */
  private readonly prereqs: Map<SkillId, SkillId[]>;
  /** skill -> skills that list it as a prerequisite */
  private readonly dependents: Map<SkillId, SkillId[]>;
  private readonly ancestorCache = new Map<SkillId, Set<SkillId>>();

  constructor(skills: SkillNode[]) {
    this.nodes = new Map(skills.map((s) => [s.id, s]));
    this.prereqs = new Map();
    this.dependents = new Map();

    for (const s of skills) {
      // Ignore dangling prerequisites: the importer rejects them, so anything
      // reaching here is a partially-loaded corpus and must not crash planning.
      const valid = s.prereqs.filter((p) => this.nodes.has(p) && p !== s.id);
      this.prereqs.set(s.id, valid);
      for (const p of valid) {
        const list = this.dependents.get(p) ?? [];
        list.push(s.id);
        this.dependents.set(p, list);
      }
    }
  }

  has(id: SkillId): boolean {
    return this.nodes.has(id);
  }

  get(id: SkillId): SkillNode | undefined {
    return this.nodes.get(id);
  }

  name(id: SkillId): string {
    return this.nodes.get(id)?.name ?? id;
  }

  all(): SkillNode[] {
    return [...this.nodes.values()];
  }

  directPrereqs(id: SkillId): SkillId[] {
    return this.prereqs.get(id) ?? [];
  }

  directDependents(id: SkillId): SkillId[] {
    return this.dependents.get(id) ?? [];
  }

  /** Every skill transitively required by `id`, excluding `id` itself. */
  ancestors(id: SkillId): Set<SkillId> {
    const cached = this.ancestorCache.get(id);
    if (cached) return cached;

    const out = new Set<SkillId>();
    const stack = [...this.directPrereqs(id)];
    while (stack.length) {
      const next = stack.pop()!;
      if (out.has(next)) continue;
      out.add(next);
      stack.push(...this.directPrereqs(next));
    }
    this.ancestorCache.set(id, out);
    return out;
  }

  /**
   * Depth of `ancestor` below `id` along the shortest prerequisite chain.
   * Returns 0 for `id` itself and Infinity when unreachable. Used to weight
   * how much a distant prerequisite matters to the learner's actual goal.
   */
  depthTo(id: SkillId, ancestor: SkillId): number {
    if (id === ancestor) return 0;
    const seen = new Set<SkillId>([id]);
    let frontier = this.directPrereqs(id);
    let depth = 1;
    while (frontier.length) {
      if (frontier.includes(ancestor)) return depth;
      const next: SkillId[] = [];
      for (const f of frontier) {
        if (seen.has(f)) continue;
        seen.add(f);
        next.push(...this.directPrereqs(f));
      }
      frontier = next;
      depth++;
    }
    return Infinity;
  }

  /**
   * Prerequisites first. Throws on a cycle — the importer guarantees a DAG, so
   * reaching this means corrupt data, and silently returning a bad order would
   * produce an unlearnable path.
   */
  topoOrder(): SkillId[] {
    const indegree = new Map<SkillId, number>();
    for (const id of this.nodes.keys()) {
      indegree.set(id, this.directPrereqs(id).length);
    }
    const queue = [...indegree.entries()]
      .filter(([, d]) => d === 0)
      .map(([id]) => id);
    const order: SkillId[] = [];

    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      for (const dep of this.directDependents(id)) {
        const d = (indegree.get(dep) ?? 1) - 1;
        indegree.set(dep, d);
        if (d === 0) queue.push(dep);
      }
    }

    if (order.length !== this.nodes.size) {
      const stuck = [...this.nodes.keys()].filter((id) => !order.includes(id));
      throw new Error(
        `Skill graph contains a prerequisite cycle involving: ${stuck.join(", ")}`,
      );
    }
    return order;
  }
}

export function buildGraph(skills: SkillNode[]): SkillGraph {
  return new SkillGraph(skills);
}
