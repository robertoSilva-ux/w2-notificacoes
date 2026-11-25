# Etapa 0 — Inventário do sistema original

> Trabalho III de Web II (Ports and Adapters). Este documento é o levantamento feito **antes** de mover
> qualquer código. Ele responde ao primeiro item da gravação: *quais responsabilidades e regras de negócio
> estavam no arquivo original, e quais estavam duplicadas ou divergentes*.
>
> Fonte: `src/index.ts` (227 linhas, arquivo único) da versão original do professor.

## Como o levantamento foi feito

1. O sistema foi executado a partir da cópia, com banco de sondagem próprio
   (`DATABASE_URL=file:./probe.db`, `PORT=3021`) e `SMS_FAILURE_RATE` controlado nas duas pontas
   (`0` = provedor sempre OK, `1` = provedor sempre falha), para separar o comportamento determinístico
   do aleatório.
2. **51 cenários** foram exercitados por HTTP — todas as rotas, todos os caminhos de erro, os limites e as
   sequências de retry. A tabela de contrato abaixo é o resultado observado, não a intenção do código.
3. Cada trecho do `index.ts` foi marcado com a responsabilidade que cumpre (mapa da seção 2).

Nada foi alterado no código nesta etapa. Os testes da Etapa 1 (`tests/e2e/`) automatizam os cenários que
o contrato precisa preservar.

---

## 1. Contrato observado (o que não pode quebrar)

Formato de sucesso: JSON. Formato de erro esperado: `{"error": "<mensagem>"}`.
Toda lista de contatos devolve `optOut` como **array**; as notificações devolvem `optOut` como **string**
quando o contato é embutido (ver D5).

| Rota | Cenário | Status | Corpo |
| --- | --- | --- | --- |
| `POST /contacts` | válido (email+phone) | 201 | contato: `id,name,email,phone,optOut[],createdAt` |
| | `name` curto / sem email e sem phone / email inválido / phone fora do E.164 / `optOut` inválido | 400 | `{error}` |
| `GET /contacts` | — | 200 | array de contatos, `orderBy id asc` |
| `GET /contacts/:id` | existe / não existe | 200 / 404 | contato / `{error}` |
| `GET /contacts/:id` | `:id` não numérico | **500** | **HTML com stack do Prisma** (D8) |
| `POST /notifications` | 3 canais válidos | 201 | array com 3 notificações `SENT` |
| | campos obrigatórios faltando / canal desconhecido | 400 | `{error}` |
| | `contactId` inexistente | 404 | `{error}` |
| | regra do canal violada (opt-out, sem telefone, SMS >160, sem `subject`) | **201** | array com a notificação em `FAILED` + `lastError` |
| | mais de 5 no mesmo minuto | 429 | `{error}` |
| `GET /notifications` | sem filtro / `?status=` / `?channel=` / `?contactId=` | 200 | array, `orderBy id desc`; `status` é convertido para maiúsculas |
| `GET /notifications/:id` | existe / não existe | 200 / 404 | notificação + `contact` embutido |
| `POST /notifications/:id/retry` | notificação `SENT` | 409 | `{error}` |
| | `attempts >= 3` | 409 | `{error}` |
| | regra do canal violada | **422** | `{error}` |
| | provedor falha no reenvio | **502** | notificação atualizada (`attempts` incrementado) |
| | provedor volta a funcionar | 200 | notificação `SENT` |
| `GET /fake-inbox/:contactId` | — | 200 | array `{id,contactId,subject,message,receivedAt}` |

Assimetrias do contrato que **existem de propósito e serão preservadas**: a mesma violação de canal
devolve `201 + FAILED` no envio e `422` no retry; falha de provedor devolve `201 + FAILED` no envio e
`502` no retry; o detalhe da notificação embute o contato com `optOut` em string.

---

## 2. Mapa de responsabilidades do arquivo único

| Linhas | O que está ali | Responsabilidade | Destino na arquitetura alvo |
| --- | --- | --- | --- |
| 11–15 | imports de `dotenv`, `crypto`, `express`, Prisma | infraestrutura no arquivo | composition root |
| 17–18 | `PORT`, `SMS_FAILURE_RATE` | configuração | composition root (`config`) |
| 20–25 | `PrismaClient` + adapter SQLite | persistência | adaptador secundário |
| 27–29 | `fakeInbox` (array global) | estado de integração externa | porta + adaptador do canal `fake` |
| 31–32 | `express()`, `express.json()` | entrada HTTP | adaptador primário |
| 37–60 | `POST /contacts` | HTTP + validação de formato + **5 regras de negócio** (R1–R5) + persistência + serialização | separado em: controller, domínio (`Contact`), repositório |
| 62–71 | `GET /contacts`, `GET /contacts/:id` | HTTP + consulta + serialização de `optOut` | controller + repositório |
| 76–159 | `POST /notifications` | HTTP + validação de formato + **limite por minuto (R7)** + **regras por canal (R8–R12)** + criação do registro + **despacho por canal (R15–R20)** + persistência de resultado | controller + caso de uso `SendNotifications` + domínio (`Notification`, canais) + portas `NotificationRepository`/`MessageSender`/`Clock` |
| 161–168 | `GET /notifications` | HTTP + montagem de filtros na linguagem do Prisma | controller + repositório |
| 170–174 | `GET /notifications/:id` | HTTP + consulta com `include` | controller + repositório |
| 176–218 | `POST /notifications/:id/retry` | HTTP + **pré-condições (R13)** + **cópia divergente das R8–R12** + **cópia idêntica do despacho** + persistência | caso de uso `RetryNotification` reusando a mesma entrega do envio |
| 220–223 | `GET /fake-inbox/:contactId` | HTTP + leitura de estado do canal `fake` | porta de leitura do canal `fake` |
| 225–227 | `app.listen` | boot | composition root |

Conclusão do mapa: **nenhum** trecho tem uma responsabilidade só. Configuração aparece em 4 lugares,
validação em 2 camadas diferentes (formato de request × regra de negócio), e o despacho por canal aparece
duas vezes com pequenas diferenças.

---

## 3. Regras de negócio encontradas

| # | Regra | Onde | Observação |
| --- | --- | --- | --- |
| R1 | `name` obrigatório, string, com `trim()` de no mínimo 2 caracteres | 40–42 | grava `name.trim()` |
| R2 | `email`, se presente, casa `^[^\s@]+@[^\s@]+\.[^\s@]+$` | 43–45 | |
| R3 | `phone`, se presente, é E.164 `^\+\d{10,15}$` | 46–48 | |
| R4 | contato exige ao menos `email` ou `phone` | 49–51 | |
| R5 | `optOut` é lista restrita a `fake`, `sms`, `email` | 52–54 | persistido como string CSV |
| R6 | canal de envio pertence a `fake`, `sms`, `email` | 82–86 | mesma lista da R5, literal duplicado |
| R7 | máximo de 5 notificações por contato por minuto | 91–98 | `recent + channels.length > 5` |
| R8 | canal em `optOut` do contato não recebe | 104–105 e 185–187 | duas cópias |
| R9 | SMS exige telefone | 106–107 e 188 | duas cópias |
| R10 | mensagem de SMS ≤ 160 caracteres | 108–109 | **só no envio** |
| R11 | e-mail exige endereço | 110–111 e 189 | duas cópias |
| R12 | e-mail exige `subject` | 112–113 | **só no envio** |
| R13 | retry só para não-`SENT` e com `attempts < 3` | 180–181 | |
| R14 | violação de regra de canal não impede o registro: a notificação nasce `FAILED` com `lastError` | 116–125 | |
| R15 | sucesso marca `SENT`, `attempts = 1`, `providerId`, `sentAt` | 144–147 | |
| R16 | falha do provedor marca `FAILED` + `lastError` (envio) / responde 502 (retry) | 148–153, 211–217 | dois tratamentos |
| R17 | formato do `providerId` depende do canal (`fake-<uuid>`, `sms-<8 chars>`, `<uuid@notificacoes.local>`) | 132, 137, 141 | três formatos |
| R18 | mensagem entregue pelo canal `fake` fica consultável em `/fake-inbox/:contactId` | 133, 195 | estado global do processo |
| R19 | latência simulada: SMS 150 ms, e-mail 300 ms | 135, 140 | tempo real dentro da regra |
| R20 | SMS falha com probabilidade `SMS_FAILURE_RATE` | 136, 198 | aleatoriedade dentro da regra |
| R21 | canais repetidos no mesmo pedido são deduplicados (`new Set`) | 101 | mas ver D4 |
| R22 | filtro `status` é normalizado para maiúsculas; valores inválidos devolvem lista vazia sem erro | 163 | contrato permissivo |

---

## 4. Duplicações e divergências (com evidência)

| # | Achado | Evidência observada |
| --- | --- | --- |
| **D1** | O `retry` **não** revalida R10 (160 caracteres) nem R12 (`subject`). Uma notificação que falhou por SMS com 161 caracteres é reenviada com sucesso. | cenário `POST retry de FAILED por sms>160` → **200 / `SENT`** |
| **D2** | A mesma violação de canal vira `201 + FAILED` no envio e `422` no retry. | `POST /notifications` sms sem telefone → 201 FAILED; `POST .../retry` da mesma notificação → 422 |
| **D3** | O `retry` **não** aplica o limite de R7. | retries repetidos nunca retornam 429 |
| **D4** | O limite conta `channels.length` (com repetições), mas o envio itera `new Set(channels)`: a checagem é mais restritiva que o envio. | `[fake,fake]` com 4 envios no minuto → **429**, embora só 1 canal único fosse enviado |
| **D5** | `GET /notifications/:id` embute `contact.optOut` como string CSV; `GET /contacts` devolve array. | corpos das duas rotas |
| **D6** | `status` é normalizado, `channel` não: `?status=lixo` devolve `[]` silenciosamente e `?channel=fake` aceita qualquer string. | `GET /notifications?status=lixo` → 200 `[]` |
| **D7** | Erro de formato de request → 400; erro de regra de negócio → 201 com `FAILED`. Duas classes de erro, dois mecanismos, dois lugares. | comparação `POST /contacts` inválido × `POST /notifications` com opt-out |
| **D8** | Erros internos vazam para o cliente: `:id` não numérico e `contactId` não numérico produzem **500 com HTML e stack trace do Prisma**; JSON malformado produz **400 em HTML**. | cenários `GET /contacts/abc`, `GET /notifications?contactId=abc`, `POST JSON malformado` |
| **D9** | Código copiado: despacho por canal (128–143 × 193–205), `fakeInbox.push` (133 × 195), `optOut.split(',')` 5× (57, 64, 70, 104, 185), formato do `providerId` 2×. | leitura do arquivo |

### Consequência de projeto

As divergências **não** podem ser resolvidas copiando uma das versões: é preciso escolher uma regra
canônica e registrar o efeito no contrato. As decisões estão em
[`01-decisoes.md`](01-decisoes.md) (ADR-001 e ADR-002).

---

## 5. Sintomas que a arquitetura precisa resolver

1. **Aleatoriedade e tempo dentro da regra** (R19, R20): sem porta de relógio/aleatoriedade, o teste só
   consegue controlar isso reiniciando o processo com outro `SMS_FAILURE_RATE`. Foi o que fizemos no
   levantamento — e é o que a Etapa 4 elimina.
2. **Estado global do canal `fake`** (R18): o `fakeInbox` vive no módulo, então não existe teste
   concorrente nem duas instâncias.
3. **Erros internos vazando** (D8): qualquer id malformado derruba o contrato para HTML.
4. **Regra de negócio presa ao handler** (R7–R13): nada disso é testável sem subir HTTP + SQLite.
5. **Configuração espalhada**: `process.env` é lido no topo do arquivo de rotas e não há um lugar único
   que decida qual implementação usar.

---

## 6. O que ficou de fora da rede de segurança (e por quê)

Os testes da Etapa 1 **não** congelam os cenários ambíguos — D1, D2, D4 e D8 — porque fixá-los
transformaria o bug em requisito e impediria a unificação das regras exigida pelo trabalho. Esses cenários
são cobertos pelos testes da Etapa 8, depois da decisão registrada em `docs/01-decisoes.md`.
