-- Empresas: cada usuário e pedido passa a pertencer a uma empresa

CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "users" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "refunds" ADD COLUMN "organization_id" TEXT;

-- Bancos que já têm usuários: todos entram numa empresa inicial (o gestor pode renomear depois)
INSERT INTO "organizations" ("id", "name")
SELECT gen_random_uuid()::text, 'Minha empresa'
WHERE EXISTS (SELECT 1 FROM "users");

UPDATE "users" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1);
UPDATE "refunds" SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1);

ALTER TABLE "users" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "refunds" ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "refunds_organization_id_status_idx" ON "refunds"("organization_id", "status");

-- Convites por link
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'employee',
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "uses_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");

ALTER TABLE "invites" ADD CONSTRAINT "invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
