# Roteiro da gravação (15 minutos)

Cada bloco cobre um item exigido no enunciado. Os arquivos citados são os que ficam na tela.

| Tempo | Item do enunciado | O que mostrar |
| --- | --- | --- |
| 0:00–0:40 | abertura | o sistema rodando no original: `legacy/index.ts` (227 linhas) ao lado da árvore nova. Uma frase: "mesma API, mesma base de testes, outra organização". |
| 0:40–3:30 | **1. responsabilidades e regras encontradas** | abrir `docs/00-inventario.md`: a tabela linhas→responsabilidade (mostrar que `POST /notifications` cumpre 5 papéis) e a lista R1–R22. Dizer que foram 22 regras, 51 cenários sondados por HTTP. |
| 3:30–6:00 | **1b. duplicações e divergências** | tabela D1–D9. Mostrar a prova do D1: `POST /notifications` com SMS de 161 chars → `FAILED`; `retry` da mesma notificação, no código original, devolvia `200 SENT`. Citar D4 (limite conta `channels.length`, envio usa `Set`) e D8 (`500` com stack do Prisma). |
| 6:00–8:00 | **2. como ficou o domínio** | `src/domain/`: `contact.ts` (R1–R5), `notification.ts` (R13–R16), `delivery.ts` (`rejectionFor`) e `channels/*.ts` (regras por canal como dado). Mostrar `grep` provando zero imports de express/Prisma. |
| 8:00–9:30 | **3. portas e granularidade** | `src/application/ports/`: cinco portas pequenas. Justificar a entrega: uma porta `MessageSender` + registro `canal → adaptador`; alternativas descartadas (uma porta por canal obrigaria `switch` no caso de uso; adaptador único com `if/else` obrigaria editar o adaptador a cada canal). |
| 9:30–10:30 | **4. composição das dependências** | `src/main/config.ts` (único leitor de `process.env`), `container.ts` (instancia e conecta), `server.ts`. Mostrar `APP_STORAGE=memory` subindo sem Prisma. |
| 10:30–13:00 | **5. demonstração do E9** | canal WhatsApp: `POST` com `["whatsapp"]` → `SENT`; contato sem telefone → `FAILED`; opt-out do canal. CLI enviando pelo mesmo caso de uso. Troca para SMTP: `EMAIL_PROVIDER=smtp` e a mensagem real do Ethereal. Fechar com o `diff` do E9: domínio e casos de uso intocados. |
| 13:00–14:30 | **6. decisões técnicas** | ADR-001 (unificar envio e reenvio — mostrando o `422` novo), ADR-005 (limite conta canais repetidos, mantido de propósito), ADR-006 (erro em JSON). Explicar o critério usado: contrato preservado, exceto onde corrigir era o pedido. |
| 14:30–15:00 | fechamento | `npm test` → 50/50 com os testes da Etapa 1 sem uma linha alterada; checklist do README marcado. |

## Perguntas prováveis da banca

- **"Por que a regra de 160 caracteres não está no adaptador de SMS?"** Porque ela sobrevive à troca de
  operadora e é verificada antes de qualquer chamada externa: é regra de negócio, e o adaptador só entrega.
- **"Se eu criar o canal `telegram`, o que muda?"** Uma descrição em `domain/channels/`, um adaptador e uma
  linha no catálogo/registro. Nenhum caso de uso, entidade ou regra existente.
- **"Onde está a garantia de que o contrato não mudou?"** Nos 24 testes caixa-preta escritos antes da
  refatoração, que continuam passando sem alteração contra a implementação nova.
- **"O que acontece se o Prisma mudar de versão?"** Nada fora de `src/adapters/out/prisma/`: os tipos do
  ORM não atravessam a porta.
- **"Por que `optOut` é array numa rota e string em outra?"** Porque o contrato original fazia isso (D5);
  a assimetria foi preservada e está documentada — mudá-la seria decisão de produto, não de refatoração.
