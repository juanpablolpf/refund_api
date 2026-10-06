-- Liga o Row-Level Security em todas as tabelas do schema public.
-- No Supabase, essas tabelas também ficam expostas pela API REST automática
-- (chave "anon"). Com RLS ligado e sem nenhuma policy, essa via não lê nem
-- escreve nada. A nossa API conecta como dona das tabelas e não é afetada.
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
