# Etapa 9 — Provar que a arquitetura funciona

Cada item abaixo foi feito **sem alterar domínio nem casos de uso**. A prova é o `diff` contra o
snapshot tirado imediatamente antes desta etapa:

```
$ diff -rq <snapshot-antes-do-E9> src
Somente em src/domain/channels: whatsapp.ts        ← arquivo NOVO (descrição de canal)
Somente em src/adapters/out/channels: whatsapp-channel.ts
Somente em src/adapters/out/channels: smtp-email-channel.ts
Somente em src/main: cli.ts
main/catalogue.ts, main/config.ts, main/container.ts, main/server.ts  ← composition root
```

`src/domain` (fora o arquivo novo) e `src/application` não aparecem na lista: **zero alterações**.

## 1. Canal novo — WhatsApp (simulado)

O que custou:

| Arquivo | Tipo | Conteúdo |
| --- | --- | --- |
| `src/domain/channels/whatsapp.ts` | novo | descrição do canal: exige telefone, limite de 4096, não exige assunto |
| `src/adapters/out/channels/whatsapp-channel.ts` | novo | entrega simulada, `providerId` = `whatsapp-…` |
| `src/main/catalogue.ts` | 1 import + 1 item na lista | passa a conhecer o canal |
| `src/main/container.ts` | 1 linha no registro | `whatsapp: new WhatsappChannel({ ids })` |

Nenhum caso de uso, entidade, porta ou regra existente mudou. As regras do canal novo (exigir telefone,
limite de 4096) entraram em vigor sem que `rejectionFor` soubesse que ele existe — porque as regras são
*dados* da descrição, não `if` no código.

Exercitado por HTTP (`tests/e2e/architecture-proof.test.ts`):

```
POST /notifications {"channels":["whatsapp"]}            → 201, SENT, providerId whatsapp-…
POST /notifications contato sem telefone                 → 201, FAILED "contato não possui telefone"
POST /notifications mensagem de 4097 chars               → 201, FAILED "…não pode passar de 4096 caracteres"
POST /contacts com optOut ["whatsapp"]                   → 201, optOut aceito; envio barrado com "optou por…"
```

## 2. Provedor de e-mail real, escolhido por configuração

`EMAIL_PROVIDER=smtp` (com `SMTP_HOST/PORT/USER/PASS` e `MAIL_FROM`) troca `LogEmailChannel` por
`SmtpEmailChannel` (Nodemailer). Mesma porta `MessageSender`, mesmo contrato — o núcleo não sabe qual está
ativo: a escolha acontece em `src/main/container.ts`, a partir do `config`.

Prova executada com conta de teste do **Ethereal** (`api.nodemailer.com/user`):

```
[ethereal] conta criada — host: smtp.ethereal.email porta: 587
[envio] status HTTP 201 | notificação: SENT | providerId: <787a367d-…@ethereal.email>
[preview] https://ethereal.email/message/awZVk7J2LFm2WB1LawZVl9T-eTqTJ8PKAAAAAWU5YdDHo7IgUYi-a7Rtjm0 → HTTP 200
```

> Nota prática: a URL de preview **não** é montada com o `messageId` — ela vem de
> `nodemailer.getTestMessageUrl(info)` (id opaco). Montar `ethereal.email/message/<messageId>` devolve 404.

Sem credenciais, `EMAIL_PROVIDER=log` (padrão) mantém o comportamento antigo, imprimindo no console.

## 3. Segundo adaptador primário — CLI

`src/main/cli.ts` usa **os mesmos casos de uso** que o HTTP (o container expõe `uses`), só traduzindo
argumentos em vez de requisição:

```
$ npm run cli -- add-contact --name "Ana CLI" --email ana@ifrs.edu.br --phone +5511999998888
{ "id": 1, "name": "Ana CLI", "email": "…", "phone": "…", "optOut": [] }

$ npm run cli -- send --contact 1 --channels fake,whatsapp --message "enviado pela linha de comando"
[WHATSAPP] para +55…: enviado pela linha de comando
[ { "id": 1, "channel": "fake",     "status": "SENT", "attempts": 1, "lastError": null },
  { "id": 2, "channel": "whatsapp", "status": "SENT", "attempts": 1, "lastError": null } ]

$ npm run cli -- retry --id 1
erro: notificação já foi enviada          (exit 1)
```

## 4. Subir usando só os repositórios em memória

`APP_STORAGE=memory npm run dev` — nenhum `PrismaClient` é criado. Coberto pelo teste
`architecture-proof.test.ts` ("a aplicação sobe sem Postgres/SQLite") e verificado manualmente:

```
APP_STORAGE=memory npm run dev
POST /contacts            → 201
POST /notifications fake  → SENT, providerId fake-…
GET  /fake-inbox/1        → mensagem entregue
GET  /notifications       → lista
```

## Verificação final da etapa

- `npm test` → **50/50** (24 caixa-preta da E1 inalterados + 21 domínio/casos de uso + 4 provas de
  arquitetura + 1 do adaptador SMTP).
- `npm run typecheck` e `npm run build` limpos.
- `grep` de infraestrutura no núcleo: nenhum import de `express`/`@prisma` em `src/domain` e
  `src/application`; `process.env` só em `src/main/config.ts`.
