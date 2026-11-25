# Etapas 2, 3 e 4 — Domínio, casos de uso e portas

O núcleo está pronto e testado **sem HTTP, sem banco e sem tempo real**. Neste ponto da refatoração a API
ainda rodava no arquivo original; a troca para o núcleo novo aconteceu nas etapas 6/7
(ver `04-adaptadores-e-composition-root.md`).

## Estrutura

```
src/
├── domain/                     ← não importa express, @prisma/client nem nada de node_modules
│   ├── channel.ts              canal + regras do canal (R8–R12)
│   ├── contact.ts              contato + regras de validade (R1–R5)
│   ├── notification.ts         ciclo de vida e reenvio (R13–R16)
│   ├── delivery.ts             rejectionFor(): a regra de canal compartilhada (ADR-001)
│   └── errors.ts               erros de domínio, sem status HTTP
├── application/
│   ├── ports/                  saídas necessárias, na linguagem do negócio
│   │   ├── contact-repository.ts
│   │   ├── notification-repository.ts
│   │   ├── message-sender.ts   MessageSender + SenderRegistry
│   │   ├── delivered-messages.ts
│   │   └── clock.ts            Clock + IdGenerator
│   ├── services/delivery-service.ts   a entrega, uma só, usada por envio e reenvio
│   └── use-cases/              portas de entrada (uma operação por intenção)
└── adapters/out/memory/        implementações em memória (teste e boot sem banco)
```

## Casos de uso

| Caso de uso | Entrada | Saída | Regras que aplica |
| --- | --- | --- | --- |
| `CreateContact` | dados do contato | contato persistido | R1–R5 (delegadas a `Contact.create`) |
| `ListContacts` / `GetContact` | — / id | contatos / contato ou `ContactNotFound` | — |
| `SendNotifications` | `contactId`, `channels[]`, `message`, `subject?` | notificações | R6, R7, R8–R12 (via domínio), R14–R16, R21 |
| `RetryNotification` | id | notificação | R13, R8–R12 (**a mesma função**), R16 |
| `ListNotifications` | filtro | notificações | — (normalização de `status` fica no adaptador) |
| `GetNotification` | id | notificação + contato | — |
| `ListDeliveredMessages` | `contactId` | mensagens do canal `fake` | R18 |

Nenhum caso de uso menciona `fake`, `sms` ou `email` literalmente: ele usa o registro de entregadores
(`SenderRegistry`). Também não há `switch` de canal em lugar nenhum do núcleo.

## Portas de saída e granularidade (texto base para o README)

> As portas foram separadas por **intenção de negócio**, não por tecnologia: `ContactRepository` e
> `NotificationRepository` guardam o que o domínio precisa lembrar; `MessageSender` entrega; `Clock` diz
> que horas são; `IdGenerator` produz identificadores; `DeliveredMessages` lê o que o canal `fake`
> recebeu. A granularidade escolhida para entrega foi **uma porta `MessageSender` + um registro
> `Channel → MessageSender`** montado no composition root, e não uma porta por canal. Com uma porta por
> canal, o caso de uso precisaria escolher qual chamar — ou seja, voltaria a conhecer os canais
> concretos, que é justamente o acoplamento que a arquitetura remove. Com uma porta só e um mapa,
> adicionar WhatsApp custa uma descrição de canal no domínio, um adaptador e uma linha de registro,
> sem tocar em caso de uso algum (é o que a Etapa 9 demonstra). O outro extremo — um adaptador único com
> `if/else` por canal — também foi descartado: todo canal novo editaria o adaptador, e regra de transporte
> se misturaria com regra de negócio. Já as *regras* de cada canal (exigir telefone, limitar a 160
> caracteres, exigir assunto) ficaram no domínio, porque sobrevivem à troca de provedor: um SMS continua
> tendo 160 caracteres com qualquer operadora.

## O que os testes provam (21 testes novos)

- **Domínio** (`tests/domain/domain.test.ts`): R1–R5 com as mensagens do contrato, `optOut` como coleção,
  descrição dos canais, `rejectionFor` na ordem do contrato e o ciclo de vida da notificação.
- **Casos de uso** (`tests/application/use-cases.test.ts`), com repositórios em memória e dublês de
  envio/relógio: envio pelos três canais, conflito de canal, 160/161 caracteres, `subject`, canal
  desconhecido antes do contato (ordem do contrato), limite de 5/min **sem esperar 60 s** (o relógio é
  injetado), deduplicação, falha do provedor e o reenvio rejeitando SMS > 160 e e-mail sem `subject`
  (ADR-001).
- A suíte caixa-preta da Etapa 1 continua verde, **sem uma linha alterada** — 45 testes no total.

## Desvio registrado: o limite por minuto continua contando canais repetidos

`recent + channels.length` foi preservado (ADR-005): um pedido `[fake, fake]` com 4 envios no minuto
ainda é barrado com 429, embora só um canal único fosse entregue. É a única assimetria conhecida mantida
de propósito, porque mudá-la alteraria um status observável sem que o trabalho peça isso.
