import re, sys
from collections import defaultdict
from skills_data import SKILLS
from resources_ds import RESOURCES_DS
from resources_wd import RESOURCES_WD
from scenarios_data import SCENARIOS

RESOURCES = RESOURCES_DS + RESOURCES_WD
errors, warnings = [], []
E, W = errors.append, warnings.append

SLUG_RE = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
DOMAINS = {"data-science", "web-dev"}
TYPES = {"course", "video", "article", "project", "assessment"}


def parse_levels(s, field, rowid):
    """Parse 'slug:level, slug:level' into dict."""
    out = {}
    if not s or not s.strip():
        return out
    for part in s.split(","):
        part = part.strip()
        if not part:
            continue
        if ":" not in part:
            E(f"{rowid} {field}: '{part}' is missing a :level suffix")
            continue
        slug, lvl = part.rsplit(":", 1)
        slug, lvl = slug.strip(), lvl.strip()
        if not lvl.isdigit() or not (1 <= int(lvl) <= 5):
            E(f"{rowid} {field}: level '{lvl}' for '{slug}' must be a whole number 1-5")
            continue
        if slug in out:
            E(f"{rowid} {field}: '{slug}' listed twice")
        out[slug] = int(lvl)
    return out


# ---------------- SKILLS ----------------
slug_set, skill_rows = set(), {}
for i, (slug, name, domain, prereqs, desc) in enumerate(SKILLS, start=2):
    rid = f"Skills row {i} ({slug})"
    if not SLUG_RE.match(slug):
        E(f"{rid}: slug must be lowercase words joined by hyphens")
    if slug in slug_set:
        E(f"{rid}: duplicate slug")
    if domain not in DOMAINS:
        E(f"{rid}: domain '{domain}' is not data-science or web-dev")
    if not desc.strip():
        E(f"{rid}: empty description")
    if slug in prereqs:
        E(f"{rid}: skill lists itself as its own prerequisite")
    slug_set.add(slug)
    skill_rows[slug] = (name, domain, prereqs, desc)

for slug, (_, _, prereqs, _) in skill_rows.items():
    for p in prereqs:
        if p not in slug_set:
            E(f"Skills '{slug}': prereq '{p}' does not exist in the Skills tab")

# cycle detection (DFS)
WHITE, GREY, BLACK = 0, 1, 2
color = defaultdict(int)
cycles = []


def dfs(node, stack):
    color[node] = GREY
    stack.append(node)
    for nxt in skill_rows.get(node, (None, None, [], None))[2]:
        if nxt not in skill_rows:
            continue
        if color[nxt] == GREY:
            cycles.append(" -> ".join(stack[stack.index(nxt):] + [nxt]))
        elif color[nxt] == WHITE:
            dfs(nxt, stack)
    stack.pop()
    color[node] = BLACK


for s in skill_rows:
    if color[s] == WHITE:
        dfs(s, [])
for c in cycles:
    E(f"Skills: circular prerequisite chain: {c}")

# transitive closure of prereqs, for depth reporting
def all_prereqs(slug, seen=None):
    seen = seen or set()
    for p in skill_rows.get(slug, (None, None, [], None))[2]:
        if p not in seen and p in skill_rows:
            seen.add(p)
            all_prereqs(p, seen)
    return seen


# ---------------- RESOURCES ----------------
ids, urls = set(), {}
res_rows = {}
taught_by = defaultdict(list)
for i, r in enumerate(RESOURCES, start=2):
    (rid_, title, url, provider, rtype, desc, diff, hours,
     taught_s, req_s, quality, notes) = r
    rid = f"Resources row {i} ({rid_})"
    if not re.match(r'^RES-\d{3}$', rid_):
        E(f"{rid}: id must be RES- plus three digits")
    if rid_ in ids:
        E(f"{rid}: duplicate id")
    ids.add(rid_)
    if url in urls:
        E(f"{rid}: duplicate url — already used on {urls[url]}")
    urls[url] = rid_
    if not url.startswith("https://"):
        E(f"{rid}: url must start with https://")
    if rtype not in TYPES:
        E(f"{rid}: type '{rtype}' is not one of {sorted(TYPES)}")
    if not isinstance(diff, int) or not (1 <= diff <= 5):
        E(f"{rid}: difficulty must be a whole number 1-5")
    if not isinstance(hours, int) or hours <= 0:
        E(f"{rid}: est_hours must be a positive whole number")
    if not isinstance(quality, int) or not (1 <= quality <= 5):
        E(f"{rid}: quality must be a whole number 1-5")
    wc = len(desc.split())
    if wc < 15:
        W(f"{rid}: description is only {wc} words — brief asks for 2-4 sentences")

    taught = parse_levels(taught_s, "skills_taught", rid)
    req = parse_levels(req_s, "skills_required", rid)
    if not taught:
        E(f"{rid}: teaches no skills — it can never be recommended")
    for s in list(taught) + list(req):
        if s not in slug_set:
            E(f"{rid}: unknown skill slug '{s}' — add it to the Skills tab first")
    for s in taught:
        if s in req and taught[s] <= req[s]:
            E(f"{rid}: teaches '{s}' at {taught[s]} but requires it at {req[s]} — "
              f"taught level must be higher")
    for s in taught:
        taught_by[s].append(rid_)
    res_rows[rid_] = {"title": title, "taught": taught, "req": req,
                      "hours": hours, "difficulty": diff, "type": rtype}

for s in slug_set:
    if not taught_by[s]:
        E(f"Coverage: skill '{s}' is taught by no resource — no path can ever pass through it")

# soft check: is a resource's own requirement consistent with the skill DAG
for rid_, row in res_rows.items():
    for s in row["req"]:
        missing = all_prereqs(s) - set(row["req"]) - set(row["taught"])
        deep = {m for m in missing if not taught_by[m]}
        if deep:
            W(f"{rid_}: requires '{s}' whose upstream prereqs {sorted(deep)} are untaught")


# ---------------- SCENARIOS ----------------
scn_ids = set()
for i, (sid, persona, background, stated_s, goal, path_s, rationale, hpw) in enumerate(SCENARIOS, start=2):
    rid = f"Scenarios row {i} ({sid})"
    if not re.match(r'^SCN-\d{2}$', sid):
        E(f"{rid}: scenario_id must be SCN- plus two digits")
    if sid in scn_ids:
        E(f"{rid}: duplicate scenario_id")
    scn_ids.add(sid)
    if not isinstance(hpw, int) or hpw <= 0:
        E(f"{rid}: hours_per_week must be a positive whole number")
    sents = len([x for x in re.split(r'[.!?]', background) if x.strip()])
    if sents < 3:
        W(f"{rid}: background is {sents} sentences — brief asks for 3-5")

    stated = parse_levels(stated_s, "stated_skills", rid)
    for s in stated:
        if s not in slug_set:
            E(f"{rid}: stated_skills references unknown slug '{s}'")

    path = [p.strip() for p in path_s.split(",") if p.strip()]
    if len(path) < 6 or len(path) > 12:
        W(f"{rid}: expert_path has {len(path)} resources — brief suggests 6-12")
    if len(set(path)) != len(path):
        E(f"{rid}: expert_path contains a duplicate resource id")
    for p in path:
        if p not in res_rows:
            E(f"{rid}: expert_path references unknown resource id '{p}'")

    # THE KEY CHECK: is the path prerequisite-coherent from the learner's starting point?
    have = dict(stated)
    total_hours = 0
    for pos, p in enumerate(path, start=1):
        if p not in res_rows:
            continue
        row = res_rows[p]
        for s, lvl in row["req"].items():
            if have.get(s, 0) < lvl:
                E(f"{rid}: step {pos} ({p}, {row['title'][:40]}) requires "
                  f"'{s}' at level {lvl}, learner has {have.get(s, 0)} at that point")
        for s, lvl in row["taught"].items():
            have[s] = max(have.get(s, 0), lvl)
        total_hours += row["hours"]

    # redundancy check: does any step teach nothing the learner lacks?
    have2 = dict(stated)
    for pos, p in enumerate(path, start=1):
        if p not in res_rows:
            continue
        row = res_rows[p]
        gain = {s: l for s, l in row["taught"].items() if l > have2.get(s, 0)}
        if not gain:
            W(f"{rid}: step {pos} ({p}) teaches nothing above what the learner already has")
        for s, l in row["taught"].items():
            have2[s] = max(have2.get(s, 0), l)

    weeks = total_hours / hpw
    if weeks > 78:
        W(f"{rid}: path is {total_hours}h at {hpw}h/week = {weeks:.0f} weeks (>18 months)")
    print(f"  {sid}: {len(path)} steps, {total_hours}h, {weeks:.0f} weeks at {hpw}h/wk")

# ---------------- REPORT ----------------
print(f"\nSkills: {len(SKILLS)}  Resources: {len(RESOURCES)}  Scenarios: {len(SCENARIOS)}")
roots = [s for s in skill_rows if not skill_rows[s][2]]
depth = {s: len(all_prereqs(s)) for s in skill_rows}
print(f"DAG: {len(roots)} entry-level skills, max prereq depth {max(depth.values())} "
      f"({max(depth, key=depth.get)})")
print(f"\nERRORS: {len(errors)}")
for e in errors:
    print("  ✗", e)
print(f"\nWARNINGS: {len(warnings)}")
for w in warnings:
    print("  !", w)
sys.exit(1 if errors else 0)
