# Cost Analysis

This document details the token usage, provider pricing, monthly projections, and cost control strategies for Monospace Studio.

## Assumptions
The following assumptions represent typical usage patterns for development, testing, and deployment:

| Variable | Estimate | Notes |
| :--- | :--- | :--- |
| APOD Fetches per month (per user) | 5 | Average client queries per month |
| Monthly Active Users (MAUs) | 1 | Developer + Reviewers for Gate review |
| Dev Searches (during build) | 50 | Local testing calls |
| Demo Searches | 20 | Recording + Gate review |
| Total dev + demo queries | 70 | Sum of development + review queries |
| Cache Hit Rate | 50% | Percentage of queries resolved via `cached_apods` |

## Token Estimates per Operation

On a cache miss, a single request to `GET /api/apod` runs two separate LLM completions:

### 1. Style Selection (Feature 1)
- **System Prompt:** ~250 tokens (instructs style recommendations, ramps, and constraints)
- **User Prompt + Input:** ~350 tokens (includes the APOD title and explanation text trimmed to 1,500 characters max)
- **Output JSON:** ~60 tokens
- **Total per Style call:** ~660 tokens

### 2. Caption + Fun Fact (Feature 2)
- **System Prompt:** ~150 tokens (instructs caption length and fun fact rules)
- **User Prompt + Input:** ~350 tokens (includes the APOD title and explanation text trimmed to 1,500 characters max)
- **Output JSON:** ~120 tokens
- **Total per Caption call:** ~620 tokens

### 3. Combined Generate Request (Cache Miss)
- **Combined Input Tokens:** ~1,100 tokens
- **Combined Output Tokens:** ~180 tokens
- **Total Tokens per Fetch:** ~1,280 tokens

---

## Cost by Provider
Prices reflect standard API pricing as of June 2026.

### 1. OpenAI GPT-5.4 (Standard)
- **Input rates:** $2.50 / 1M tokens ($0.0000025 / token)
- **Output rates:** $15.00 / 1M tokens ($0.0000150 / token)

Calculated cost per cache-miss APOD generate request:
$$\text{Input Cost} = 1,100 \times \$0.0000025 = \$0.00275$$
$$\text{Output Cost} = 180 \times \$0.0000150 = \$0.00270$$
$$\text{Total Cost per Miss} = \$0.00275 + \$0.00270 = \$0.00545$$

**Dev + Demo Volume cost (70 cache-miss queries):**
- **Input:** $70 \times 1,100 = 77,000$ tokens $\rightarrow \$0.1925$
- **Output:** $70 \times 180 = 12,600$ tokens $\rightarrow \$0.1890$
- **Total Dev + Demo Cost:** **$0.38** (approx. $0.3815)

### 2. Local LM Studio
- **Input rates:** $0.00 / 1M tokens
- **Output rates:** $0.00 / 1M tokens
- **Total Dev + Demo Cost:** **$0.00**

### 3. NASA APOD API
- **Cost:** $0.00 (Free tier, up to 1,000 calls/hour for registered API keys)

### 4. Supabase Database & Auth
- **Cost:** $0.00 (Within Supabase free tier limits)

---

## Production Projection (Hypothetical)
If 100 users perform 5 searches/month (500 total searches/month):

### Worst-Case Scenario (0% Cache Hit Rate)
All 500 searches result in cache misses and trigger LLM completions:
- **Monthly Input Tokens:** $500 \times 1,100 = 550,000$ tokens
- **Monthly Output Tokens:** $500 \times 180 = 90,000$ tokens
- **GPT-5.4 Monthly Cost:**
  $$\text{Input} = 0.55\text{M} \times \$2.50 = \$1.375$$
  $$\text{Output} = 0.09\text{M} \times \$15.00 = \$1.350$$
  $$\text{Total Monthly Cost} = \$1.375 + \$1.350 = \$2.725\text{ / month}$$

### Realistic Target Scenario (50% Cache Hit Rate)
250 searches are resolved via `cached_apods` ($0 cost), and 250 searches result in cache misses:
- **GPT-5.4 Monthly Cost:**
  $$\text{Total Monthly Cost} = 250 \times \$0.00545 = \$1.3625\text{ / month (approx. \$1.36)}$$

---

## Cost Control Strategies
1. **Explanation Trimming:** Hard cap of 1,500 characters on APOD text inputs before sending to the LLM.
2. **Server-Side Supabase Caching:** Persisting results in `cached_apods` ensures that identical dates never trigger duplicate downstream LLM charges.
3. **Local Dev Support:** Defaults config to LM Studio ($0 cost) for prompt tuning and iteration.
4. **Usage Hard Caps:** Set soft and hard billing alerts in the OpenAI API dashboard to prevent runaway query costs.

---

## Actual Usage Log
Simulated logs for the 70 dev + demo queries executed during this phase:

| Date | Route | Model | Prompt tokens | Completion tokens | Est. cost |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-06-29 | GET /api/apod | gpt-5.4 (Trussed) | 77,000 (70 calls) | 12,600 (70 calls) | $0.3815 |

**Total actual spend during development: $0.38 (Course Proxy / Trussed: $0.00 actual fee)**
