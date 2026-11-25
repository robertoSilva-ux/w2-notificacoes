/**
 * Segundo adaptador primário (Etapa 9): um CLI que usa os MESMOS casos de uso do HTTP.
 *
 * Nada de regra aqui — é tradução de argumentos para entrada de caso de uso e da saída
 * para texto, exatamente como o adaptador HTTP faz com requisição/resposta.
 */
import { loadConfig } from './config.js';
import { buildContainer } from './container.js';

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = 'true';
    } else {
      flags[key] = next;
      i++;
    }
  }
  return flags;
}

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

const HELP = `Uso:
  npm run cli -- add-contact --name "<nome>" --email <email> [--phone <E.164>] [--optout sms,email]
  npm run cli -- contacts
  npm run cli -- contact --contact <id>
  npm run cli -- send --contact <id> --channels sms,email --subject "<assunto>" --message "<texto>"
  npm run cli -- retry --id <id>
  npm run cli -- inbox --contact <id>`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const flags = parseFlags(rest);
  const config = loadConfig();
  const container = buildContainer(config);

  try {
    switch (command) {
      case 'add-contact': {
        const created = await container.uses.createContact.execute({
          name: flags.name,
          email: flags.email,
          phone: flags.phone,
          optOut: flags.optout ? String(flags.optout).split(',') : undefined,
        });
        print({ id: created.id, name: created.name, email: created.email, phone: created.phone, optOut: created.optOut.map((c) => c.name) });
        return 0;
      }

      case 'contacts':
        print(await container.uses.listContacts.execute());
        return 0;

      case 'contact':
        print(await container.uses.getContact.execute(Number(flags.contact)));
        return 0;

      case 'send': {
        const notifications = await container.uses.sendNotifications.execute({
          contactId: Number(flags.contact),
          channels: String(flags.channels ?? '').split(',').filter((c) => c.length > 0),
          message: String(flags.message ?? ''),
          subject: flags.subject ?? null,
        });
        print(
          notifications.map((n) => ({
            id: n.id,
            channel: n.channel.name,
            status: n.status,
            attempts: n.attempts,
            lastError: n.lastError,
          })),
        );
        return notifications.every((n) => n.status === 'SENT') ? 0 : 2;
      }

      case 'retry': {
        const notification = await container.uses.retryNotification.execute(Number(flags.id));
        print({
          id: notification.id,
          channel: notification.channel.name,
          status: notification.status,
          attempts: notification.attempts,
          providerId: notification.providerId,
        });
        return 0;
      }

      case 'inbox':
        print(await container.uses.listDeliveredMessages.execute(Number(flags.contact)));
        return 0;

      default:
        console.error(HELP);
        return 1;
    }
  } catch (error) {
    console.error('erro:', error instanceof Error ? error.message : error);
    return 1;
  } finally {
    await container.close();
  }
}

main(process.argv.slice(2)).then((code) => process.exit(code));
