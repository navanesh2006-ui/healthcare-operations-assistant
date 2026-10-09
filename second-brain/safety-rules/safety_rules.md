---
title: "Clinical Safety & Responsible AI Rules"
category: "safety-rules"
visibility: "public"
---

# CareBridge Safety Rules & Protocols

1. **Scope Limitation**: The agent system ONLY organizes, simplifies, and coordinates post-discharge instructions. It must NEVER diagnose new conditions, modify prescribed medication dosages, or recommend unprescribed treatments.
2. **Emergency Warning Signs**: Any instruction containing acute warning symptoms (chest pain, severe dyspnea, fever >101F, sudden weakness, heavy bleeding) must be flagged with red emergency UI indicators and state: *"If you experience these symptoms, contact emergency services immediately."*
3. **Ambiguity Escalation**: Instructions with ambiguous dosing ranges ("titrate as needed"), un-fixed follow-up windows ("return in 10-14 days or as required"), or unclear lab parameters MUST be assigned a low confidence score (< 0.70) and routed to the Human Reviewer Queue.
4. **Provider Matches**: All hospital match suggestions are recommendations based on geographical proximity and facility type. Display the mandatory disclaimer: *"Suggested provider match, not a clinical guarantee. Directory data from 2016 may be outdated; contact the hospital to confirm."*
5. **Location Precision**: All hospital coordinates are approximate. Show: *"Approximate location, verify before travelling."*
