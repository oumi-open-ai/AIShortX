-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "openid" TEXT NOT NULL,
    "nickname" TEXT,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'REGULAR',
    "vip_expire_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_llm_configs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model_value" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_llm_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "styles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "prompt" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "projects" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "aspect_ratio" TEXT NOT NULL,
    "style_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "projects_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "styles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_episodes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "script" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "project_episodes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_characters" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "library_id" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "voice" TEXT,
    "image_url" TEXT,
    "reference_image_url" TEXT,
    "image_status" TEXT NOT NULL DEFAULT 'idle',
    "video_url" TEXT,
    "video_status" TEXT NOT NULL DEFAULT 'draft',
    "create_status" TEXT NOT NULL DEFAULT 'idle',
    "source" TEXT NOT NULL DEFAULT 'custom',
    "external_id" TEXT,
    "original_data" TEXT,
    "episode_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "project_characters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_characters_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "project_episodes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_scenes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "reference_image_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "episode_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "project_scenes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_scenes_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "project_episodes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_props" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "reference_image_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "episode_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "project_props_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_props_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "project_episodes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_storyboards" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "character_ids" TEXT NOT NULL,
    "prop_ids" TEXT,
    "scene_id" INTEGER,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "prompt" TEXT,
    "image_url" TEXT,
    "image_status" TEXT NOT NULL DEFAULT 'idle',
    "video_url" TEXT,
    "reference_image_url" TEXT,
    "high_res_video_url" TEXT,
    "high_res_status" TEXT NOT NULL DEFAULT 'idle',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "error_msg" TEXT,
    "high_res_error_msg" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "episode_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "project_storyboards_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_storyboards_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "project_scenes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "project_storyboards_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "project_episodes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'image',
    "model" TEXT NOT NULL,
    "provider_id" TEXT,
    "category" TEXT NOT NULL,
    "related_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input_params" TEXT,
    "external_task_id" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "project_id" INTEGER,
    "task_id" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'image',
    "usage" TEXT,
    "related_id" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'generated',
    "url" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assets_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_characters" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatar" TEXT,
    "video" TEXT,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "external_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_prompts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_prompt_configs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_prompt_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_openid_key" ON "users"("openid");

-- CreateIndex
CREATE INDEX "assets_user_id_idx" ON "assets"("user_id");

-- CreateIndex
CREATE INDEX "assets_project_id_idx" ON "assets"("project_id");

-- CreateIndex
CREATE INDEX "assets_related_id_usage_idx" ON "assets"("related_id", "usage");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key_key" ON "user_settings"("user_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "user_prompt_configs_user_id_type_key" ON "user_prompt_configs"("user_id", "type");
