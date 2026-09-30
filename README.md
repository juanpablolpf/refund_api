# Refund API

API de solicitação de reembolso. O funcionário envia um pedido com o comprovante, e o gestor aprova ou recusa.

Feita com Node.js, Express, Prisma (PostgreSQL), Zod e JWT. Os comprovantes ficam numa pasta local ou em qualquer armazenamento compatível com S3.

## Como funciona

1. O funcionário cria a conta (`POST /users`) e faz login (`POST /sessions`)
2. Envia a foto do comprovante (`POST /uploads`) e recebe o `filename`
3. Cria o pedido com esse `filename` (`POST /refunds`), que começa como **pendente**
4. O gestor lista os pedidos (`GET /refunds`) e **aprova** ou **recusa** com um motivo
5. Enquanto está pendente, o funcionário pode cancelar o pedido

## Rodando localmente

Precisa do Node.js 20.16+ e do Docker Desktop aberto (ele roda o Postgres).

```bash
npm install
cp .env.example .env          # depois preencha o JWT_SECRET (veja abaixo)
npm run db:up                 # sobe o Postgres no Docker
npm run db:migrate            # cria as tabelas
npm run create-manager -- "Seu Nome" voce@empresa.com suasenha
npm run dev                   # http://localhost:3333
```

### Variáveis de ambiente (`.env`)

| Variável | Para que serve |
|---|---|
| `JWT_SECRET` | Segredo que assina os tokens de login. Mínimo de 32 caracteres. Gere com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DATABASE_URL` | Endereço do Postgres. O `.env.example` já traz o do Docker |
| `PORT` | Porta do servidor (padrão `3333`) |
| `NODE_ENV` | `development` mostra as queries no terminal; `production` não |
| `CORS_ORIGIN` | Endereço do front autorizado a chamar a API. Vazio libera qualquer origem |
| `STORAGE_DRIVER` | `disk` guarda os comprovantes em `tmp/uploads`; `s3` usa um bucket (variáveis `S3_*`) |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Dados do bucket, obrigatórios quando `STORAGE_DRIVER=s3` |

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor em modo desenvolvimento (reinicia ao salvar) |
| `npm test` | Roda os testes automatizados (usam o schema `test` do Postgres, apagado no final) |
| `npm run typecheck` | Confere os tipos do TypeScript |
| `npm run build` | Gera a versão de produção em `build/` |
| `npm start` | Roda a versão de produção (as variáveis precisam estar no ambiente) |
| `npm run db:up` | Sobe o Postgres de desenvolvimento no Docker |
| `npm run db:migrate` | Aplica as migrações no banco do `DATABASE_URL` |
| `npm run create-manager -- "Nome" email senha` | Cria um gestor ou promove uma conta existente |
| `npm run create-manager:prod -- "Nome" email senha` | O mesmo, no banco de produção (lê o `.env.production`) |

## Usuários e permissões

- Todo cadastro público vira **funcionário** (`employee`)
- **Gestores** (`manager`) só são criados pelo `npm run create-manager`, direto no servidor
- As rotas privadas exigem o cabeçalho `Authorization: Bearer <token>`

## Rotas

### Públicas

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/users` | `{ name, email, password }` | 201 |
| POST | `/sessions` | `{ email, password }` | `{ token, user }` |

### Funcionário

| Método | Rota | O que faz |
|---|---|---|
| POST | `/uploads` | Envia o comprovante (form-data, campo `file`; JPG ou PNG até 3MB). Devolve `{ filename }` |
| POST | `/refunds` | Cria o pedido: `{ name, category, amountInCents, filename }` |
| GET | `/refunds/me` | Lista os próprios pedidos |
| DELETE | `/refunds/:id` | Cancela um pedido próprio que ainda está pendente |

### Gestor

| Método | Rota | O que faz |
|---|---|---|
| GET | `/refunds` | Lista todos os pedidos. Filtro opcional `?name=` (nome do funcionário) |
| PATCH | `/refunds/:id/approve` | Aprova um pedido pendente |
| PATCH | `/refunds/:id/reject` | Recusa um pedido pendente: `{ reason }` |

### Funcionário e gestor

| Método | Rota | O que faz |
|---|---|---|
| GET | `/refunds/:id` | Detalhe do pedido (funcionário só vê os próprios) |
| GET | `/uploads/:filename` | Imagem do comprovante (funcionário só vê os próprios) |

As listagens aceitam `?status=pending|approved|rejected`, `?page=` e `?perPage=` (máximo 50).

### Campos do pedido

- `amountInCents`: valor **em centavos**, número inteiro. R$ 35,50 → `3550`
- `category`: `food`, `transport`, `accommodation`, `services` ou `others`
- `status`: `pending`, `approved` ou `rejected`
- `rejectionReason`, `reviewedBy` e `reviewedAt` são preenchidos quando o gestor analisa o pedido

### Erros

Todo erro vem como `{ "message": "..." }`. Os status usados são:

| Status | Quando acontece |
|---|---|
| 400 | Dados inválidos (erros de validação trazem também `issues`) |
| 401 | Sem login ou token inválido |
| 403 | Logado, mas sem permissão para a rota |
| 404 | Não encontrado, ou pertence a outra pessoa |
| 409 | Pedido que já foi analisado |

## Deploy grátis (Render + Supabase)

O banco é Postgres comum e os comprovantes usam o protocolo S3, então dá para trocar de provedor mudando só as variáveis de ambiente.

### 1. Supabase (banco e comprovantes)

1. Crie um projeto em [supabase.com](https://supabase.com) na região **East US (North Virginia)**, a mesma do Render
2. **Banco:** clique em **Connect** e copie a string do **Session pooler** (porta 5432). Ela vai no `DATABASE_URL`
3. **Bucket:** em **Storage**, crie um bucket **privado** chamado `comprovantes`
4. **Chaves S3:** em **Storage → Settings → S3 Connection**, anote o *Endpoint* e a *Region* e gere um *access key*

### 2. Render (API)

Crie um **Web Service** a partir deste repositório, no plano **Free** e na região **Virginia**:

| Campo | Valor |
|---|---|
| Build Command | `npm install --include=dev && npm run build` |
| Start Command | `npm run db:migrate && npm start` |
| Health Check Path | `/health` |

Variáveis de ambiente no Render:

```
NODE_ENV=production
NODE_VERSION=22
JWT_SECRET=<um segredo novo, diferente do local>
DATABASE_URL=<Session pooler do Supabase>
STORAGE_DRIVER=s3
S3_ENDPOINT=<endpoint S3 do Supabase>
S3_REGION=<região do Supabase>
S3_BUCKET=comprovantes
S3_ACCESS_KEY_ID=<access key>
S3_SECRET_ACCESS_KEY=<secret key>
CORS_ORIGIN=<endereço do front, quando existir>
```

### 3. Primeiro gestor

O plano grátis do Render não dá acesso ao terminal do servidor. Por isso o gestor é criado a partir do seu computador: crie um arquivo `.env.production` com `JWT_SECRET` e o `DATABASE_URL` do Supabase (ele não vai para o git) e rode:

```bash
npm run create-manager:prod -- "Seu Nome" voce@empresa.com suasenha
```

### Limites do plano grátis

- **Render:** a API dorme depois de 15 minutos sem uso, e a primeira requisição depois disso demora alguns segundos
- **Supabase:** o projeto pausa depois de 1 semana sem uso. Para reativar, entre no painel e clique em *Restore*
