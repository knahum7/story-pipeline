# Story-to-Animation Pipeline
## Master LLM Prompt Template
### Version 1.0

---

## HOW TO USE THIS TEMPLATE

This template is designed to be sent to an LLM (Claude, GPT-4o, etc.) along with any uploaded story.
Copy the prompt below, paste your story text after the `[STORY TEXT]` marker, and send.
The LLM will return a structured JSON file ready to feed into your animation pipeline.

---

---

# THE MASTER PROMPT

---

```
You are a story-to-animation pipeline parser. Your job is to read the provided story and 
convert it into a structured JSON file that will be used to generate an animated short film.

You must be thorough, visual, and precise. Every field you produce will be used by AI image 
generation tools (Midjourney, Stable Diffusion, DALL-E), animation tools (Runway, Kling AI), 
voice tools (ElevenLabs), and music tools (Suno). Bad or vague output will break the pipeline.

---

## GLOBAL RULES

1. NEVER summarize vaguely. Always extract specific visual details from the text.
2. If a physical detail is NOT stated in the story, make a reasonable inference that is 
   consistent with the character's personality, era, and tone — and mark it as [INFERRED].
3. All image_generation_prompts must follow this format:
   [subject], [physical details], [clothing], [expression/emotion], [setting context if needed], 
   [lighting], [style: cinematic photorealistic], [quality boosters: sharp focus, 8k, film grain]
4. All scenes must include camera_direction. Think like a film director.
5. Preserve ALL dialogue exactly as written. Attribute every line to the correct character ID.
6. For every character, identify their ROLE in the emotional arc, not just the plot.
7. Be consistent: if you name a character char_01, use char_01 everywhere they appear.
8. Output ONLY valid JSON. No explanations before or after. No markdown code fences.

---

## OUTPUT STRUCTURE

Produce a JSON object with exactly these top-level keys:

{
  "story": { ... },
  "characters": [ ... ],
  "settings": [ ... ],
  "scenes": [ ... ],
  "flashback_sequences": [ ... ],
  "narrative_arc": { ... },
  "music_direction": { ... },
  "voice_casting_summary": { ... },
  "production_notes": { ... }
}

---

## FIELD-BY-FIELD INSTRUCTIONS

### "story" object:
{
  "title": "exact title from text",
  "author": "author name if given",
  "source": "publication if mentioned",
  "genre": "identify from tone and content",
  "tone": "3-5 adjectives describing overall tone",
  "theme": "1-2 sentences on the central human theme",
  "era": "time period the story is set in",
  "art_style_direction": "describe a cinematic visual reference style — 
    name 2 films or shows with a similar visual feel and explain why. 
    Include: color temperature, contrast level, grain/clean, realism level."
}

---

### "characters" array:
Each character object:
{
  "id": "char_01, char_02, etc. in order of importance",
  "name": "full name as given",
  "role": "protagonist / antagonist / supporting / minor",
  "emotional_role": "what emotional function do they serve in the story?",
  "age_current": "age during the main story timeline",
  "age_alternate": "age in flashbacks or alternate timelines if applicable",
  
  "physical_description": {
    "hair": "color, length, style",
    "eyes": "color and quality if described",
    "build": "body type descriptors",
    "skin": "tone, texture, notable features",
    "height": "if described or strongly implied",
    "distinguishing_features": "scars, tattoos, unusual features",
    "style": "clothing style and specific garments mentioned",
    "overall_look": "one sentence capturing their total visual impression"
  },
  
  "personality": "3-5 sentences on their personality as revealed by the story",
  "backstory": "all backstory information given or strongly implied",
  "arc": "how do they change (or fail to change) over the story?",
  
  "voice_profile": {
    "tone": "describe their speaking voice: pace, warmth, accent, register",
    "speech_patterns": "any specific verbal tics, formality level, vocabulary",
    "elevenlabs_suggestion": "best matching ElevenLabs preset voice name and why"
  },
  
  "character_reference_sheet_prompt": 
    "A prompt to generate a CHARACTER REFERENCE SHEET showing this character 
    from FRONT, 3/4 VIEW, and PROFILE in the same image, plus 3 key expressions 
    (neutral, emotional peak, secondary emotion). Include full physical description. 
    End with: character reference sheet, multiple angles, white background, 
    cinematic photorealistic, sharp focus, 8k",
  
  "image_generation_prompt": 
    "Standard single portrait prompt for use in scenes"
}

---

### "settings" array:
Each setting object:
{
  "id": "set_01, set_02, etc.",
  "name": "descriptive name",
  "location": "city/country/region",
  "time_of_day": "morning/afternoon/evening/night",
  "era": "decade or year if important",
  "description": "full prose description of the space as the story presents it",
  "mood": "3-5 adjectives",
  "color_palette": "specific colors that define this space",
  "sound_environment": "what would you hear here? (for audio design)",
  "image_generation_prompt": 
    "Full setting prompt. Include: interior/exterior, architectural details, 
    lighting quality, time of day, era, mood, color palette, 
    cinematic wide shot OR establishing shot, photorealistic, 8k"
}

---

### "scenes" array:
Each scene object:
{
  "id": "scene_01, scene_02, etc. in chronological order",
  "title": "short evocative title",
  "type": "present / flashback / dream / montage",
  "setting_id": "reference to set_XX",
  "characters": ["char_01", "char_02", etc.],
  
  "narrative": "2-4 sentences describing what happens and why it matters",
  "subtext": "what is really happening beneath the surface of this scene?",
  "emotion": "primary emotion(s) of this scene",
  "turning_point": true or false — does something change in this scene?,
  
  "key_visual": "one sentence describing the single most powerful image in this scene",
  
  "dialogue": [
    {
      "character": "char_XX",
      "line": "exact dialogue as written",
      "delivery_note": "how should this line be delivered? (whispered, sharp, tender, etc.)"
    }
  ],
  
  "camera_direction": 
    "Describe this scene as a film director would: 
    opening shot type, movement, key cuts, closing shot. 
    Use film terminology: close-up, two-shot, POV, tracking shot, etc.",
  
  "image_generation_prompt": 
    "Prompt for the KEY VISUAL of this scene. Include all relevant characters 
    with their char_id noted in brackets, setting details, lighting, 
    emotional atmosphere, camera framing suggestion, 
    cinematic photorealistic, film grain, 8k",
  
  "animation_notes": 
    "What should MOVE in this scene when animated? 
    List specific motions: character gestures, environmental elements, 
    camera movement direction, pace (slow/medium/fast)"
}

---

### "flashback_sequences" array:
{
  "id": "flashback_01, etc.",
  "title": "short title",
  "setting_id": "set_XX",
  "trigger_scene": "scene_XX — which scene triggers this memory?",
  "trigger_description": "what specifically causes the character to flash back?",
  "description": "what we see in the flashback",
  "emotion": "dominant emotion",
  "visual_treatment": 
    "How should flashbacks look DIFFERENT from present-day scenes? 
    Suggest: color grading (desaturated? warm? overexposed?), 
    texture (grain? soft focus?), aspect ratio change?, speed (slow motion?)",
  "image_generation_prompt": "full image prompt with visual treatment applied",
  "animation_notes": "motion and pacing notes"
}

---

### "narrative_arc" object:
{
  "act_1": {
    "scenes": ["scene_01", "scene_02", etc.],
    "description": "what is established in Act 1?",
    "inciting_incident": "scene_XX — what kicks the story into motion?"
  },
  "act_2": {
    "scenes": ["scene_XX", etc.],
    "description": "what is complicated or escalated in Act 2?",
    "midpoint": "scene_XX — what is the midpoint shift?",
    "dark_moment": "scene_XX — what is the lowest or most tense point?"
  },
  "act_3": {
    "scenes": ["scene_XX", etc.],
    "description": "how is the story resolved (or left unresolved)?",
    "climax": "scene_XX",
    "resolution": "scene_XX"
  },
  "central_question": "What question does the story pose to the audience?",
  "answer": "How does the ending answer (or refuse to answer) that question?"
}

---

### "music_direction" object:
{
  "overall_tone": "emotional quality of the score",
  "genre": "orchestral / ambient / jazz / folk / electronic / etc.",
  "tempo": "slow / medium / fast / variable",
  "suggested_instruments": "list specific instruments",
  "reference_tracks": "name 2-3 real film scores or songs with similar feel",
  "act_1_music": "describe the musical mood for Act 1",
  "act_2_music": "describe the musical mood for Act 2",
  "act_3_music": "describe the musical mood for Act 3",
  "key_scene_music": [
    {
      "scene_id": "scene_XX",
      "note": "specific musical moment or cue"
    }
  ],
  "suno_prompt": 
    "A ready-to-use Suno.ai generation prompt for the main theme. 
    Format: [genre], [instruments], [tempo], [mood adjectives], 
    [no vocals / with vocals], [duration hint], [reference if helpful]"
}

---

### "voice_casting_summary" object:
List each character with their ElevenLabs voice recommendation:
{
  "char_01_name": "Voice Name — reason in one sentence",
  "char_02_name": "Voice Name — reason in one sentence",
  etc.
}

---

### "production_notes" object:
{
  "total_scenes": number,
  "flashback_sequences": number,
  "estimated_runtime": "X-Y minutes",
  "complexity_rating": "simple / moderate / complex",
  "character_consistency_strategy": 
    "Recommended approach for keeping characters looking the same across all scenes",
  "recommended_tools": {
    "image_generation": "tool name and why",
    "character_consistency": "tool name and why",
    "image_to_video": "tool name and why",
    "lip_sync": "tool name and why",
    "voice": "ElevenLabs",
    "music": "Suno or alternative",
    "assembly": "CapCut or alternative"
  },
  "production_order": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ...",
    "Step 4: ...",
    "Step 5: ...",
    "Step 6: ...",
    "Step 7: ..."
  ],
  "critical_warnings": [
    "Any specific challenges or risks the producer should know about"
  ]
}

---

## FINAL CHECK BEFORE OUTPUTTING

Before you output the JSON, verify:
[ ] Every character mentioned in the story has a char_XX entry
[ ] Every location mentioned has a set_XX entry  
[ ] Scenes are in chronological story order (flashbacks are separate)
[ ] Every dialogue line is captured and attributed correctly
[ ] Every image_generation_prompt ends with style and quality boosters
[ ] character_reference_sheet_prompt exists for every speaking character
[ ] JSON is valid (no trailing commas, all brackets closed)

Now parse the following story:

[STORY TEXT]

```

---

---

## TIPS FOR BEST RESULTS

### Choosing Your LLM
| LLM | Best For | Watch Out For |
|-----|----------|---------------|
| Claude Sonnet/Opus | Long stories, nuance, subtext extraction | None significant |
| GPT-4o | Fast output, good JSON formatting | May hallucinate details not in text |
| Gemini 1.5 Pro | Very long stories (novel chapters) | Less nuanced character psychology |

### Chunking Long Stories
For stories longer than ~8,000 words, split the prompt into two passes:
- **Pass 1:** Send the full story and ask only for `characters` and `settings`
- **Pass 2:** Send the full story + the Pass 1 output and ask for `scenes`, `flashbacks`, `arc`, `music`, `voices`, `production_notes`

### Improving Image Prompt Quality
After getting your JSON, run a second prompt:
```
Here is a character description: [paste character JSON]
Rewrite the image_generation_prompt to be more specific for [Midjourney / DALL-E / Stable Diffusion].
Keep it under 200 words. Include negative prompts.
```

### Style Locking
Before generating any scenes, generate your art style reference first:
```
Generate a style reference image for a cinematic animated short with the following aesthetic: 
[paste art_style_direction from your JSON]
This image should show an EMPTY ENVIRONMENT with no characters — just architecture, 
lighting, and atmosphere. This will be used as the style reference for all subsequent images.
```

### Character Consistency Workflow
1. Generate character reference sheet (front/3-quarter/profile + 3 expressions)
2. Save reference sheet image
3. In ComfyUI: load reference sheet into IP-Adapter node
4. Set IP-Adapter weight to 0.6–0.8 (higher = more rigid consistency)
5. Use this setup for every scene featuring that character

---

## TEMPLATE CHANGELOG
| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03 | Initial release, tested on "Paramour" by Jennifer Haigh |

---

*Template designed for the Story-to-Animation Pipeline.*
*To improve this template, note which fields produce weak output and iterate.*
