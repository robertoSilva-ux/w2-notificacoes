# Decisões de arquitetura (registro)

Formato: contexto → decisão → alternativas descartadas → consequência no contrato.
Status: `proposto` (a validar com o professor) · `aceito`.

---

## ADR-001 — Uma regra de canal, um lugar: unificar envio e reenvio · **aceito**

**Decisão aceita em 25/11/2026.** O reenvio passa a rejeitar SMS com mais de 160 caracteres e e-mail sem
`subject`, exatamente como o envio. Implementado em `src/domain/delivery.ts` (`rejectionFor`), usado por
`SendNotifications` e por `RetryNotification`; coberto por
`tests/domain/domain.test.ts` e pelos dois testes "reenvio reusa a regra de canal" em
`tests/application/use-cases.test.ts`.

**Contexto.** O `POST /notifications` e o `POST /notifications/:id/retry` têm cópias das mesmas
validações, mas **divergentes**: o retry não valida os 160 caracteres do SMS (R10) nem a obrigatoriedade
de `subject` no e-mail (R12) — comprovado no levantamento (D1), com um SMS de 161 caracteres sendo
reenviado com sucesso. O retry também não aplica o limite por minuto (D3) e devolve `422` onde o envio
devolve `201 + FAILED` (D2).

**Decisão.** Existe **uma** operação de domínio "entregar esta notificação por este canal", que devolve
`Entregue` ou `Rejeitada(motivo)`. Envio e reenvio são casos de uso diferentes que chamam essa mesma
operação: o envio cria a notificação e tenta entregar; o reenvio carrega a notificação e tenta entregar.
Nenhuma regra de canal é reescrita no reenvio.

**Consequência no contrato (mudança intencional, a registrar no README):**
- O reenvio passa a **rejeitar** o que o envio rejeita, inclusive SMS > 160 e e-mail sem `subject`. O
  status da resposta do retry continua `422` (é o contrato do retry) e o limite por minuto **não** é
  aplicado no retry, para manter `attempts` alcançável dentro do minuto do teste e porque o limite é regra
  de *entrada de pedidos*, não de *retentativa*.
- Os cenários D1/D2/D3 ficam fora da rede de segurança da Etapa 1 justamente para poderem ser corrigidos
  sem quebrar os testes (ver `00-inventario.md`, seção 6).

**Descartado.** Manter as duas cópias e apenas "consertar" a do retry copiando a do envio: continuaria
havendo dois lugares para a mesma regra, que é o que o critério "sem duplicação" proíbe.

---

## ADR-002 — Granularidade da porta de envio: uma porta, vários adaptadores registrados por canal

**Contexto.** O sistema tem três canais com regras próprias (R8–R12) e provedores distintos. As opções
eram (a) uma porta `MessageSender` por canal, (b) uma única porta com um mapa `Channel → adaptador`, ou
(c) um `if/else` por canal dentro de um adaptador único.

**Decisão.** **(b)**: uma porta `MessageSender` (`send(entrega): Promise<Recibo>`) e um registro
`Channel → MessageSender` montado na composition root. As *regras* de cada canal (exigências, tamanho,
assunto) vivem no domínio, na descrição do canal — não no adaptador, porque não são detalhe de provedor:
são regras de negócio. O adaptador só sabe *entregar*.

**Por quê.** Adicionar um canal passa a custar: uma descrição de canal no domínio (regras) + um adaptador
(entrega) + uma linha de registro. Casos de uso e domínio ficam intocados — exatamente a prova pedida na
Etapa 9. A opção (a) obrigaria o caso de uso a escolher qual porta chamar (um `switch` no núcleo); a (c)
obrigaria a editar o adaptador a cada canal novo e misturaria regra com transporte.

**Consequência.** O caso de uso nunca menciona `fake`, `sms` ou `email` literalmente: ele pede ao registro
o entregador do canal. O registro é a única tabela que conhece todos os canais concretos.

---

## ADR-003 — Relógio, aleatoriedade e identificadores são portas

**Contexto.** O limite de 5/min depende de `Date.now()`, o SMS falha com `Math.random()` e os ids de
provedor usam `crypto.randomUUID()` — tudo chamado direto da regra. No levantamento, a única forma de
controlar isso foi reiniciar o processo com outro `SMS_FAILURE_RATE`.

**Decisão.** Três portas de saída pequenas: `Clock` (`now()`), `Random` (`next()`), `IdGenerator`
(`newId()`). Em produção são triviais (`Date`, `Math.random`, `crypto`); nos testes são dublês
determinísticos. Combinado com repositórios em memória, isso dá o critério "casos de uso testáveis sem
banco, sem HTTP e sem aleatoriedade/tempo real".

**Consequência.** O limite por minuto vira testável no caso de uso sem esperar 60 segundos, e o canal SMS
passa a falhar exatamente quando o teste mandar.

---

## ADR-004 — `/fake-inbox` é leitura de um adaptador, não estado do módulo

**Contexto.** O `fakeInbox` é um array no escopo do arquivo (R18): vive enquanto o processo viver e não
tem dono. Em hexagonal, ele é o "provedor" do canal `fake`.

**Decisão.** O adaptador do canal `fake` guarda as mensagens entregues e expõe leitura pela porta
`DeliveredMessages` (usada pelo controller de `/fake-inbox`). Nas implementações em memória isso continua
sendo um array — mas agora com dono, injetável e substituível.

**Consequência.** `/fake-inbox/:contactId` continua respondendo igual, e o mesmo adaptador serve aos testes
sem subir HTTP.

---

## ADR-005 — O limite de 5/min continua contando os canais pedidos, inclusive repetidos · **aceito**

**Contexto.** O original compara `recent + channels.length > 5`, mas entrega `new Set(channels)`: pedir
`[fake, fake]` com 4 envios no minuto é barrado (429) embora só um canal único fosse entregue.

**Decisão.** Preservar. O limite olha o **pedido**, não o que sobrou depois da deduplicação. É a única
assimetria conhecida mantida de propósito: mudá-la alteraria um status HTTP observável (429 → 201) sem
que o trabalho peça essa mudança, e o critério de avaliação é contrato preservado. A deduplicação
continua existindo na entrega (R21), como no original.

**Descartado.** Contar canais únicos: mais coerente, porém muda o contrato sem necessidade. Se um dia
for corrigido, é uma linha em `SendNotifications` e um teste que fixa `[fake, fake]` → 201 com 1
notificação.

---

---

## ADR-006 — Erro interno vira JSON, com status decidido em um único mapa · **aceito**

**Contexto.** No original, três caminhos vazavam HTML com stack do Prisma: `GET /contacts/abc`,
`GET /notifications?contactId=abc` e `POST /notifications` com `contactId` não numérico (500 HTML), e
corpo JSON malformado (400 HTML). Rota inexistente também era HTML.

**Decisão.** Todo erro sai como `{ "error": "..." }`, em um mapa único
(`src/adapters/in/http/error-handler.ts`):

| Origem | Status |
| --- | --- |
| `InvalidContact`, `UnknownChannel`, id/`contactId` malformado, corpo JSON inválido | 400 |
| `ContactNotFound`, `NotificationNotFound`, rota inexistente | 404 |
| `AlreadySent`, `RetryLimitReached` | 409 |
| `ChannelRejected` | 422 |
| `RateLimited` | 429 |
| qualquer outro erro (inclui falha de banco) | 500 `{error:"erro interno"}`, detalhe só no log |

**Consequência no contrato.** Os cenários de erro interno deixam de devolver HTML/stack e passam a devolver
JSON — é correção exigida pelo critério "erros tratados". As rotas não ambíguas (que a suíte da Etapa 1
cobre) mantêm status e formato originais. `DeliveryFailed` continua devolvendo 502 **com o corpo da
notificação**, como no original.

---

## Pendências de decisão (para depois de E5/E6)

- Nome e granularidade dos casos de uso (`SendNotifications` × `SendNotification` + laço no controller).
- Onde vive a serialização `optOut` string ↔ array (proposta: no adaptador de persistência, para que o
  domínio trabalhe só com coleção).
- Como o erro interno (D8) vira resposta: proposta `400 {error:"requisição inválida"}` para id malformado
  e `500 {error:"erro interno"}` sem detalhe, com log apenas no servidor.
