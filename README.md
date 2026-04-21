# Experience Assistant API

API em Bun + TypeScript usando Hono e Vercel AI SDK com OpenAI como provider do agente. A aplicacao expoe `/chat` e um webhook da Meta para WhatsApp.

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
- `GET /webhooks/meta/whatsapp`
- `POST /webhooks/meta/whatsapp`

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

## Webhook Meta WhatsApp

Configure na Meta a URL publica:

```text
GET/POST https://seu-dominio.com/webhooks/meta/whatsapp
```

Variaveis necessarias:

```bash
META_WEBHOOK_VERIFY_TOKEN=seu-token-de-verificacao
META_WHATSAPP_ACCESS_TOKEN=token-da-cloud-api
META_WHATSAPP_PHONE_NUMBER_ID=id-do-numero
META_GRAPH_API_VERSION=v23.0
```

O `GET` faz o handshake do webhook com a Meta. O `POST` recebe mensagens de texto, chama o agente atual e envia a resposta de volta para o numero do usuario via WhatsApp Cloud API.
