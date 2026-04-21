# Experience Assistant API

API em Bun + TypeScript usando Hono e Vercel AI SDK com OpenAI como provider do agente. A aplicacao expoe `/chat` e webhooks da Twilio para WhatsApp.

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
- `POST /webhooks/twilio/whatsapp/message`
- `POST /webhooks/twilio/whatsapp/status`

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

## Webhooks Twilio WhatsApp

Configure na Twilio as URLs publicas:

```text
Incoming Message webhook:
POST https://seu-dominio.com/webhooks/twilio/whatsapp/message

Status Callback webhook:
POST https://seu-dominio.com/webhooks/twilio/whatsapp/status
```

Variaveis necessarias:

```bash
APP_BASE_URL=https://seu-dominio.com
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=seu-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WEBHOOK_VALIDATE_SIGNATURE=true
```

O webhook de `message` recebe `application/x-www-form-urlencoded` da Twilio, valida a assinatura `X-Twilio-Signature`, extrai `Body`, `WaId`, `ProfileName` e chama o agente atual. A resposta para o usuario e enviada via Twilio usando `Body`, e nao `contentSid`, para manter o fluxo flexivel dentro da janela de atendimento.

O webhook de `status` recebe as mudancas de estado de mensagens outbound, como `queued`, `sent`, `delivered`, `undelivered`, `failed` e `read`.
