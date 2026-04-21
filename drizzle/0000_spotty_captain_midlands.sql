CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email_encrypted" text NOT NULL,
	"email_hash" text NOT NULL,
	"email_det" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_hash_unique" UNIQUE("email_hash")
);
