


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."characters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "character_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "prompt" "text" NOT NULL,
    "model_used" "text" NOT NULL,
    "image_url" "text" NOT NULL,
    "fal_request_id" "text",
    "width" integer,
    "height" integer,
    "seed" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."characters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipelines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "author" "text",
    "genre" "text",
    "source_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "model_used" "text",
    "story_char_count" integer,
    "pipeline_data" "jsonb" NOT NULL,
    "raw_json" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pipelines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scene_audio" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "scene_id" "text" NOT NULL,
    "character_id" "text",
    "text" "text" NOT NULL,
    "model_used" "text" NOT NULL,
    "audio_url" "text" NOT NULL,
    "duration_ms" integer,
    "fal_request_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scene_audio" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scene_composites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "scene_id" "text" NOT NULL,
    "background_image_id" "uuid",
    "prompt" "text" NOT NULL,
    "model_used" "text" NOT NULL,
    "image_url" "text" NOT NULL,
    "width" integer,
    "height" integer,
    "seed" "text",
    "fal_request_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scene_composites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scene_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "scene_id" "text" NOT NULL,
    "prompt" "text" NOT NULL,
    "model_used" "text" NOT NULL,
    "image_url" "text" NOT NULL,
    "width" integer,
    "height" integer,
    "seed" "text",
    "fal_request_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scene_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scene_videos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "scene_id" "text" NOT NULL,
    "composite_image_id" "uuid",
    "prompt" "text" NOT NULL,
    "model_used" "text" NOT NULL,
    "video_url" "text" NOT NULL,
    "duration" integer,
    "fal_request_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scene_videos" OWNER TO "postgres";


ALTER TABLE ONLY "public"."characters"
    ADD CONSTRAINT "characters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipelines"
    ADD CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scene_audio"
    ADD CONSTRAINT "scene_audio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scene_composites"
    ADD CONSTRAINT "scene_composites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scene_images"
    ADD CONSTRAINT "scene_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scene_videos"
    ADD CONSTRAINT "scene_videos_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_characters_lookup" ON "public"."characters" USING "btree" ("pipeline_id", "character_id");



CREATE INDEX "idx_pipelines_created_at" ON "public"."pipelines" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_scene_audio_lookup" ON "public"."scene_audio" USING "btree" ("pipeline_id", "scene_id");



CREATE INDEX "idx_scene_composites_lookup" ON "public"."scene_composites" USING "btree" ("pipeline_id", "scene_id");



CREATE INDEX "idx_scene_images_lookup" ON "public"."scene_images" USING "btree" ("pipeline_id", "scene_id");



CREATE INDEX "idx_scene_videos_lookup" ON "public"."scene_videos" USING "btree" ("pipeline_id", "scene_id");



ALTER TABLE ONLY "public"."characters"
    ADD CONSTRAINT "characters_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scene_audio"
    ADD CONSTRAINT "scene_audio_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scene_composites"
    ADD CONSTRAINT "scene_composites_background_image_id_fkey" FOREIGN KEY ("background_image_id") REFERENCES "public"."scene_images"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scene_composites"
    ADD CONSTRAINT "scene_composites_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scene_images"
    ADD CONSTRAINT "scene_images_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scene_videos"
    ADD CONSTRAINT "scene_videos_composite_image_id_fkey" FOREIGN KEY ("composite_image_id") REFERENCES "public"."scene_composites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scene_videos"
    ADD CONSTRAINT "scene_videos_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."characters" TO "anon";
GRANT ALL ON TABLE "public"."characters" TO "authenticated";
GRANT ALL ON TABLE "public"."characters" TO "service_role";



GRANT ALL ON TABLE "public"."pipelines" TO "anon";
GRANT ALL ON TABLE "public"."pipelines" TO "authenticated";
GRANT ALL ON TABLE "public"."pipelines" TO "service_role";



GRANT ALL ON TABLE "public"."scene_audio" TO "anon";
GRANT ALL ON TABLE "public"."scene_audio" TO "authenticated";
GRANT ALL ON TABLE "public"."scene_audio" TO "service_role";



GRANT ALL ON TABLE "public"."scene_composites" TO "anon";
GRANT ALL ON TABLE "public"."scene_composites" TO "authenticated";
GRANT ALL ON TABLE "public"."scene_composites" TO "service_role";



GRANT ALL ON TABLE "public"."scene_images" TO "anon";
GRANT ALL ON TABLE "public"."scene_images" TO "authenticated";
GRANT ALL ON TABLE "public"."scene_images" TO "service_role";



GRANT ALL ON TABLE "public"."scene_videos" TO "anon";
GRANT ALL ON TABLE "public"."scene_videos" TO "authenticated";
GRANT ALL ON TABLE "public"."scene_videos" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







