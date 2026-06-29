import sys
import os
import re

if len(sys.argv) < 3:
    print("usage: python task-brief.py PLAN_FILE TASK_NUMBER [OUTFILE]")
    sys.exit(2)

plan_file = sys.argv[1]
task_num = sys.argv[2]

if len(sys.argv) >= 4:
    out_file = sys.argv[3]
else:
    out_file = os.path.join(".superpowers", "sdd", f"task-{task_num}-brief.md")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)

with open(plan_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

in_fence = False
in_task = False
task_lines = []

task_pattern = re.compile(rf"^#+[ \t]+Task[ \t]+{task_num}([^0-9]|$)", re.IGNORECASE)
any_task_pattern = re.compile(r"^#+[ \t]+Task[ \t]+[0-9]+", re.IGNORECASE)

for line in lines:
    if line.startswith("```"):
        in_fence = not in_fence
    
    if not in_fence:
        if any_task_pattern.match(line):
            if task_pattern.match(line):
                in_task = True
            else:
                in_task = False
                
    if in_task:
        task_lines.append(line)

if not task_lines:
    print(f"task {task_num} not found in {plan_file}")
    sys.exit(3)

with open(out_file, 'w', encoding='utf-8') as f:
    f.writelines(task_lines)

print(f"wrote {out_file}: {len(task_lines)} lines")
