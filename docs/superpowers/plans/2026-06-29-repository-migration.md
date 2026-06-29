# Repository Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copy the Monospace Studio repository to a sibling directory `monospace_studio_nasa`, create a new public GitHub repository named "Monospace Studio - Nasa", push all history, branches, and tags, and migrate all 27 existing GitHub issues while preserving sequential issue IDs and statuses.

**Architecture:** Use Windows native `robocopy` tool to perform a clean recursive directory migration excluding build files. Link the new workspace to a freshly created public GitHub repository, and run a custom PowerShell script that reads the old issue list and creates them sequentially.

**Tech Stack:** Git, GitHub CLI (`gh`), PowerShell.

## Global Constraints

- Preserve all git history, tags, and commits.
- Retain local environment files (`.env.local`) and user-level skills (`.agents`).
- Recreate issues sequentially from #1 to #27 to ensure that commit message references (`resolves #X`) remain valid.
- Exclude large temporary directories (`node_modules`, `.next`) and transient build files.

---

### Task 1: Replicate Workspace to New Directory

**Files:**
- Create: `d:\AI Bootcamp\monospace_studio_nasa` (recursive copy of files)

**Interfaces:**
- Consumes: None
- Produces: Replicated repository folder structure containing `.git`, `.agents`, `.env.local`, etc.

- [ ] **Step 1: Execute directory copy**
  Run the following command in PowerShell:
  ```powershell
  robocopy "d:\AI Bootcamp\week3-cjb1077" "d:\AI Bootcamp\monospace_studio_nasa" /MIR /XD node_modules .next /XF tsconfig.tsbuildinfo
  ```
  Expected output: robocopy successfully lists and copies directories and files, returning a successful exit code (typically 1 or 2 when files are copied, which is normal for robocopy).

- [ ] **Step 2: Verify copied structure**
  Run:
  ```powershell
  Get-ChildItem -Path "d:\AI Bootcamp\monospace_studio_nasa" -Force
  ```
  Expected: All source directories (`src`, `public`, `supabase`, `tests`, `.git`, `.agents`) and files (including hidden `.env.local` and `.gitignore`) are present in the target folder.

---

### Task 2: Re-link Git Origin and Create Public GitHub Repository

**Files:**
- Modify: Git remote configuration inside `d:\AI Bootcamp\monospace_studio_nasa`

**Interfaces:**
- Consumes: Copied git repository workspace.
- Produces: Repository pointing to the new remote `cjb1077/Monospace-Studio-Nasa`.

- [ ] **Step 1: Remove old remote**
  Run in `d:\AI Bootcamp\monospace_studio_nasa`:
  ```powershell
  git remote remove origin
  ```
  Expected: Command returns with 0 exit code.

- [ ] **Step 2: Create new remote GitHub repository**
  Run in `d:\AI Bootcamp\monospace_studio_nasa`:
  ```powershell
  gh repo create "Monospace Studio - Nasa" --public --source=. --remote=origin --push
  ```
  Expected: The repository `cjb1077/Monospace-Studio-Nasa` is created, and the main branch is pushed.

- [ ] **Step 3: Push all other branches and tags**
  Run in `d:\AI Bootcamp\monospace_studio_nasa`:
  ```powershell
  git push origin --all
  git push origin --tags
  ```
  Expected: All local branches and tags are pushed to the new remote.

- [ ] **Step 4: Verify remotes**
  Run in `d:\AI Bootcamp\monospace_studio_nasa`:
  ```powershell
  git remote -v
  ```
  Expected: Remotes point to `cjb1077/Monospace-Studio-Nasa` (both fetch and push).

---

### Task 3: Migrate Issues to the New Repository

**Files:**
- Create temporary: `d:\AI Bootcamp\monospace_studio_nasa\issues-migration.json`
- Create temporary script: `d:\AI Bootcamp\monospace_studio_nasa\scripts\migrate-issues.ps1`

**Interfaces:**
- Consumes: Issue list from `FAU-AI-HootCamp-Summer-2026/week3-cjb1077`.
- Produces: 27 issues in `cjb1077/Monospace-Studio-Nasa` matching sequential ID indices and statuses.

- [ ] **Step 1: Export issues from the old repository**
  Run in `d:\AI Bootcamp\monospace_studio_nasa`:
  ```powershell
  gh issue list --repo FAU-AI-HootCamp-Summer-2026/week3-cjb1077 --state all --limit 100 --json number,title,body,state --jq "sort_by(.number)" > issues-migration.json
  ```
  Expected: `issues-migration.json` is generated containing 27 issues sorted from 1 to 27.

- [ ] **Step 2: Write issue migration script**
  Create the script file `d:\AI Bootcamp\monospace_studio_nasa\scripts\migrate-issues.ps1` with the following content:
  ```powershell
  $issues = Get-Content -Raw -Path issues-migration.json | ConvertFrom-Json
  foreach ($issue in $issues) {
      Write-Host "Creating issue #$($issue.number): $($issue.title)"
      # Create the issue
      $newIssue = gh issue create --title $issue.title --body $issue.body --assignee "@me"
      # If the state was closed, close it immediately
      if ($issue.state -eq "CLOSED") {
          Write-Host "Closing issue #$($issue.number)"
          gh issue close $issue.number
      }
  }
  ```

- [ ] **Step 3: Run the issue migration script**
  Run in `d:\AI Bootcamp\monospace_studio_nasa`:
  ```powershell
  powershell -File scripts/migrate-issues.ps1
  ```
  Expected: Outputs "Creating issue #N: ..." followed by "Closing issue #N" for issues 1 to 26. Issue 27 is created but not closed.

- [ ] **Step 4: Cleanup temporary migration files**
  Run in `d:\AI Bootcamp\monospace_studio_nasa`:
  ```powershell
  Remove-Item issues-migration.json
  Remove-Item scripts/migrate-issues.ps1
  ```
  Expected: Files are deleted.

---

### Task 4: Local Workspace Testing

**Files:**
- Create: `d:\AI Bootcamp\monospace_studio_nasa\node_modules` (by dependency install)

**Interfaces:**
- Consumes: Copied codebase.
- Produces: Installed dependencies, successful project build, and passing unit test suites.

- [ ] **Step 1: Install dependencies**
  Run in `d:\AI Bootcamp\monospace_studio_nasa`:
  ```powershell
  npm install
  ```
  Expected: Package installation finishes cleanly.

- [ ] **Step 2: Run test suite**
  Run in `d:\AI Bootcamp\monospace_studio_nasa`:
  ```powershell
  npm test
  ```
  Expected: 57 tests passed successfully, 0 failed.

- [ ] **Step 3: Compile Next.js build**
  Run in `d:\AI Bootcamp\monospace_studio_nasa`:
  ```powershell
  npm run build
  ```
  Expected: Next.js builds successfully.
