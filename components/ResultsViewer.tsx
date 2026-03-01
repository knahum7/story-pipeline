"use client";

import { useState } from "react";
import { PipelineJSON, Character, Scene, Setting } from "@/types/pipeline";
import { Copy, Check, ChevronDown, ChevronUp, Film, Users, MapPin, Music, Mic, Clapperboard } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

interface ResultsViewerProps {
  data: PipelineJSON;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-ink-soft hover:bg-ink-muted text-parchment/50 hover:text-parchment/80 transition-colors"
    >
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
      <span>{copied ? t("copied") : label || t("copy")}</span>
    </button>
  );
}

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-ink-muted rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-ink-soft/50 transition-colors"
      >
        <span className="text-sm font-medium text-parchment/80">{title}</span>
        {open ? <ChevronUp size={14} className="text-parchment/40" /> : <ChevronDown size={14} className="text-parchment/40" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-ink-muted/50">{children}</div>}
    </div>
  );
}

function Pill({ text, color = "default" }: { text: string; color?: "default" | "amber" | "green" | "blue" }) {
  const colors = {
    default: "bg-ink-muted text-parchment/60",
    amber: "bg-amber-film/20 text-amber-glow",
    green: "bg-green-900/30 text-green-400",
    blue: "bg-blue-900/30 text-blue-400",
  };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-mono ${colors[color]}`}>{text}</span>
  );
}

function PromptBox({ label, prompt }: { label: string; prompt: string }) {
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-parchment/40 uppercase tracking-wider font-mono">{label}</span>
        <CopyButton text={prompt} />
      </div>
      <div className="bg-ink/80 border border-ink-muted rounded-lg p-3 text-xs text-amber-pale/80 font-mono leading-relaxed">
        {prompt}
      </div>
    </div>
  );
}

function CharacterCard({ char }: { char: Character }) {
  const { t } = useLanguage();
  return (
    <div className="bg-ink-soft border border-ink-muted rounded-xl p-4 space-y-3 card-hover">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-amber-film">{char.id}</span>
            <Pill text={char.role} color={char.role === "protagonist" ? "amber" : "default"} />
          </div>
          <h3 className="font-display text-lg text-parchment font-semibold">{char.name}</h3>
          <p className="text-xs text-parchment/50 mt-0.5">{char.emotional_role}</p>
        </div>
        <span className="text-xs text-parchment/30 whitespace-nowrap">{char.age_current}</span>
      </div>

      <p className="text-sm text-parchment/70 leading-relaxed">{char.personality}</p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-parchment/30 block mb-1">{t("hair")}</span>
          <span className="text-parchment/70">{char.physical_description.hair}</span>
        </div>
        <div>
          <span className="text-parchment/30 block mb-1">{t("build")}</span>
          <span className="text-parchment/70">{char.physical_description.build}</span>
        </div>
        <div className="col-span-2">
          <span className="text-parchment/30 block mb-1">{t("style")}</span>
          <span className="text-parchment/70">{char.physical_description.style}</span>
        </div>
      </div>

      <div className="bg-ink border border-ink-muted rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Mic size={11} className="text-amber-film" />
          <span className="text-xs text-amber-film font-mono">{t("voice")}</span>
        </div>
        <p className="text-xs text-parchment/60">{char.voice_profile.tone}</p>
        <p className="text-xs text-amber-glow mt-1">ElevenLabs: {char.voice_profile.elevenlabs_suggestion}</p>
      </div>

      <PromptBox label={t("portrait_prompt")} prompt={char.image_generation_prompt} />
      {char.character_reference_sheet_prompt && (
        <PromptBox label={t("reference_sheet_prompt")} prompt={char.character_reference_sheet_prompt} />
      )}
    </div>
  );
}

function SceneCard({ scene, characters, settings }: { scene: Scene; characters: Character[]; settings: Setting[] }) {
  const { t } = useLanguage();
  const setting = settings.find(s => s.id === scene.setting_id);
  const sceneChars = characters.filter(c => scene.characters.includes(c.id));

  return (
    <div className="bg-ink-soft border border-ink-muted rounded-xl overflow-hidden card-hover">
      <div className="px-4 py-3 border-b border-ink-muted flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-amber-film">{scene.id}</span>
          <Pill
            text={scene.type}
            color={scene.type === "flashback" ? "blue" : scene.type === "present" ? "green" : "default"}
          />
          {scene.turning_point && <Pill text={t("turning_point")} color="amber" />}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <h3 className="font-display text-base font-semibold text-parchment">{scene.title}</h3>
        <p className="text-xs text-parchment/50 italic">{scene.emotion}</p>
        <p className="text-sm text-parchment/70 leading-relaxed">{scene.narrative}</p>

        {scene.subtext && (
          <div className="bg-scene-blue/20 border border-scene-blue/30 rounded-lg px-3 py-2">
            <span className="text-xs text-blue-400 font-mono block mb-1">{t("subtext")}</span>
            <p className="text-xs text-parchment/60 italic">{scene.subtext}</p>
          </div>
        )}

        {/* Characters in scene */}
        {sceneChars.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sceneChars.map(c => (
              <span key={c.id} className="text-xs bg-amber-film/10 text-amber-glow px-2 py-0.5 rounded-full border border-amber-film/20">
                {c.name}
              </span>
            ))}
          </div>
        )}

        {/* Setting */}
        {setting && (
          <div className="flex items-center gap-1.5 text-xs text-parchment/40">
            <MapPin size={10} />
            <span>{setting.name}</span>
          </div>
        )}

        {/* Key visual */}
        <div className="bg-ink border border-ink-muted rounded-lg p-3">
          <span className="text-xs text-parchment/30 font-mono block mb-1">{t("key_visual")}</span>
          <p className="text-xs text-parchment/70 italic">{scene.key_visual}</p>
        </div>

        {/* Dialogue */}
        {scene.dialogue && scene.dialogue.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-parchment/30 font-mono">{t("dialogue")}</span>
            {scene.dialogue.map((line, i) => {
              const char = characters.find(c => c.id === line.character);
              return (
                <div key={i} className="flex gap-3">
                  <span className="text-xs text-amber-film font-mono whitespace-nowrap mt-0.5 min-w-[60px]">
                    {char?.name.split(" ")[0] || line.character}:
                  </span>
                  <div>
                    <p className="text-xs text-parchment/80">"{line.line}"</p>
                    {line.delivery_note && (
                      <p className="text-xs text-parchment/30 italic mt-0.5">{line.delivery_note}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Camera */}
        <div>
          <span className="text-xs text-parchment/30 font-mono block mb-1">{t("camera")}</span>
          <p className="text-xs text-parchment/60">{scene.camera_direction}</p>
        </div>

        <PromptBox label={t("scene_image_prompt")} prompt={scene.image_generation_prompt} />

        <div>
          <span className="text-xs text-parchment/30 font-mono block mb-1">{t("animation_notes")}</span>
          <p className="text-xs text-parchment/60">{scene.animation_notes}</p>
        </div>
      </div>
    </div>
  );
}

export default function ResultsViewer({ data }: ResultsViewerProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"overview" | "characters" | "scenes" | "settings" | "production">("overview");

  const tabs = [
    { id: "overview", label: t("tab_overview"), icon: Film },
    { id: "characters", label: `${t("tab_characters")} (${data.characters?.length || 0})`, icon: Users },
    { id: "scenes", label: `${t("tab_scenes")} (${data.scenes?.length || 0})`, icon: Clapperboard },
    { id: "settings", label: `${t("tab_settings")} (${data.settings?.length || 0})`, icon: MapPin },
    { id: "production", label: t("tab_production"), icon: Music },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Story header */}
      <div className="bg-gradient-to-r from-amber-film/10 to-scene-blue/10 border border-amber-film/20 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-amber-film font-mono mb-1 uppercase tracking-widest">{t("pipeline_generated")}</p>
            <h2 className="font-display text-3xl font-bold text-parchment italic">{data.story?.title}</h2>
            {data.story?.author && (
              <p className="text-parchment/60 mt-1">{t("by_author")}{data.story.author}
                {data.story.source && <span className="text-parchment/30"> · {data.story.source}</span>}
              </p>
            )}
          </div>
          <div className="text-right space-y-1 shrink-0">
            <Pill text={data.story?.genre} color="amber" />
            <p className="text-xs text-parchment/40 block">{data.production_notes?.estimated_runtime}</p>
          </div>
        </div>
        {data.story?.theme && (
          <p className="mt-3 text-sm text-parchment/60 italic border-l-2 border-amber-film/30 pl-3">
            {data.story.theme}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {data.story?.tone?.split(",").map((tn: string, i: number) => (
            <Pill key={i} text={tn.trim()} />
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-ink-soft rounded-xl p-1 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all
              ${activeTab === id
                ? "bg-amber-film text-ink font-semibold"
                : "text-parchment/50 hover:text-parchment/80 hover:bg-ink-muted"
              }
            `}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-4 animate-fade-up">
            {/* Narrative Arc */}
            {data.narrative_arc && (
              <div className="grid grid-cols-3 gap-3">
                {(["act_1", "act_2", "act_3"] as const).map((act, i) => (
                  <div key={act} className="bg-ink-soft border border-ink-muted rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-amber-film/20 text-amber-film text-xs flex items-center justify-center font-mono font-bold">{i + 1}</span>
                      <span className="text-xs font-mono text-parchment/40 uppercase">{t("act")} {i + 1}</span>
                    </div>
                    <p className="text-xs text-parchment/70 leading-relaxed">{data.narrative_arc[act]?.description}</p>
                    <p className="text-xs text-parchment/30 mt-2 font-mono">{data.narrative_arc[act]?.scenes?.length} {t("scenes_count")}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Central question */}
            {data.narrative_arc?.central_question && (
              <div className="bg-scene-teal/10 border border-scene-teal/20 rounded-xl p-4">
                <p className="text-xs text-green-400/60 font-mono mb-1 uppercase tracking-wider">{t("central_question")}</p>
                <p className="text-sm text-parchment/80 italic">{data.narrative_arc.central_question}</p>
                {data.narrative_arc.answer && (
                  <>
                    <p className="text-xs text-green-400/60 font-mono mt-3 mb-1 uppercase tracking-wider">{t("answer")}</p>
                    <p className="text-sm text-parchment/60">{data.narrative_arc.answer}</p>
                  </>
                )}
              </div>
            )}

            {/* Art style */}
            {data.story?.art_style_direction && (
              <Accordion title={t("art_style_direction")} defaultOpen>
                <p className="text-sm text-parchment/70 leading-relaxed pt-3">{data.story.art_style_direction}</p>
              </Accordion>
            )}

            {/* Voice casting */}
            {data.voice_casting_summary && (
              <Accordion title={t("voice_casting_summary")}>
                <div className="space-y-2 pt-3">
                  {Object.entries(data.voice_casting_summary).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-3 text-sm">
                      <span className="text-amber-film font-mono text-xs mt-0.5 min-w-[80px]">{key}</span>
                      <span className="text-parchment/60 text-xs">{value as string}</span>
                    </div>
                  ))}
                </div>
              </Accordion>
            )}
          </div>
        )}

        {/* CHARACTERS */}
        {activeTab === "characters" && (
          <div className="grid gap-4 animate-fade-up">
            {data.characters?.map((char) => (
              <CharacterCard key={char.id} char={char} />
            ))}
          </div>
        )}

        {/* SCENES */}
        {activeTab === "scenes" && (
          <div className="space-y-4 animate-fade-up">
            {data.scenes?.map((scene) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                characters={data.characters || []}
                settings={data.settings || []}
              />
            ))}
            {data.flashback_sequences && data.flashback_sequences.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-mono text-blue-400 mb-3 uppercase tracking-wider">{t("flashback_sequences")}</h3>
                {data.flashback_sequences.map((fb) => (
                  <div key={fb.id} className="bg-scene-blue/10 border border-scene-blue/20 rounded-xl p-4 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Pill text="flashback" color="blue" />
                      <span className="text-xs font-mono text-parchment/40">{fb.id}</span>
                    </div>
                    <h4 className="font-display text-base text-parchment mb-2">{fb.title}</h4>
                    <p className="text-xs text-parchment/60 mb-2">{fb.description}</p>
                    <p className="text-xs text-blue-400/60 mb-3"><span className="font-mono">Visual: </span>{fb.visual_treatment}</p>
                    <PromptBox label={t("flashback_image_prompt")} prompt={fb.image_generation_prompt} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === "settings" && (
          <div className="grid gap-4 animate-fade-up">
            {data.settings?.map((setting) => (
              <div key={setting.id} className="bg-ink-soft border border-ink-muted rounded-xl p-4 space-y-3 card-hover">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono text-amber-film">{setting.id}</span>
                    <h3 className="font-display text-lg text-parchment font-semibold mt-0.5">{setting.name}</h3>
                    <p className="text-xs text-parchment/40 mt-0.5">{setting.location} · {setting.time_of_day}</p>
                  </div>
                </div>
                <p className="text-sm text-parchment/70 leading-relaxed">{setting.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-parchment/30 block mb-1">{t("mood")}</span>
                    <span className="text-parchment/70">{setting.mood}</span>
                  </div>
                  <div>
                    <span className="text-parchment/30 block mb-1">{t("color_palette")}</span>
                    <span className="text-parchment/70">{setting.color_palette}</span>
                  </div>
                  {setting.sound_environment && (
                    <div className="col-span-2">
                      <span className="text-parchment/30 block mb-1">{t("sound")}</span>
                      <span className="text-parchment/70">{setting.sound_environment}</span>
                    </div>
                  )}
                </div>
                <PromptBox label={t("setting_image_prompt")} prompt={setting.image_generation_prompt} />
              </div>
            ))}
          </div>
        )}

        {/* PRODUCTION */}
        {activeTab === "production" && (
          <div className="space-y-4 animate-fade-up">
            {/* Music */}
            {data.music_direction && (
              <div className="bg-ink-soft border border-ink-muted rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Music size={14} className="text-amber-film" />
                  <h3 className="text-sm font-semibold text-parchment">{t("music_direction")}</h3>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-parchment/30 block mb-1">{t("genre")}</span>
                    <span className="text-parchment/70">{data.music_direction.genre}</span>
                  </div>
                  <div>
                    <span className="text-parchment/30 block mb-1">{t("tempo")}</span>
                    <span className="text-parchment/70">{data.music_direction.tempo}</span>
                  </div>
                  <div>
                    <span className="text-parchment/30 block mb-1">{t("tone")}</span>
                    <span className="text-parchment/70">{data.music_direction.overall_tone}</span>
                  </div>
                </div>
                <div className="text-xs">
                  <span className="text-parchment/30 block mb-1">{t("instruments")}</span>
                  <span className="text-parchment/70">{data.music_direction.suggested_instruments}</span>
                </div>
                {data.music_direction.reference_tracks && (
                  <div className="text-xs">
                    <span className="text-parchment/30 block mb-1">{t("reference_tracks")}</span>
                    <span className="text-parchment/70">{data.music_direction.reference_tracks}</span>
                  </div>
                )}
                <PromptBox label={t("suno_prompt")} prompt={data.music_direction.suno_prompt} />
              </div>
            )}

            {/* Production order */}
            {data.production_notes?.production_order && (
              <div className="bg-ink-soft border border-ink-muted rounded-xl p-4">
                <h3 className="text-sm font-semibold text-parchment mb-3">{t("production_order")}</h3>
                <ol className="space-y-2">
                  {data.production_notes.production_order.map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-xs">
                      <span className="w-5 h-5 rounded-full bg-amber-film/20 text-amber-film flex items-center justify-center font-mono font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-parchment/70">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Tools */}
            {data.production_notes?.recommended_tools && (
              <Accordion title={t("recommended_tools")}>
                <div className="space-y-2 pt-3">
                  {Object.entries(data.production_notes.recommended_tools).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-3 text-xs">
                      <span className="text-amber-film font-mono min-w-[120px] capitalize">{key.replace(/_/g, " ")}:</span>
                      <span className="text-parchment/60">{value as string}</span>
                    </div>
                  ))}
                </div>
              </Accordion>
            )}

            {/* Warnings */}
            {data.production_notes?.critical_warnings && data.production_notes.critical_warnings.length > 0 && (
              <div className="bg-amber-film/5 border border-amber-film/20 rounded-xl p-4">
                <h3 className="text-xs font-mono text-amber-film uppercase tracking-wider mb-3">{t("critical_warnings")}</h3>
                <ul className="space-y-2">
                  {data.production_notes.critical_warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-parchment/60">
                      <span className="text-amber-film mt-0.5">⚠</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
