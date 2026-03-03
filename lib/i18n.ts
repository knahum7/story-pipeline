export type Language = "en" | "tr";

type TranslationEntry = { en: string; tr: string };

const translations: Record<string, TranslationEntry> = {
  // Header
  brand_subtitle: { en: "Animate any written story", tr: "Herhangi bir hikayeyi canlandır" },
  powered_by: { en: "Powered by Claude", tr: "Claude tarafından desteklenmektedir" },
  history: { en: "History", tr: "Geçmiş" },

  // Hero
  hero_badge: { en: "Story → Characters → Scenes → Animation", tr: "Hikaye → Karakterler → Sahneler → Animasyon" },
  hero_title_1: { en: "Turn any story into", tr: "Herhangi bir hikayeyi" },
  hero_title_2: { en: "an animated film", tr: "animasyon filme dönüştür" },
  hero_description: {
    en: "Paste text, upload a file, or snap photos of book pages. Claude extracts every character, scene, and setting — then generates all prompts and instructions needed to animate it.",
    tr: "Metin yapıştırın, dosya yükleyin veya kitap sayfalarının fotoğraflarını çekin. Claude her karakteri, sahneyi ve mekanı çıkarır — ardından canlandırmak için gereken tüm komutları ve talimatları oluşturur.",
  },
  step_upload: { en: "Upload Story or Photos", tr: "Hikaye veya Fotoğraf Yükle" },
  step_parse: { en: "Parse with AI", tr: "AI ile Ayrıştır" },
  step_prompts: { en: "Get Prompts", tr: "Komutları Al" },
  step_animate: { en: "Animate", tr: "Canlandır" },

  // Processing states
  extracting_images: { en: "Extracting text from images...", tr: "Görsellerden metin çıkarılıyor..." },
  sending_to_claude: { en: "Sending to Claude...", tr: "Claude'a gönderiliyor..." },
  building_pipeline: { en: "Building pipeline...", tr: "Pipeline oluşturuluyor..." },
  reading_pages: { en: "Reading your pages with Google Vision", tr: "Sayfalarınız Google Vision ile okunuyor" },
  usually_takes: { en: "This usually takes 30–90 seconds", tr: "Bu genellikle 30–90 saniye sürer" },

  // Done state
  visual_view: { en: "Visual View", tr: "Görsel Görünüm" },
  raw_json: { en: "Raw JSON", tr: "Ham JSON" },
  json: { en: "JSON", tr: "JSON" },
  download_json: { en: "Download JSON", tr: "JSON İndir" },
  new_story: { en: "New Story", tr: "Yeni Hikaye" },
  saved: { en: "Saved", tr: "Kaydedildi" },
  save_failed: { en: "Save failed", tr: "Kaydetme başarısız" },

  // Error state
  pipeline_failed: { en: "Pipeline Failed", tr: "Pipeline Başarısız" },
  try_again: { en: "Try Again", tr: "Tekrar Dene" },
  failed_parse_json: {
    en: "Failed to parse JSON response. The story may be too complex. Try a shorter excerpt.",
    tr: "JSON yanıtı ayrıştırılamadı. Hikaye çok karmaşık olabilir. Daha kısa bir alıntı deneyin.",
  },
  api_request_failed: { en: "API request failed", tr: "API isteği başarısız oldu" },
  unknown_error: { en: "Unknown error", tr: "Bilinmeyen hata" },
  failed_save: { en: "Failed to save", tr: "Kaydetme başarısız" },
  failed_save_pipeline: { en: "Failed to save pipeline", tr: "Pipeline kaydedilemedi" },
  text_extraction_failed: { en: "Text extraction failed", tr: "Metin çıkarma başarısız oldu" },
  extracted_too_short: {
    en: "Extracted text is too short. Try uploading clearer images or more pages.",
    tr: "Çıkarılan metin çok kısa. Daha net görseller veya daha fazla sayfa yüklemeyi deneyin.",
  },

  // Footer
  footer_text: { en: "StoryPipeline · Story-to-Animation Workflow", tr: "StoryPipeline · Hikayeden Animasyona İş Akışı" },

  // StoryUploader - tabs
  tab_text_file: { en: "Text / File", tr: "Metin / Dosya" },
  tab_photos: { en: "Photos of Pages", tr: "Sayfa Fotoğrafları" },

  // StoryUploader - text mode
  drop_file_here: { en: "Drop your story file here", tr: "Hikaye dosyanızı buraya bırakın" },
  click_to_browse: { en: "or click to browse — .txt, .md supported", tr: "veya göz atmak için tıklayın — .txt, .md desteklenir" },
  or_paste_directly: { en: "or paste text directly", tr: "veya doğrudan metin yapıştırın" },
  paste_placeholder: { en: "Paste your story text here...", tr: "Hikaye metninizi buraya yapıştırın..." },
  paste_story_here: { en: "Paste your story here...", tr: "Hikayenizi buraya yapıştırın..." },
  words: { en: "words", tr: "kelime" },
  characters_count: { en: "characters", tr: "karakter" },
  long_story_warning: { en: "Long story — may take 2–3 minutes", tr: "Uzun hikaye — 2–3 dakika sürebilir" },
  parsing_with_claude: { en: "Parsing story with Claude...", tr: "Hikaye Claude ile ayrıştırılıyor..." },
  generate_pipeline: { en: "Generate Animation Pipeline", tr: "Animasyon Pipeline Oluştur" },
  min_chars_hint: {
    en: "Minimum 100 characters · Up to 80,000 characters (~32 pages)",
    tr: "Minimum 100 karakter · 80.000 karaktere kadar (~32 sayfa)",
  },

  // StoryUploader - image mode
  upload_photos: { en: "Upload photos of your story pages", tr: "Hikaye sayfalarınızın fotoğraflarını yükleyin" },
  drop_images: { en: "Drop images here or click to browse — JPEG, PNG, WebP", tr: "Görselleri buraya bırakın veya göz atmak için tıklayın — JPEG, PNG, WebP" },
  photo_hint: {
    en: "Take photos of book pages, printed manuscripts, or handwritten stories. Claude will extract the text and build your animation pipeline.",
    tr: "Kitap sayfalarının, basılı el yazmalarının veya el yazısı hikayelerin fotoğraflarını çekin. Claude metni çıkaracak ve animasyon pipeline'ınızı oluşturacaktır.",
  },
  add_more: { en: "+ Add more", tr: "+ Daha ekle" },
  sorted_hint: { en: "Sorted by filename · Drag to reorder · Up to 20 images", tr: "Dosya adına göre sıralı · Sürükleyerek yeniden sıralayın · En fazla 20 görsel" },
  extract_and_generate: { en: "Extract Text & Generate Pipeline", tr: "Metin Çıkar ve Pipeline Oluştur" },
  image_formats_hint: { en: "Supports JPEG, PNG, GIF, WebP · Up to 20 pages per upload", tr: "JPEG, PNG, GIF, WebP desteklenir · Yükleme başına en fazla 20 sayfa" },

  // ResultsViewer - tabs
  tab_overview: { en: "Overview", tr: "Genel Bakış" },
  tab_characters: { en: "Characters", tr: "Karakterler" },
  tab_scenes: { en: "Scenes", tr: "Sahneler" },

  // ResultsViewer - labels
  pipeline_generated: { en: "Pipeline Generated", tr: "Pipeline Oluşturuldu" },
  by_author: { en: "by", tr: "yazar:" },
  copy: { en: "Copy", tr: "Kopyala" },
  copied: { en: "Copied!", tr: "Kopyalandı!" },
  portrait_prompt: { en: "Portrait Prompt", tr: "Portre Komutu" },
  dialogue: { en: "DIALOGUE", tr: "DİYALOG" },
  scene_image_prompt: { en: "Scene Image Prompt", tr: "Sahne Görsel Komutu" },
  animation_prompt: { en: "Animation Prompt", tr: "Animasyon Komutu" },
  scenes_count: { en: "scenes", tr: "sahne" },
  art_style_direction: { en: "Art Style Direction", tr: "Sanat Stili Yönlendirmesi" },

  // StreamingOutput
  building_your_pipeline: { en: "Claude is building your pipeline...", tr: "Claude pipeline'ınızı oluşturuyor..." },
  waiting_for_output: { en: "Waiting for output...", tr: "Çıktı bekleniyor..." },

  // History page
  new_pipeline: { en: "+ New Pipeline", tr: "+ Yeni Pipeline" },
  back_to_history: { en: "Back to history", tr: "Geçmişe dön" },
  pipeline_history: { en: "Pipeline History", tr: "Pipeline Geçmişi" },
  all_pipelines_desc: { en: "All previously generated animation pipelines", tr: "Daha önce oluşturulan tüm animasyon pipeline'ları" },
  retry: { en: "Retry", tr: "Tekrar Dene" },
  no_pipelines_yet: { en: "No pipelines yet", tr: "Henüz pipeline yok" },
  no_pipelines_desc: { en: "Generate your first animation pipeline to see it here", tr: "İlk animasyon pipeline'ınızı oluşturarak burada görün" },
  create_pipeline: { en: "Create Pipeline", tr: "Pipeline Oluştur" },
  loading_pipeline: { en: "Loading pipeline...", tr: "Pipeline yükleniyor..." },

  // Characters page
  characters_title: { en: "Character Generation", tr: "Karakter Oluşturma" },
  characters_desc: { en: "Generate character portraits using AI", tr: "AI kullanarak karakter portreleri oluşturun" },
  generate_characters: { en: "Generate Characters", tr: "Karakter Oluştur" },
  generate: { en: "Generate", tr: "Oluştur" },
  generating: { en: "Generating...", tr: "Oluşturuluyor..." },
  generate_all: { en: "Generate All Portraits", tr: "Tüm Portreleri Oluştur" },
  generating_all: { en: "Generating all...", tr: "Tümü oluşturuluyor..." },
  no_images_yet: { en: "No images generated yet", tr: "Henüz görsel oluşturulmadı" },
  reset_prompt: { en: "Reset", tr: "Sıfırla" },
  edit: { en: "Edit", tr: "Düzenle" },
  editing: { en: "Editing", tr: "Düzenleniyor" },
  delete_image: { en: "Delete", tr: "Sil" },
  confirm_delete: { en: "Delete this image?", tr: "Bu görseli sil?" },
  generation_failed: { en: "Generation failed", tr: "Oluşturma başarısız" },
  back_to_pipeline: { en: "Back to pipeline", tr: "Pipeline'a dön" },
  prompt_used: { en: "Prompt", tr: "Komut" },

  // Add Character modal
  add_new_character: { en: "+ Add Character", tr: "+ Karakter Ekle" },
  add_character_title: { en: "Add New Character", tr: "Yeni Karakter Ekle" },
  character_name: { en: "Character Name", tr: "Karakter Adı" },
  character_name_placeholder: { en: "e.g. Captain Morgan", tr: "ör. Kaptan Morgan" },
  character_description: { en: "Description (for AI prompt help)", tr: "Açıklama (AI komut yardımı için)" },
  character_description_placeholder: { en: "e.g. A grizzled old sailor with a wooden leg and a parrot on his shoulder", tr: "ör. Tahta bacaklı, omzunda papağanı olan tecrübeli yaşlı bir denizci" },
  reference_image: { en: "Reference Image (optional)", tr: "Referans Görsel (isteğe bağlı)" },
  drop_reference: { en: "Drop an image here or click to browse", tr: "Bir görsel sürükleyin veya göz atmak için tıklayın" },
  drop_reference_formats: { en: "JPEG, PNG, WebP supported", tr: "JPEG, PNG, WebP desteklenir" },
  ai_help: { en: "AI Help", tr: "AI Yardım" },
  ai_help_generating: { en: "Generating...", tr: "Oluşturuluyor..." },
  ai_help_overwrite: { en: "Replace current prompt with AI suggestion?", tr: "Mevcut komut AI önerisiyle değiştirilsin mi?" },
  prompt_placeholder: { en: "Describe the character portrait you want to generate...", tr: "Oluşturmak istediğiniz karakter portresini açıklayın..." },
  name_required: { en: "Character name is required", tr: "Karakter adı gerekli" },
  prompt_required: { en: "A prompt is required to generate", tr: "Oluşturmak için komut gerekli" },
  add_reference_image: { en: "Add reference image for I2I generation (drag & drop or click)", tr: "I2I oluşturma için referans görsel ekle (sürükle-bırak veya tıkla)" },
  custom_characters: { en: "Custom Characters", tr: "Özel Karakterler" },
  cancel: { en: "Cancel", tr: "İptal" },
  create_and_generate: { en: "Generate Portrait", tr: "Portre Oluştur" },

  // Scenes page
  scenes_title: { en: "Scene Generation", tr: "Sahne Oluşturma" },
  scenes_desc: { en: "Generate scene images and videos", tr: "Sahne görselleri ve videoları oluşturun" },
  generate_scenes: { en: "Generate Scenes", tr: "Sahne Oluştur" },
  generating_scene: { en: "Generating scene...", tr: "Sahne oluşturuluyor..." },
  generating_all_scenes: { en: "Generating all scenes...", tr: "Tüm sahneler oluşturuluyor..." },
  back_to_characters: { en: "Back to characters", tr: "Karakterlere dön" },
  modified: { en: "modified", tr: "değiştirildi" },
  generate_video: { en: "Generate Video", tr: "Video Oluştur" },
  generating_video: { en: "Generating video...", tr: "Video oluşturuluyor..." },
  add_custom_scene: { en: "+ Add Scene", tr: "+ Sahne Ekle" },
  add_custom_scene_title: { en: "Add New Scene", tr: "Yeni Sahne Ekle" },
  scene_title_label: { en: "Scene Title", tr: "Sahne Başlığı" },
  scene_title_placeholder: { en: "e.g. The Final Confrontation", tr: "ör. Son Karşılaşma" },
  scene_description_label: { en: "Description (for AI prompt help)", tr: "Açıklama (AI komut yardımı için)" },
  scene_description_placeholder: { en: "e.g. Two characters face off in a dark alley under rain", tr: "ör. İki karakter yağmur altında karanlık bir sokakta karşı karşıya" },
  scene_prompt_placeholder: { en: "Describe the scene you want to generate...", tr: "Oluşturmak istediğiniz sahneyi açıklayın..." },

  // Style image
  style_image_label: { en: "Style Reference Image", tr: "Stil Referans Görseli" },
  style_image_desc: {
    en: "A style reference image is included in all generation calls to ensure visual consistency. Generate one from the style prompt below.",
    tr: "Görsel tutarlılık sağlamak için tüm oluşturma çağrılarına bir stil referans görseli eklenir. Aşağıdaki stil komutundan bir tane oluşturun.",
  },
  style_image_active_desc: {
    en: "This image is included as a reference in all generation calls for consistent visuals.",
    tr: "Bu görsel, tutarlı görseller için tüm oluşturma çağrılarında referans olarak eklenir.",
  },
  active: { en: "Active", tr: "Aktif" },
  required: { en: "Required", tr: "Gerekli" },
  generate_style_image: { en: "Generate Style Image", tr: "Stil Görseli Oluştur" },
  regenerate_style_image: { en: "Regenerate Style Image", tr: "Stil Görselini Yeniden Oluştur" },
  generating_style_image: { en: "Generating style image...", tr: "Stil görseli oluşturuluyor..." },
  style_image_required_msg: {
    en: "A style reference image is required before generating characters or scenes.",
    tr: "Karakter veya sahne oluşturmadan önce bir stil referans görseli gereklidir.",
  },
  go_to_characters: { en: "Go to Characters page", tr: "Karakterler sayfasına git" },

  // Style prompt
  style_prompt_label: { en: "Style Prompt", tr: "Stil Komutu" },
  style_prompt_placeholder: {
    en: "e.g. Dark moody watercolor painting, muted earth tones with deep indigo shadows, soft diffused lighting, visible brushstrokes, grain texture",
    tr: "ör. Koyu, kasvetli suluboya tablo, derin indigo gölgeli soluk toprak tonları, yumuşak dağınık aydınlatma, görünür fırça darbeleri, tane dokusu",
  },
  saving: { en: "Saving...", tr: "Kaydediliyor..." },
  save: { en: "Save", tr: "Kaydet" },

  // Scene generation steps
  step_background: { en: "Background", tr: "Arka Plan" },
  step_composite: { en: "Composite Characters", tr: "Karakter Yerleştirme" },
  step_audio: { en: "Speech Audio (TTS)", tr: "Konuşma Sesi (TTS)" },
  step_narration_audio: { en: "Narration Audio (TTS)", tr: "Anlatı Sesi (TTS)" },
  step_video: { en: "Video", tr: "Video" },
  dialogue_label: { en: "Dialogue", tr: "Diyalog" },
  narration_label: { en: "Narration", tr: "Anlatı" },
  generate_background: { en: "Generate Background", tr: "Arka Plan Oluştur" },
  generate_all_backgrounds: { en: "Generate All Backgrounds", tr: "Tüm Arka Planları Oluştur" },
  select_background_first: { en: "Select a background image first", tr: "Önce bir arka plan görseli seçin" },
  characters_to_composite: { en: "Characters", tr: "Karakterler" },
  composite_characters: { en: "Composite Characters", tr: "Karakterleri Yerleştir" },
  compositing: { en: "Compositing...", tr: "Yerleştiriliyor..." },
  select_composite_first: { en: "Select a composited image first", tr: "Önce birleştirilmiş bir görsel seçin" },
  generate_audio: { en: "Generate Audio", tr: "Ses Oluştur" },
  generating_audio: { en: "Generating audio...", tr: "Ses oluşturuluyor..." },
  generate_audio_first: { en: "Generate audio first before creating video", tr: "Video oluşturmadan önce ses oluşturun" },
  dialogue_text: { en: "Dialogue", tr: "Diyalog" },
  narration_text: { en: "Narration", tr: "Anlatı" },
  narration_mux_info: { en: "Narration baked into video", tr: "Anlatı videoya gömülür" },

  // Batch generation & progress
  generate_all_composites: { en: "Generate All Composites", tr: "Tüm Kompozitleri Oluştur" },
  generate_all_audio: { en: "Generate All Audio", tr: "Tüm Sesleri Oluştur" },
  generate_all_videos: { en: "Generate All Videos", tr: "Tüm Videoları Oluştur" },
  run_full_pipeline: { en: "Run Full Pipeline", tr: "Tüm Pipeline'ı Çalıştır" },
  pipeline_running: { en: "Pipeline running...", tr: "Pipeline çalışıyor..." },
  progress_backgrounds: { en: "Backgrounds", tr: "Arka Planlar" },
  progress_composites: { en: "Composites", tr: "Kompozitler" },
  progress_audio: { en: "Audio", tr: "Ses" },
  progress_videos: { en: "Videos", tr: "Videolar" },
  pipeline_step_label: { en: "Step", tr: "Adım" },
  stop_pipeline: { en: "Stop", tr: "Durdur" },
  storyboard: { en: "Storyboard", tr: "Storyboard" },
  storyboard_title: { en: "Storyboard", tr: "Storyboard" },
  storyboard_desc: { en: "Visual overview of all scenes", tr: "Tüm sahnelerin görsel özeti" },
  open_in_editor: { en: "Open in Editor", tr: "Editörde Aç" },
  no_content: { en: "No dialogue or narration", tr: "Diyalog veya anlatı yok" },
  videos_count: { en: "videos", tr: "video" },
  assemble_movie: { en: "Assemble Movie", tr: "Filmi Birleştir" },
  assembling_movie: { en: "Assembling movie...", tr: "Film birleştiriliyor..." },
  movie_ready: { en: "Movie Ready", tr: "Film Hazır" },
  download_movie: { en: "Download Movie", tr: "Filmi İndir" },
  reassemble_movie: { en: "Re-assemble", tr: "Yeniden Birleştir" },
  movie_assemble_failed: { en: "Movie assembly failed", tr: "Film birleştirme başarısız" },
  scenes_missing_videos: { en: "scene(s) still need videos", tr: "sahne hala video bekliyor" },

  // Voice preview
  preview_voice: { en: "Preview Voice", tr: "Sesi Dinle" },
  voice_preview_failed: { en: "Voice preview failed", tr: "Ses önizleme başarısız" },

  // Style prompt errors
  style_prompt_save_failed: { en: "Failed to save style prompt", tr: "Stil komutu kaydedilemedi" },
  style_prompt_required: { en: "Style prompt is required to generate a style image", tr: "Stil görseli oluşturmak için stil komutu gerekli" },

  // Dynamic (with interpolation)
  pages_selected: { en: "page(s) selected", tr: "sayfa seçildi" },
  extracting_pages: { en: "Extracting text from", tr: "Şuradan metin çıkarılıyor:" },
  pages_suffix: { en: "page(s)...", tr: "sayfa..." },
};

export function t(key: string, lang: Language): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry.en;
}

export default translations;
