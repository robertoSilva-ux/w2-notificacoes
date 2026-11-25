# Etapa 1 — Rede de segurança (testes caixa-preta)

## Como rodar

```bash
npm test        # node --import tsx --test tests/e2e/*.test.ts  (24 testes, ~4 s)
npm run typecheck
```

Não há dependência nova: `node:test` + `fetch` nativos, `tsx` que já estava no projeto.

## Como funciona

- Cada arquivo de teste cria um **banco próprio e descartável** (`test-contacts.db`,
  `test-notifications.db`, `test-retry.db`) aplicando os SQL de `prisma/migrations/` — sem o CLI do Prisma.
- Cada teste sobe o entrypoint (`src/index.ts`) em um **processo separado**, com `PORT`,
  `DATABASE_URL` e `SMS_FAILURE_RATE` próprios, e fala com ele só por HTTP.
- Estas 24 asserções foram escritas quando `src/index.ts` ainda era o arquivo único original — que hoje
  está preservado em `legacy/index.ts` (idêntico, `diff` confirma). Elas não foram tocadas depois disso:
  continuam verdes rodando contra a implementação hexagonal. É essa a prova de "contrato preservado".
- `tests/helpers/api.ts` espera o servidor responder (`GET /contacts`) antes de liberar os testes;
  `tests/helpers/db.ts` cria/limpa o banco.
- Ordem: as portas são fixas por arquivo (3031, 3032, 3033) e os arquivos rodam em paralelo, cada um com o
  seu banco.

## Cobertura (24 testes)

| Arquivo | O que fixa |
| --- | --- |
| `contract-contacts.test.ts` | criação válida (201, formato, `trim`, `optOut` array), as 5 validações de entrada (400), listagem em ordem de id, detalhe 200/404 |
| `contract-notifications.test.ts` | envio pelos 3 canais (201, array, `SENT`, `attempts`, `providerId` por canal, `sentAt`), validações de entrada (400), contato inexistente (404), as 4 regras de canal virando `FAILED` + `lastError` (com 160/161 caracteres nos dois lados do limite), deduplicação de canais, limite de 5/min (429), filtros da listagem e ordem decrescente, detalhe com contato embutido, `/fake-inbox` |
| `contract-retry.test.ts` | 409 para `SENT`, 404, 422 para regra de canal, 502 com `attempts` incrementado e 409 no limite de 3 tentativas, e o reenvio bem-sucedido depois que o provedor volta (dois processos sobre o mesmo banco) |

## O que dificultou (e virou argumento para as portas)

1. **Aleatoriedade**: só dá para controlar a falha do SMS reiniciando o processo com outro
   `SMS_FAILURE_RATE`. Para testar "falhou e depois funcionou" foi preciso derrubar e subir o servidor.
   → porta `Random` (ADR-003).
2. **Tempo**: o limite de 5/min depende de `Date.now()` e de 60 segundos reais. O teste funciona, mas não
   consegue exercitar a *borda* (o que acontece exatamente ao completar 1 minuto) sem esperar.
   → porta `Clock` (ADR-003).
3. **Estado do canal `fake`** só é observável por HTTP, porque o `fakeInbox` vive no módulo.
   → porta de leitura do canal `fake` (ADR-004).
4. **Nada é testável sem HTTP + SQLite**: as regras R7–R13 só existem dentro dos handlers.
5. **`prisma migrate deploy` não roda neste ambiente** (o CLI é bloqueado por exceder o limite de leitura
   de script). Os testes aplicam o `migration.sql` direto pelo `better-sqlite3` — o schema é o mesmo.

## Cenários deliberadamente fora da rede (ver `00-inventario.md`, seção 6)

D1 (retry não valida 160/`subject`), D2 (`201+FAILED` × `422`), D4 (limite conta canais repetidos) e
D8 (erro interno em HTML). Congelá-los transformaria bug em requisito; eles entram na Etapa 8, depois da
decisão do ADR-001.
