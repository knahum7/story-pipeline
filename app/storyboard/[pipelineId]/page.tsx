"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Loader2,
  Film,
  Users,
  LayoutGrid,
  Check,
  MapPin,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { PipelineJSON, Scene } from "@/types/pipeline";

interface SceneImage {
  id: string;
  scene_id: string;
  image_url: string;
  created_at: string;
}

interface SceneComposite {
  id: string;
  scene_id: string;
  image_url: string;
  created_at: string;
}

interface SceneAudio {
  id: string;
  scene_id: string;
  created_at: string;
}

interface SceneVideo {
  id: string;
  scene_id: string;
  created_at: string;
}

interface CharacterImage {
  id: string;
  character_id: string;
  name: string;
  image_url: string;
  created_at: string;
}

export default function StoryboardPage() {
  const params = useParams();
  const pipelineId = params.pipelineId as string;
  const { lang, setLang, t } = useLanguage();

  const [pipeline, setPipeline] = useState<PipelineJSON | null>(null);
  const [sceneImages, setSceneImages] = useState<SceneImage[]>([]);
  const [sceneComposites, setSceneComposites] = useState<SceneComposite[]>([]);
  const [sceneAudioList, setSceneAudioList] = useState<SceneAudio[]>([]);
  const [sceneVideos, setSceneVideos] = useState<SceneVideo[]>([]);
  const [charImages, setCharImages] = useState<CharacterImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [pipelineRes, scenesRes, charsRes, videosRes, compositesRes, audioRes] = await Promise.all([
          fetch(`/api/pipelines/${pipelineId}`),
          fetch(`/api/scenes?pipeline_id=${pipelineId}`),
          fetch(`/api/characters?pipeline_id=${pipelineId}`),
          fetch(`/api/scenes/videos?pipeline_id=${pipelineId}`).catch(() => null),
          fetch(`/api/scenes/composites?pipeline_id=${pipelineId}`).catch(() => null),
          fetch(`/api/scenes/audio?pipeline_id=${pipelineId}`).catch(() => null),
        ]);

        if (!pipelineRes.ok) throw new Error("Failed to load pipeline");
        const pData = await pipelineRes.json();
        setPipeline(pData.pipeline_data as PipelineJSON);

        if (scenesRes.ok) {
          const sData = await scenesRes.json();
          setSceneImages(sData.scenes || []);
        }
        if (charsRes.ok) {
          const cData = await charsRes.json();
          setCharImages(cData.characters || []);
        }
        if (videosRes?.ok) {
          const vData = await videosRes.json();
          setSceneVideos(vData.videos || []);
        }
        if (compositesRes?.ok) {
          const compData = await compositesRes.json();
          setSceneComposites(compData.composites || []);
        }
        if (audioRes?.ok) {
          const aData = await audioRes.json();
          setSceneAudioList(aData.audio || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pipelineId]);

  const allSets = useMemo(() => pipeline?.sets || [], [pipeline]);

  const getCharName = (charId: string): string => {
    const pChar = pipeline?.characters?.find((c) => c.id === charId);
    if (pChar) return pChar.name;
    const img = charImages.find((i) => i.character_id === charId);
    return img?.name || charId;
  };

  const getCharPortraitUrl = (charId: string): string | undefined => {
    const imgs = charImages
      .filter((i) => i.character_id === charId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return imgs[0]?.image_url;
  };

  const getThumbnail = (sceneId: string): string | undefined => {
    const comp = sceneComposites
      .filter((c) => c.scene_id === sceneId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (comp[0]?.image_url) return comp[0].image_url;
    const bg = sceneImages
      .filter((i) => i.scene_id === sceneId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return bg[0]?.image_url;
  };

  const getStepStatus = (scene: Scene) => {
    const hasBg = sceneImages.some((i) => i.scene_id === scene.id);
    const hasComp = sceneComposites.some((c) => c.scene_id === scene.id);
    const hasAudio = sceneAudioList.some((a) => a.scene_id === scene.id);
    const hasVideo = sceneVideos.some((v) => v.scene_id === scene.id);
    return { hasBg, hasComp, hasAudio, hasVideo };
  };

  const progress = useMemo(() => {
    const scenes = pipeline?.scenes || [];
    const total = scenes.length;
    const sceneIds = new Set(scenes.map((s) => s.id));
    return {
      total,
      backgrounds: new Set(sceneImages.filter((i) => sceneIds.has(i.scene_id)).map((i) => i.scene_id)).size,
      composites: new Set(sceneComposites.filter((c) => sceneIds.has(c.scene_id)).map((c) => c.scene_id)).size,
      audio: new Set(sceneAudioList.filter((a) => sceneIds.has(a.scene_id)).map((a) => a.scene_id)).size,
      videos: new Set(sceneVideos.filter((v) => sceneIds.has(v.scene_id)).map((v) => v.scene_id)).size,
    };
  }, [pipeline, sceneImages, sceneComposites, sceneAudioList, sceneVideos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-amber-film" />
      </div>
    );
  }

  if (error || !pipeline) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400/80 text-sm mb-4">{error || "Pipeline not found"}</p>
          <Link href="/history" className="btn-primary px-6 py-3 rounded-xl text-sm">
            {t("back_to_history")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink">
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(245, 240, 232, 0.5) 2px, rgba(245, 240, 232, 0.5) 3px)`,
          backgroundSize: "100% 4px",
        }}
      />

      <header className="border-b border-ink-muted/50 sticky top-0 z-50 bg-ink/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="film-strip">
              {[...Array(5)].map((_, i) => (
                <span key={i} style={i === 2 ? { background: "#C8853A" } : {}} />
              ))}
            </div>
            <div>
              <Link
                href="/"
                className="font-display text-lg font-bold text-parchment tracking-tight hover:text-amber-film transition-colors"
              >
                Story<span className="text-amber-film italic">Pipeline</span>
              </Link>
              <p className="text-xs text-parchment/30 -mt-0.5">{t("brand_subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/history"
              className="flex items-center gap-1.5 text-xs text-parchment/40 hover:text-parchment/70 transition-colors"
            >
              <Clock size={13} />
              <span>{t("history")}</span>
            </Link>
            <Link
              href={`/characters/${pipelineId}`}
              className="flex items-center gap-1.5 text-xs text-parchment/40 hover:text-parchment/70 transition-colors"
            >
              <Users size={13} />
              <span>{t("tab_characters")}</span>
            </Link>
            <Link
              href={`/scenes/${pipelineId}`}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/30 transition-colors"
            >
              <Film size={13} />
              <span>{t("open_in_editor")}</span>
            </Link>
            <div className="flex rounded-lg overflow-hidden border border-ink-muted text-[11px]">
              <button
                onClick={() => setLang("en")}
                className={`px-2 py-1 transition-colors ${lang === "en" ? "bg-amber-film text-ink font-semibold" : "text-parchment/40 hover:text-parchment/70"}`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("tr")}
                className={`px-2 py-1 transition-colors ${lang === "tr" ? "bg-amber-film text-ink font-semibold" : "text-parchment/40 hover:text-parchment/70"}`}
              >
                TR
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <Link
          href={`/scenes/${pipelineId}`}
          className="flex items-center gap-2 text-sm text-parchment/50 hover:text-parchment transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          {t("back_to_pipeline")}
        </Link>

        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <LayoutGrid size={18} className="text-violet-400" />
              <h2 className="font-display text-3xl font-bold text-parchment">
                {t("storyboard_title")}
              </h2>
            </div>
            <p className="text-parchment/40 text-sm">{t("storyboard_desc")}</p>
            <p className="text-parchment/30 text-xs mt-1">
              {pipeline.story?.title}
              {pipeline.story?.author && ` — ${pipeline.story.author}`}
              {" · "}
              {pipeline.scenes?.length || 0} {t("scenes_count")}
            </p>
          </div>
        </div>

        {/* Progress summary */}
        <div className="mb-6 flex flex-wrap gap-4 text-[11px] text-parchment/40 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {t("progress_backgrounds")}: {progress.backgrounds}/{progress.total}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {t("progress_composites")}: {progress.composites}/{progress.total}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            {t("progress_audio")}: {progress.audio}/{progress.total}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-500" />
            {t("progress_videos")}: {progress.videos}/{progress.total}
          </span>
        </div>

        {/* Scene grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipeline.scenes?.map((scene, idx) => {
            const thumbnail = getThumbnail(scene.id);
            const status = getStepStatus(scene);
            const hasDialogue = (scene.dialogue?.length || 0) > 0;
            const setName = scene.set_id ? allSets.find((s) => s.id === scene.set_id)?.name : null;

            return (
              <Link
                key={scene.id}
                href={`/scenes/${pipelineId}`}
                className="bg-ink-soft border border-ink-muted rounded-xl overflow-hidden hover:border-amber-film/30 transition-all group"
              >
                {/* Thumbnail */}
                <div className="aspect-[9/16] max-h-48 bg-ink relative overflow-hidden">
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={scene.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl font-display font-bold text-parchment/10">
                        {idx + 1}
                      </span>
                    </div>
                  )}

                  {/* Step dots overlay */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${status.hasBg ? "bg-emerald-400" : "bg-parchment/10"}`} title="Background" />
                    <span className={`w-1.5 h-1.5 rounded-full ${status.hasComp ? "bg-amber-400" : "bg-parchment/10"}`} title="Composite" />
                    <span className={`w-1.5 h-1.5 rounded-full ${status.hasAudio ? "bg-cyan-400" : "bg-parchment/10"}`} title="Audio" />
                    <span className={`w-1.5 h-1.5 rounded-full ${status.hasVideo ? "bg-violet-400" : "bg-parchment/10"}`} title="Video" />
                  </div>

                  {status.hasVideo && (
                    <div className="absolute top-2 right-2 p-0.5 rounded-full bg-emerald-500 text-ink">
                      <Check size={8} />
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-mono text-emerald-400/60">{scene.id}</span>
                    {hasDialogue && (
                      <span className="text-[9px] px-1 py-0.5 rounded-full bg-violet-900/30 text-violet-400/70 font-mono">
                        {t("dialogue_label")}
                      </span>
                    )}
                    {!hasDialogue && scene.narration && (
                      <span className="text-[9px] px-1 py-0.5 rounded-full bg-blue-900/30 text-blue-400/70 font-mono">
                        {t("narration_label")}
                      </span>
                    )}
                    {setName && (
                      <span className="text-[9px] px-1 py-0.5 rounded-full bg-cyan-900/30 text-cyan-400/70 font-mono flex items-center gap-0.5">
                        <MapPin size={7} />
                        {setName}
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-semibold text-parchment/70 mb-1.5 line-clamp-1">
                    {scene.title}
                  </h4>

                  {/* Character portraits */}
                  {(scene.characters?.length || 0) > 0 && (
                    <div className="flex items-center gap-1 mb-1.5">
                      {scene.characters.map((charId) => {
                        const url = getCharPortraitUrl(charId);
                        return url ? (
                          <img
                            key={charId}
                            src={url}
                            alt={getCharName(charId)}
                            className="w-5 h-5 rounded-full border border-ink-muted object-cover"
                            title={getCharName(charId)}
                          />
                        ) : (
                          <div
                            key={charId}
                            className="w-5 h-5 rounded-full border border-ink-muted bg-ink flex items-center justify-center"
                            title={getCharName(charId)}
                          >
                            <span className="text-[7px] text-parchment/20 font-mono">
                              {getCharName(charId).charAt(0)}
                            </span>
                          </div>
                        );
                      })}
                      <span className="text-[9px] text-parchment/20 ml-1">
                        {scene.characters.map((cid) => getCharName(cid)).join(", ")}
                      </span>
                    </div>
                  )}

                  {/* Content snippet */}
                  {hasDialogue ? (
                    <p className="text-[10px] text-parchment/30 leading-relaxed line-clamp-2 italic">
                      &quot;{scene.dialogue[0]?.line}&quot;
                    </p>
                  ) : scene.narration ? (
                    <p className="text-[10px] text-parchment/30 leading-relaxed line-clamp-2 italic">
                      {scene.narration}
                    </p>
                  ) : (
                    <p className="text-[10px] text-parchment/15 italic">{t("no_content")}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      <footer className="border-t border-ink-muted/30 mt-20 py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs text-parchment/20">
          <span>{t("footer_text")}</span>
          <span className="font-mono">v1.0</span>
        </div>
      </footer>
    </div>
  );
}
