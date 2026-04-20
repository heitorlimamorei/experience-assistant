# Experience Assistant API

API em Bun + TypeScript usando Hono e Vercel AI SDK com OpenAI como provider do agente. A entrada da aplicação é um único endpoint `/chat`.

## Stack

- Bun
- TypeScript
- Hono
- Vercel AI SDK (`ai` + `@ai-sdk/openai`)
- Zod

## Estrutura

```text
src/
  config/
  dtos/
  handlers/
  resources/
    ai/
      agents/
      connectors/
      tools/
  services/
  shared/
  container/
  app.ts
  index.ts
```

## Como rodar

```bash
cp .env.example .env
bun install
bun run dev
```

## Endpoints

- `GET /health`
- `POST /chat`

## Exemplos

```bash
curl http://localhost:3000/health
```

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Que horas sao agora em Sao Paulo? Use a tool se precisar."
      }
    ]
  }'
```
