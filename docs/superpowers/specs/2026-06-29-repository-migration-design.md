# Design Spec: Repository and Issue Migration

This design document outlines the strategy for migrating the Monospace Studio - NASA APOD ASCII Art Studio project from its initial course repository to a new public repository under the developer's personal GitHub account, enabling deployment on Netlify.

---

## 1. Objectives

1. **Replicate Workspace:** Copy all codebase files, configurations, git history, and local environment secrets to a sibling folder `monospace_studio_nasa`.
2. **Setup New Remote Repository:** Create a new public GitHub repository named "Monospace Studio - Nasa" under the `cjb1077` personal namespace and push all commits, branches, and tags.
3. **Migrate Metadata (Issues):** Programmatically migrate all 27 existing GitHub issues from the old repository (`FAU-AI-HootCamp-Summer-2026/week3-cjb1077`) to the new one (`cjb1077/Monospace-Studio-Nasa`). The migration must preserve:
   - Issue titles and descriptions.
   - Sequential issue numbers (to maintain integration with git commits referencing `#<num>`).
   - Assignees (assigned to the current user).
   - State (close issues that were already closed in the source repo).

---

## 2. Approach & Commands

### Step 2.1: Folder Duplication

We will run a PowerShell recursive copy to replicate the repository contents without downloading or transferring heavy build and dependency directories:

```powershell
robocopy "d:\AI Bootcamp\week3-cjb1077" "d:\AI Bootcamp\monospace_studio_nasa" /MIR /XD node_modules .next /XF tsconfig.tsbuildinfo
```

### Step 2.2: Git Remote Re-linking & GitHub Repo Creation

Inside the newly created folder `d:\AI Bootcamp\monospace_studio_nasa`:

1. Remove the old origin remote:
   ```powershell
   git remote remove origin
   ```
2. Create the new public repository. `gh repo create` will automatically slugify the spaces:
   ```powershell
   gh repo create "Monospace Studio - Nasa" --public --source=. --remote=origin --push
   ```
3. Push all other branches and tags:
   ```powershell
   git push origin --all
   git push origin --tags
   ```

### Step 2.3: Issue Migration Script

To preserve issue IDs:
1. Export issues from the old repository to `issues-migration.json` sorted by ascending number:
   ```powershell
   gh issue list --repo FAU-AI-HootCamp-Summer-2026/week3-cjb1077 --state all --limit 100 --json number,title,body,state --jq "sort_by(.number)" > issues-migration.json
   ```
2. Run a migration script `scripts/migrate-issues.ps1` that iterates over the exported JSON.
   For each issue:
   - Create the issue on the new repo:
     ```powershell
     gh issue create --title "$title" --body "$body" --assignee "@me"
     ```
   - If the old state was `CLOSED`, immediately close the issue on the new repo:
     ```powershell
     gh issue close $number
     ```
3. Remove the temporary `issues-migration.json` file.

---

## 3. Verification Plan

1. **Verify Files in New Directory:** Check that `.env.local`, `.agents`, `.git`, and all source code directories are correctly present in `d:\AI Bootcamp\monospace_studio_nasa`.
2. **Verify Git History:** Run `git log -n 5` in the new folder to verify that all commit history remains intact.
3. **Verify Remotes:** Run `git remote -v` in the new folder to ensure it points to the new public repo.
4. **Verify GitHub Web Presence:** Use the browser subagent or manual check to confirm the new repository `Monospace-Studio-Nasa` is visible on GitHub.
5. **Verify Issues Migration:** Ensure all 27 issues are created in the correct order, with issues 1 to 26 marked closed, and issue 27 remaining open.
