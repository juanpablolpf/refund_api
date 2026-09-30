# Refund API

API de solicitação de reembolso. O funcionário envia um pedido com o comprovante, e o gestor aprova ou recusa.

Feita com Node.js, Express, Prisma (SQLite), Zod e JWT.

## Como funciona

1. O funcionário cria a conta (`POST /users`) e faz login (`POST /sessions`)
2. Envia a foto do comprovante (`POST /uploads`) e recebe o `filename`
3. Cria o pedido com esse `filename` (`POST /refunds`), que começa como **pendente**
4. O gestor lista os pedidos (`GET /refunds`) e **aprova** ou **recusa** com um motivo
5. Enquanto está pendente, o funcionário pode cancelar o pedido

## Rodando localmente

Precisa do Node.js 20 ou mais novo.

```bash
npm install
cp .env.example .env          # depois preencha o JWT_SECRET (veja abaixo)
npx prisma migrate deploy     # cria o banco prisma/dev.db
npm run create-manager -- "Seu Nome" voce@empresa.com suasenha
npm run dev                   # http://localhost:3333
```

### Variáveis de ambiente (`.env`)

| Variável | Para que serve |
|---|---|
| `JWT_SECRET` | Segredo que assina os tokens de login. Mínimo de 32 caracteres. Gere com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DATABASE_URL` | Endereço do banco. Local: `file:./dev.db` |
| `PORT` | Porta do servidor (padrão `3333`) |
| `NODE_ENV` | `development` mostra as queries no terminal; `production` não |

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor em modo desenvolvimento (reinicia ao salvar) |
| `npm test` | Roda os testes automatizados (usam um banco separado, `test.db`) |
| `npm run typecheck` | Confere os tipos do TypeScript |
| `npm run build` | Gera a versão de produção em `build/` |
| `npm start` | Roda a versão de produção (as variáveis precisam estar no ambiente) |
| `npm run create-manager -- "Nome" email senha` | Cria um gestor ou promove uma conta existente |

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
