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
  tab_settings: { en: "Settings", tr: "Mekanlar" },
  tab_production: { en: "Production", tr: "Prodüksiyon" },

  // ResultsViewer - labels
  pipeline_generated: { en: "Pipeline Generated", tr: "Pipeline Oluşturuldu" },
  by_author: { en: "by", tr: "yazar:" },
  copy: { en: "Copy", tr: "Kopyala" },
  copied: { en: "Copied!", tr: "Kopyalandı!" },
  hair: { en: "Hair", tr: "Saç" },
  build: { en: "Build", tr: "Yapı" },
  style: { en: "Style", tr: "Stil" },
  voice: { en: "Voice", tr: "Ses" },
  portrait_prompt: { en: "Portrait Prompt", tr: "Portre Komutu" },
  subtext: { en: "SUBTEXT", tr: "ALT METİN" },
  key_visual: { en: "KEY VISUAL", tr: "ANA GÖRSEL" },
  dialogue: { en: "DIALOGUE", tr: "DİYALOG" },
  camera: { en: "CAMERA", tr: "KAMERA" },
  scene_image_prompt: { en: "Scene Image Prompt", tr: "Sahne Görsel Komutu" },
  animation_notes: { en: "ANIMATION NOTES", tr: "ANİMASYON NOTLARI" },
  turning_point: { en: "turning point", tr: "dönüm noktası" },
  act: { en: "Act", tr: "Perde" },
  scenes_count: { en: "scenes", tr: "sahne" },
  central_question: { en: "Central Question", tr: "Ana Soru" },
  answer: { en: "Answer", tr: "Yanıt" },
  art_style_direction: { en: "Art Style Direction", tr: "Sanat Stili Yönlendirmesi" },
  voice_casting_summary: { en: "Voice Casting Summary", tr: "Seslendirme Özeti" },
  flashback_sequences: { en: "Flashback Sequences", tr: "Geri Dönüş Sahneleri" },
  flashback_image_prompt: { en: "Flashback Image Prompt", tr: "Geri Dönüş Görsel Komutu" },
  mood: { en: "Mood", tr: "Atmosfer" },
  color_palette: { en: "Color Palette", tr: "Renk Paleti" },
  sound: { en: "Sound", tr: "Ses" },
  setting_image_prompt: { en: "Setting Image Prompt", tr: "Mekan Görsel Komutu" },
  music_direction: { en: "Music Direction", tr: "Müzik Yönlendirmesi" },
  genre: { en: "Genre", tr: "Tür" },
  tempo: { en: "Tempo", tr: "Tempo" },
  tone: { en: "Tone", tr: "Ton" },
  instruments: { en: "Instruments", tr: "Enstrümanlar" },
  reference_tracks: { en: "Reference Tracks", tr: "Referans Parçalar" },
  suno_prompt: { en: "Suno.ai Prompt", tr: "Suno.ai Komutu" },
  production_order: { en: "Production Order", tr: "Prodüksiyon Sırası" },
  recommended_tools: { en: "Recommended Tools", tr: "Önerilen Araçlar" },
  critical_warnings: { en: "Critical Warnings", tr: "Kritik Uyarılar" },

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
  portrait: { en: "Portrait", tr: "Portre" },
  generate: { en: "Generate", tr: "Oluştur" },
  generating: { en: "Generating...", tr: "Oluşturuluyor..." },
  generate_all: { en: "Generate All Portraits", tr: "Tüm Portreleri Oluştur" },
  generating_all: { en: "Generating all...", tr: "Tümü oluşturuluyor..." },
  select_model: { en: "Select Model", tr: "Model Seç" },
  no_images_yet: { en: "No images generated yet", tr: "Henüz görsel oluşturulmadı" },
  select_portrait_hint: { en: "Click a portrait to select it for training views. Double-click to expand.", tr: "Eğitim görüntüleri için bir portre seçmek üzere tıklayın. Büyütmek için çift tıklayın." },
  selected: { en: "Selected", tr: "Seçili" },
  reset_prompt: { en: "Reset to original prompt", tr: "Orijinal komuta sıfırla" },
  delete_image: { en: "Delete", tr: "Sil" },
  confirm_delete: { en: "Delete this image?", tr: "Bu görseli sil?" },
  image_deleted: { en: "Image deleted", tr: "Görsel silindi" },
  generation_failed: { en: "Generation failed", tr: "Oluşturma başarısız" },
  back_to_pipeline: { en: "Back to pipeline", tr: "Pipeline'a dön" },
  char_role: { en: "Role", tr: "Rol" },
  char_age: { en: "Age", tr: "Yaş" },
  char_description: { en: "Description", tr: "Açıklama" },
  prompt_used: { en: "Prompt", tr: "Komut" },
  model_label: { en: "Model", tr: "Model" },
  generated_images: { en: "Generated Images", tr: "Oluşturulan Görseller" },
  expand_image: { en: "Click to expand", tr: "Büyütmek için tıklayın" },

  // Multi-angle & LoRA training
  generate_views: { en: "Generate Training Views", tr: "Eğitim Görüntüleri Oluştur" },
  generating_views: { en: "Generating views...", tr: "Görüntüler oluşturuluyor..." },
  views_count: { en: "training views", tr: "eğitim görüntüsü" },
  train_lora: { en: "Train LoRA", tr: "LoRA Eğit" },
  training_lora: { en: "Training LoRA...", tr: "LoRA eğitiliyor..." },
  lora_ready: { en: "LoRA Ready", tr: "LoRA Hazır" },
  lora_training: { en: "Training...", tr: "Eğitiliyor..." },
  lora_not_trained: { en: "Not trained", tr: "Eğitilmedi" },
  needs_portrait: { en: "Generate a portrait first", tr: "Önce bir portre oluşturun" },
  needs_views: { en: "Generate training views first", tr: "Önce eğitim görüntüleri oluşturun" },
  train_all_loras: { en: "Train All LoRAs", tr: "Tüm LoRA'ları Eğit" },
  generate_all_views: { en: "Generate All Views", tr: "Tüm Görüntüleri Oluştur" },

  // Scenes page
  scenes_title: { en: "Scene Generation", tr: "Sahne Oluşturma" },
  scenes_desc: { en: "Generate scene images with character-consistent LoRAs", tr: "Karakter tutarlı LoRA'lar ile sahne görselleri oluşturun" },
  generate_scenes: { en: "Generate Scenes", tr: "Sahne Oluştur" },
  generate_scene: { en: "Generate Scene", tr: "Sahne Oluştur" },
  generating_scene: { en: "Generating scene...", tr: "Sahne oluşturuluyor..." },
  generate_all_scenes: { en: "Generate All Scenes", tr: "Tüm Sahneleri Oluştur" },
  generating_all_scenes: { en: "Generating all scenes...", tr: "Tüm sahneler oluşturuluyor..." },
  scene_type: { en: "Type", tr: "Tür" },
  scene_setting: { en: "Setting", tr: "Mekan" },
  scene_emotion: { en: "Emotion", tr: "Duygu" },
  scene_narrative: { en: "Narrative", tr: "Anlatı" },
  scene_characters: { en: "Characters in scene", tr: "Sahnedeki karakterler" },
  lora_missing: { en: "LoRA not trained", tr: "LoRA eğitilmedi" },
  all_loras_ready: { en: "All character LoRAs ready", tr: "Tüm karakter LoRA'ları hazır" },
  some_loras_missing: { en: "Some character LoRAs missing", tr: "Bazı karakter LoRA'ları eksik" },
  no_scene_images_yet: { en: "No scene images generated yet", tr: "Henüz sahne görseli oluşturulmadı" },
  back_to_characters: { en: "Back to characters", tr: "Karakterlere dön" },

  // Dynamic (with interpolation)
  pages_selected: { en: "page(s) selected", tr: "sayfa seçildi" },
  extracting_pages: { en: "Extracting text from", tr: "Şuradan metin çıkarılıyor:" },
  pages_suffix: { en: "page(s)...", tr: "sayfa..." },
  page: { en: "page", tr: "sayfa" },
  pages: { en: "pages", tr: "sayfa" },
};

export function t(key: string, lang: Language): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry.en;
}

export default translations;
