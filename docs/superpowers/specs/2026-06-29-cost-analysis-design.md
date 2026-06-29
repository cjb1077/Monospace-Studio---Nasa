# Design Spec: Cost Analysis & README Update

## 1. Goal Description
The purpose of this update is to create a detailed cost analysis document at [COST_ANALYSIS.md](file:///d:/AI%20Bootcamp/week3-cjb1077/docs/COST_ANALYSIS.md) and update the existing "API Cost Estimates" section in the [README.md](file:///d:/AI%20Bootcamp/week3-cjb1077/README.md).
The rates will be based on:
1. **OpenAI GPT-5.4 (Standard):** Input tokens at **$2.50 / 1M**, Output tokens at **$15.00 / 1M**.
2. **Local LM Studio (Local Dev):** Input/Output tokens at **$0** (self-hosted).

---

## 2. Token & Cost Modeling

### 2.1 Per-Feature Token Profiles
- **Feature 1: Style Selection**
  - **System prompt:** ~250 tokens
  - **User input (Title + 1,500-char explanation + JSON schema):** ~350 tokens
  - **Estimated Input:** 600 tokens
  - **Estimated Output (Style JSON):** 60 tokens
- **Feature 2: Caption + Fun Fact**
  - **System prompt:** ~150 tokens
  - **User input (Title + 1,500-char explanation + JSON schema):** ~350 tokens
  - **Estimated Input:** 500 tokens
  - **Estimated Output (Caption JSON):** 120 tokens

### 2.2 Combined APOD Request Cost
On a cache miss, both Feature 1 and Feature 2 are executed.
- **Combined Input:** ~1,100 tokens
- **Combined Output:** ~180 tokens
- **GPT-5.4 Cost per Cache Miss:**
  - Input Cost: $1,100 \times \frac{\$2.50}{1,000,000} = \$0.00275$
  - Output Cost: $180 \times \frac{\$15.00}{1,000,000} = \$0.00270$
  - **Total Cost per Cache Miss:** **$0.00545** (approx. 183 fetches per $1.00)
- **Local LM Studio Cost:** **$0.00**

---

## 3. Proposed Changes

### Component 1: COST_ANALYSIS.md
Create a new file [COST_ANALYSIS.md](file:///d:/AI%20Bootcamp/week3-cjb1077/docs/COST_ANALYSIS.md) containing the assumptions registry, per-feature token breakdown, provider rates comparison (GPT-5.4, LM Studio, NASA APOD, Supabase), monthly projections (worst-case and cache-hit targets), cost control strategies, and a pre-filled actual usage log with simulated tokens and costs.

### Component 2: README.md
Update Section 6 ("API Cost Estimates") in [README.md](file:///d:/AI%20Bootcamp/week3-cjb1077/README.md) to replace `gpt-4o-mini` calculations with standard `gpt-5.4` rates and document the self-hosted local pricing.

---

## 4. Verification Plan
- Run `npm test` to verify no regressions in the API mock tests.
- Verify Markdown formatting and check all file links.
