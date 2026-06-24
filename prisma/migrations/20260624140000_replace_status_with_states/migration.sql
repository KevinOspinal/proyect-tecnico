-- CreateTable states
CREATE TABLE "states" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "states_name_key" ON "states"("name");

-- Seed the three canonical states
INSERT INTO "states" ("name") VALUES ('abierto'), ('proceso'), ('finalizado');

-- Add state_id as nullable first so we can migrate data
ALTER TABLE "interactions" ADD COLUMN "state_id" INTEGER;

-- Migrate existing enum values to the new FK
UPDATE "interactions" SET "state_id" = 1 WHERE "status" = 'abierta';
UPDATE "interactions" SET "state_id" = 2 WHERE "status" = 'en_progreso';
UPDATE "interactions" SET "state_id" = 3 WHERE "status" = 'resuelta';

-- Now enforce NOT NULL
ALTER TABLE "interactions" ALTER COLUMN "state_id" SET NOT NULL;

-- Add FK constraint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_state_id_fkey"
    FOREIGN KEY ("state_id") REFERENCES "states"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old indexes that referenced status
DROP INDEX IF EXISTS "interactions_agentId_status_idx";
DROP INDEX IF EXISTS "interactions_status_idx";

-- Drop old status column and enum
ALTER TABLE "interactions" DROP COLUMN "status";
DROP TYPE IF EXISTS "InteractionStatus";

-- Create new indexes
CREATE INDEX "interactions_agent_id_state_id_idx" ON "interactions"("agent_id", "state_id");
CREATE INDEX "interactions_state_id_idx" ON "interactions"("state_id");
