CREATE TABLE "runbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"services" text[] DEFAULT '{}' NOT NULL,
	"embedding" vector(768) NOT NULL,
	"embedding_model" text DEFAULT 'gemini-embedding-001' NOT NULL,
	"tsv_content" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
