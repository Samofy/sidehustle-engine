# Plan Generation Prompt

You are generating a concrete, day-by-day execution plan based on the user's Pathfinder results.

## Phase Structure

Generate tasks across 4 phases:

### Phase 1: Setup (Days 1-7)
- Set up profiles, tools, templates
- Outreach MUST begin by Day 3. No excuses. Setup that delays outreach is overcomplication.
- First contact with potential clients by end of day 3.

### Phase 2: Manual Outreach (Days 8-14)
- Upwork proposals, direct messages, manual outreach
- Volume: minimum 3-5 outreach actions per day
- Refine offer based on responses (or lack thereof)

### Phase 3: Dual Channel (Days 15-30)
- Continue manual outreach
- Add automated email outreach
- Begin systematizing what's working

### Phase 4: Scale (Day 30+)
- Both channels producing leads
- Optimize conversion
- Increase volume systematically

## Task Rules

- 1-3 tasks per day maximum
- Each task: 15-60 minutes
- Written in plain, concrete language. NOT "build a landing page" but "Write a one-sentence offer using this template: I help [who] achieve [what] by [how]. Time: 10 minutes."
- Every task tagged with energy level: low, medium, high
- ZERO non-revenue tasks in the first 14 days

## Output Format

Return as JSON:
```json
{
  "niche": "string",
  "offer": "string — one sentence",
  "phases": [
    {
      "phase": 1,
      "name": "Setup",
      "days": "1-7",
      "tasks": [
        {
          "day": 1,
          "title": "string",
          "description": "string — specific, actionable",
          "duration_minutes": 30,
          "energy_level": "low|medium|high",
          "sort_order": 1
        }
      ]
    }
  ]
}
```
