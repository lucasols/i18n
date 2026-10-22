/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  __,
  __p,
  __registerDevFallbacks,
  __t,
  __tjsx,
  __tp,
  __tpjsx,
  resetState,
} from '../src/main';
import { createTestCompiler, createTestController } from './test-utils';

beforeEach(() => {
  resetState();
});

afterEach(() => {
  cleanup();
});

const inboxSource = `
  export function Inbox({ user, count, folder }: Props) {
    return (
      <div>
        <h1>{__\`Direct Messages\`}</h1>
        <p>{__\`Hello \${user.name}, welcome back!\`}</p>
        <p>{__\`Hello \${user.name}, welcome back!~~formal\`}</p>
        <p>{__p(count)\`You have # unread messages\`}</p>
        <p>{__p(count)\`# files shared in \${channel}\`}</p>
        <p>{__jsx\`Message \${<strong>{user.name}</strong>} directly\`}</p>
        <p>{__pjsx(count)\`# files in \${<em>{folder}</em>}\`}</p>
        <p>{__\`$terms_of_service\`}</p>
        <p>{__\`Export as PDF\`}</p>
      </div>
    );
  }
`;

const en = {
  'You have # unread messages': {
    zero: 'You have no unread messages',
    one: 'You have one unread message',
    '+2': 'You have # unread messages',
    many: 'You have a lot of unread messages',
    manyLimit: 99,
  },
  '# files in {1}': { one: '1 file in {1}', '+2': '# files in {1}' },
  $terms_of_service: 'By using this app you agree to our terms of service.',
};

const pt = {
  'Direct Messages': 'Mensagens diretas',
  'Hello {1}, welcome back!': 'Olá {1}, bem-vindo de volta!',
  'Hello {1}, welcome back!~~formal': 'Seja bem-vindo novamente, {1}!',
  'You have # unread messages': {
    zero: 'Você não tem mensagens não lidas',
    one: 'Você tem uma mensagem não lida',
    '+2': 'Você tem # mensagens não lidas',
    many: 'Você tem muitas mensagens não lidas',
    manyLimit: 99,
  },
  'Message {1} directly': 'Enviar mensagem direta para {1}',
  '# files shared in {1}': {
    one: '1 arquivo compartilhado em {1}',
    '+2': '# arquivos compartilhados em {1}',
  },
  '# files in {1}': {
    zero: 'Nenhum arquivo em {1}',
    one: '1 arquivo em {1}',
    '+2': '# arquivos em {1}',
  },
};

function setup() {
  const compiler = createTestCompiler(inboxSource);
  const controller = createTestController({
    locales: { en: compiler.compile(en), pt: compiler.compile(pt) },
  });

  return { ...compiler, controller };
}

describe('compiled translations', () => {
  test('before loading, returns an empty string', () => {
    const { id } = setup();

    expect(__t(id('Direct Messages'))).toBe('');
    expect(__tp(id('You have # unread messages', { plural: true }), 2)).toBe(
      '',
    );
  });

  test('after loading, returns the translation', async () => {
    const { id, controller } = setup();

    await controller.setLocale('pt');

    expect(__t(id('Direct Messages'))).toBe('Mensagens diretas');
    expect(__t(id('Export as PDF'))).toBe('Export as PDF');
  });

  test('default locale renders the source strings', async () => {
    const { id, controller } = setup();

    await controller.setLocale('en');

    expect(__t(id('Direct Messages'))).toBe('Direct Messages');
    expect(__t(id('Hello {1}, welcome back!'), 'Ana')).toBe(
      'Hello Ana, welcome back!',
    );
    expect(__t(id('Hello {1}, welcome back!~~formal'), 'Ana')).toBe(
      'Hello Ana, welcome back!',
    );
    expect(__t(id('$terms_of_service'))).toBe(
      'By using this app you agree to our terms of service.',
    );
  });

  test('interpolation and variants', async () => {
    const { id, controller } = setup();

    await controller.setLocale('pt');

    expect(__t(id('Hello {1}, welcome back!'), 'Ana')).toBe(
      'Olá Ana, bem-vindo de volta!',
    );
    expect(__t(id('Hello {1}, welcome back!'), 'Bruno')).toBe(
      'Olá Bruno, bem-vindo de volta!',
    );
    expect(__t(id('Hello {1}, welcome back!~~formal'), 'Ana')).toBe(
      'Seja bem-vindo novamente, Ana!',
    );
  });

  test('missing $ translation renders the placeholder', async () => {
    const { id, controller } = setup();

    await controller.setLocale('pt');

    expect(__t(id('$terms_of_service'))).toBe('…');
  });

  test('plural forms', async () => {
    const { id, controller } = setup();
    const unreadId = id('You have # unread messages', { plural: true });

    await controller.setLocale('pt');

    expect(__tp(unreadId, 0)).toBe('Você não tem mensagens não lidas');
    expect(__tp(unreadId, 1)).toBe('Você tem uma mensagem não lida');
    expect(__tp(unreadId, 12)).toBe('Você tem 12 mensagens não lidas');
    expect(__tp(unreadId, 99)).toBe('Você tem 99 mensagens não lidas');
    expect(__tp(unreadId, 100)).toBe('Você tem muitas mensagens não lidas');
  });

  test('plural forms with interpolations containing #', async () => {
    const { id, controller } = setup();
    const sharedId = id('# files shared in {1}', { plural: true });

    await controller.setLocale('pt');

    expect(__tp(sharedId, 1, '#design')).toBe(
      '1 arquivo compartilhado em #design',
    );
    expect(__tp(sharedId, 3, '#design')).toBe(
      '3 arquivos compartilhados em #design',
    );
    expect(__tp(sharedId, 12, '#general')).toBe(
      '12 arquivos compartilhados em #general',
    );

    await controller.setLocale('en');

    expect(__tp(sharedId, 1, '#design')).toBe('1 files shared in #design');
    expect(__tp(sharedId, 3, '#design')).toBe('3 files shared in #design');
  });

  test('cached interpolations are updated when the locale changes', async () => {
    const { id, controller } = setup();
    const welcomeId = id('Hello {1}, welcome back!');

    await controller.setLocale('pt');
    expect(__t(welcomeId, 'Ana')).toBe('Olá Ana, bem-vindo de volta!');

    await controller.setLocale('en');
    expect(__t(welcomeId, 'Ana')).toBe('Hello Ana, welcome back!');

    await controller.setLocale('pt');
    expect(__t(welcomeId, 'Ana')).toBe('Olá Ana, bem-vindo de volta!');
  });

  test('jsx translations', async () => {
    const { id, controller } = setup();
    const filesId = id('# files in {1}', { plural: true });

    await controller.setLocale('pt');

    render(
      <div>
        <p data-testid="link">
          {__tjsx(id('Message {1} directly'), <strong>Ana</strong>)}
        </p>
        <p data-testid="no-files">{__tpjsx(filesId, 0, <em>Docs</em>)}</p>
        <p data-testid="files">{__tpjsx(filesId, 3, <em>Docs</em>)}</p>
      </div>,
    );

    expect(screen.getByTestId('link').innerHTML).toBe(
      'Enviar mensagem direta para <strong>Ana</strong>',
    );
    expect(screen.getByTestId('no-files').innerHTML).toBe(
      'Nenhum arquivo em <em>Docs</em>',
    );
    expect(screen.getByTestId('files').innerHTML).toBe(
      '3 arquivos em <em>Docs</em>',
    );
  });

  test('renders the same output as the uncompiled runtime', async () => {
    const { id, controller } = setup();
    const unreadId = id('You have # unread messages', { plural: true });

    await controller.setLocale('pt');

    const compiled = [
      __t(id('Direct Messages')),
      __t(id('Hello {1}, welcome back!'), 'Ana'),
      __t(id('$terms_of_service')),
      __t(id('Export as PDF')),
      ...[0, 1, 5, 100].map((count) => __tp(unreadId, count)),
      ...[1, 3].map((count) =>
        __tp(id('# files shared in {1}', { plural: true }), count, '#design'),
      ),
    ];

    resetState();
    const uncompiledController = createTestController({ locales: { en, pt } });
    await uncompiledController.setLocale('pt');

    expect(compiled).toEqual([
      __`Direct Messages`,
      __`Hello ${'Ana'}, welcome back!`,
      __`$terms_of_service`,
      __`Export as PDF`,
      ...[0, 1, 5, 100].map((count) => __p(count)`You have # unread messages`),
      ...[1, 3].map((count) => __p(count)`# files shared in ${'#design'}`),
    ]);
  });
});

describe('dev fallbacks', () => {
  test('translations added after the locale was loaded render the source string', async () => {
    const { registry, controller } = setup();

    await controller.setLocale('pt');

    const archiveId = registry.add('Archive conversation', false);
    const membersId = registry.add('# members', true);
    const privacyId = registry.add('$privacy_policy', false);

    __registerDevFallbacks([
      [archiveId, 'Archive conversation'],
      [membersId, '# members'],
      [privacyId, 0],
    ]);

    expect(__t(archiveId)).toBe('Archive conversation');
    expect(__tp(membersId, 4)).toBe('4 members');
    expect(__t(privacyId)).toBe('…');
  });

  test('loaded translations take precedence over the fallbacks', async () => {
    const { id, controller } = setup();

    __registerDevFallbacks([[id('Direct Messages'), 'Direct Messages']]);
    await controller.setLocale('pt');

    expect(__t(id('Direct Messages'))).toBe('Mensagens diretas');
  });

  test('resetState clears the registered fallbacks', async () => {
    const { registry, compile } = createTestCompiler(inboxSource);
    const compiledPt = compile(pt);
    const archiveId = registry.add('Archive conversation', false);

    __registerDevFallbacks([[archiveId, 'Archive conversation']]);
    resetState();

    const controller = createTestController({ locales: { pt: compiledPt } });
    await controller.setLocale('pt');

    expect(__t(archiveId)).toBe('');
  });
});
