-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_refunds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "amount_in_cents" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "reviewed_at" DATETIME,
    "user_id" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME,
    CONSTRAINT "refunds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "refunds_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Copia os pedidos existentes convertendo o valor de reais (REAL) para centavos (INTEGER)
INSERT INTO "new_refunds" ("id", "name", "amount_in_cents", "category", "filename", "user_id", "created_at", "updated_at")
SELECT "id", "name", CAST(ROUND("amount" * 100) AS INTEGER), "category", "filename", "user_id", "created_at", "updated_at" FROM "refunds";
DROP TABLE "refunds";
ALTER TABLE "new_refunds" RENAME TO "refunds";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
