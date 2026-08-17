CREATE TABLE "eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"incident_title" text NOT NULL,
	"ground_truth_root_cause" text NOT NULL,
	"hypothesis" text,
	"log_findings" text,
	"runbook_findings" text,
	"correctness_score" double precision NOT NULL,
	"groundedness_score" double precision NOT NULL,
	"reasoning" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;