# Etapas 5, 6 e 7 — Adaptadores, HTTP fino e composition root

Agora a API roda **inteira** na arquitetura nova: `src/index.ts` só chama o composition root. A versão
original está em `legacy/index.ts`, idêntica, para comparação.

## E5 — Adaptadores secundários

| Porta | Adaptador | Onde | Detalhe de infraestrutura que não vaza |
| --- | --- | --- | --- |
| `ContactRepository` | `PrismaContactRepository` | `src/adapters/out/prisma/` | `optOut` CSV ↔ coleção de canais; tipos do Prisma |
| `NotificationRepository` | `PrismaNotificationRepository` | `src/adapters/out/prisma/` | `status`/`channel` como string do banco ↔ tipos do domínio; montagem do `where` |
| `ContactRepository` / `NotificationRepository` | `InMemory*Repository` | `src/adapters/out/memory/` | ids sequenciais, filtros em memória |
| `MessageSender` (fake) + `DeliveredMessages` | `FakeChannel` | `src/adapters/out/memory/` | a caixa de entrada que antes era array global (ADR-004) |
| `MessageSender` (sms) | `SmsChannel` | `src/adapters/out/channels/` | latência, `providerId` de 8 caracteres, falha probabilística |
| `MessageSender` (email) | `LogEmailChannel` | `src/adapters/out/channels/` | formato do "e-mail" impresso, `providerId` `<uuid@notificacoes.local>` |
| `Clock`, `IdGenerator`, `Random` | `SystemClock`, `CryptoIds`, `MathRandom` | `src/adapters/out/system/` | `Date`, `crypto.randomUUID`, `Math.random` |

`@prisma/client` aparece somente em `src/adapters/out/prisma/*` e em `src/main/container.ts` (onde é
instanciado). Nenhum tipo do Prisma atravessa a porta.

## E6 — Adaptador primário HTTP

| Arquivo | Papel |
| --- | --- |
| `src/adapters/in/http/contacts-router.ts` | traduz requisição → `CreateContact`/`ListContacts`/`GetContact` |
| `src/adapters/in/http/notifications-router.ts` | idem para envio, reenvio, listagem, detalhe e `/fake-inbox` |
| `src/adapters/in/http/serializers.ts` | forma das respostas (inclui a assimetria D5 de `optOut`) |
| `src/adapters/in/http/error-handler.ts` | **único** mapa erro de domínio → status + fallback JSON |
| `src/adapters/in/http/app.ts` | monta o Express com as dependências recebidas |

Separação de responsabilidades dentro da camada:

- **formato** da requisição (campos presentes, tipos, `id` numérico) → no adaptador, devolvendo 400;
- **regra de negócio** (quantos caracteres, opt-out, exigências do canal, limite por minuto, reenvio) → no
  domínio e nos casos de uso, e o adaptador só traduz o erro.

Comportamento corrigido, comprovado por HTTP com a app nova:

```
GET  /contacts/abc                → 400 {"error":"id inválido"}          (antes: 500 HTML + stack)
GET  /notifications?contactId=abc → 400 {"error":"contactId inválido"}   (antes: 500 HTML + stack)
POST /contacts  corpo '{nome:'    → 400 {"error":"corpo JSON inválido"}   (antes: 400 HTML)
GET  /nada                        → 404 {"error":"rota não encontrada"}   (antes: 404 HTML)
POST /notifications/1/retry (SMS de 161) → 422 {"error":"mensagem de SMS não pode passar de 160 caracteres"}  (antes: 200 SENT — ADR-001)
```

## E7 — Composition root

| Arquivo | Papel |
| --- | --- |
| `src/main/config.ts` | **único** leitor de `process.env`; devolve valores (porta, banco, taxa de falha, limite, storage) |
| `src/main/container.ts` | instancia Prisma, repositórios, adaptadores de canal, serviços e casos de uso e conecta tudo |
| `src/main/server.ts` | monta o app e escuta a porta |
| `src/index.ts` | entrada: `startServer(loadConfig())` |

Direção das dependências verificada por `grep`:

```
src/domain, src/application  → nenhum import de express/@prisma/node:crypto
process.env                  → só em src/main/config.ts
@prisma/client               → só em src/adapters/out/prisma/* e src/main/container.ts
```

Boot sem banco (prova da Etapa 9, item "só repositórios em memória"):

```
APP_STORAGE=memory npm run dev
POST /contacts            → 201
POST /notifications fake  → SENT, providerId fake-…
GET  /fake-inbox/1        → mensagem entregue
GET  /notifications       → lista
```

## Verificação desta etapa

- `npm run typecheck` e `npm run build` limpos.
- `npm test` → **45/45**, com os 24 testes caixa-preta da Etapa 1 **sem alteração**, agora exercitando a
  implementação hexagonal (mesmos status, mesmos formatos, mesmos campos).
- As duas mudanças intencionais de comportamento estão registradas: ADR-001 (reenvio rejeita SMS > 160 e
  e-mail sem `subject`) e ADR-006 (erro interno em JSON, sem stack).
