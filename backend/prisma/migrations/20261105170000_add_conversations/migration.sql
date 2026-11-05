CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "participants" UUID[] NOT NULL,
    "last_message_id" UUID,
    "last_message" TEXT,
    "last_message_sender_id" UUID,
    "last_message_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conversations_participants_key" UNIQUE ("participants"),
    CONSTRAINT "conversations_participants_valid"
        CHECK (
            cardinality("participants") = 2
            AND "participants"[1] < "participants"[2]
        )
);

CREATE INDEX "conversations_participants_gin_idx"
    ON "conversations" USING GIN ("participants");
