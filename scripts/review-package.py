import sys
import os
import subprocess

if len(sys.argv) < 3:
    print("usage: python review-package.py BASE HEAD [OUTFILE]")
    sys.exit(2)

base = sys.argv[1]
head = sys.argv[2]

def run_git(args):
    res = subprocess.run(["git"] + args, capture_output=True, text=True, check=True)
    return res.stdout

try:
    base_short = run_git(["rev-parse", "--short", base]).strip()
    head_short = run_git(["rev-parse", "--short", head]).strip()
except Exception as e:
    print(f"Error resolving git references: {e}")
    sys.exit(2)

if len(sys.argv) >= 4:
    out_file = sys.argv[3]
else:
    out_file = os.path.join(".superpowers", "sdd", f"review-{base_short}..{head_short}.diff")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)

try:
    commits = run_git(["log", "--oneline", f"{base}..{head}"])
    stat = run_git(["diff", "--stat", f"{base}..{head}"])
    diff = run_git(["diff", "-U10", f"{base}..{head}"])
except Exception as e:
    print(f"Error running git diff: {e}")
    sys.exit(2)

with open(out_file, "w", encoding="utf-8") as f:
    f.write(f"# Review package: {base}..{head}\n\n")
    f.write("## Commits\n")
    f.write(commits)
    f.write("\n## Files changed\n")
    f.write(stat)
    f.write("\n## Diff\n")
    f.write(diff)

commit_count = run_git(["rev-list", "--count", f"{base}..{head}"]).strip()
print(f"wrote {out_file}: {commit_count} commit(s), {os.path.getsize(out_file)} bytes")
