import * as local from '@ls-stack/i18n';
import * as published from 'i18n-published';
import { bench, do_not_optimize, group, run, summary } from 'mitata';
import React from 'react';

const translations = {
  'Hello {1}': 'Hola {1}',
  Welcome: 'Welcome',
  Comments: 'Comments',
  'You have no comments chats': 'You have no comments chats',
  Email: 'Email',
  'You have no email chats': 'You have no email chats',
  'Direct Messages': 'Direct Messages',
  'You have no direct messages': 'You have no direct messages',
  Saved: 'Saved',
  'You have no bookmarked conversations':
    'You have no bookmarked conversations',
  Channels: 'Channels',
  'You have no channels': 'You have no channels',
  Bookmarked: 'Bookmarked',
  New: 'New',
  'You have no unread conversations': 'You have no unread conversations',
  Read: 'Read',
  'You have no read chats': 'You have no read chats',
  'No chats found': 'No chats found',
  Untitled: 'Untitled',
  'Remove bookmark': 'Remove bookmark',
  'Bookmark chat': 'Bookmark chat',
  'You have {1} items': {
    one: 'You have one item',
    '+2': 'You have # items',
    manyLimit: 10,
    many: 'You have many items',
  },
  'Nested {1} {2}': 'Nested {1} {2}',
};

async function setup(mod: typeof local | typeof published) {
  if (typeof mod.resetState === 'function') {
    mod.resetState();
  }

  const controller = mod.i18nitialize({
    locales: [
      {
        id: 'en',
        loader: async () => ({ default: translations }),
      },
    ],
    persistenceKey: 'bench',
    fallbackLocale: 'en',
    dev: false,
  });

  await controller.setLocale('en');
  return controller;
}

await setup(local);
await setup(published);

function getName() {
  return 'Lucas';
}
function getCount() {
  return 2;
}
function getJsxNode() {
  return React.createElement('span', null, 'X');
}
function getList() {
  return ['alpha', 'beta', 'gamma'];
}
function getDate() {
  return new Date('2024-01-01T00:00:00Z');
}
function getRelativeValue() {
  return {
    from: new Date('2024-01-01T00:00:00Z'),
    to: new Date('2024-01-02T00:00:00Z'),
  };
}
function getDurationObj() {
  return { hours: 1, minutes: 2, seconds: 3 };
}
function getDurationInput() {
  return { ms: 123456, short: true };
}
function getNumber() {
  return 12345.678;
}

summary(() => {
  group('__ hit', () => {
    bench('published', function* () {
      yield {
        [0]: getName,
        bench: (n: string) => do_not_optimize(published.__`Hello ${n}`),
      };
    });
    bench('local', function* () {
      yield {
        [0]: getName,
        bench: (n: string) => do_not_optimize(local.__`Hello ${n}`),
      };
    }).baseline();
  });

  group('__ miss', () => {
    bench('published', function* () {
      yield {
        [0]: getName,
        bench: (n: string) => do_not_optimize(published.__`Missing ${n}`),
      };
    });
    bench('local', function* () {
      yield {
        [0]: getName,
        bench: (n: string) => do_not_optimize(local.__`Missing ${n}`),
      };
    }).baseline();
  });

  group('__p hit', () => {
    bench('published', function* () {
      yield {
        [0]: getCount,
        bench: (c: number) =>
          do_not_optimize(published.__p(c)`You have ${c} items`),
      };
    });
    bench('local', function* () {
      yield {
        [0]: getCount,
        bench: (c: number) =>
          do_not_optimize(local.__p(c)`You have ${c} items`),
      };
    }).baseline();
  });

  group('chat menu render', () => {
    bench('published', function* () {
      yield {
        [0]: getCount,
        bench(c: number) {
          do_not_optimize(published.__`Comments`);
          do_not_optimize(published.__`You have no comments chats`);
          do_not_optimize(published.__`Email`);
          do_not_optimize(published.__`You have no email chats`);
          do_not_optimize(published.__`Direct Messages`);
          do_not_optimize(published.__`You have no direct messages`);
          do_not_optimize(published.__`Saved`);
          do_not_optimize(published.__`You have no bookmarked conversations`);
          do_not_optimize(published.__`Channels`);
          do_not_optimize(published.__`You have no channels`);
          do_not_optimize(published.__`Bookmarked`);
          do_not_optimize(published.__`New`);
          do_not_optimize(published.__`You have no unread conversations`);
          do_not_optimize(published.__`Read`);
          do_not_optimize(published.__`You have no read chats`);
          do_not_optimize(published.__`No chats found`);
          do_not_optimize(published.__`Untitled`);
          do_not_optimize(published.__`Remove bookmark`);
          do_not_optimize(published.__`Bookmark chat`);
          do_not_optimize(published.__p(c)`You have ${c} items`);
        },
      };
    });
    bench('local', function* () {
      yield {
        [0]: getCount,
        bench(c: number) {
          do_not_optimize(local.__`Comments`);
          do_not_optimize(local.__`You have no comments chats`);
          do_not_optimize(local.__`Email`);
          do_not_optimize(local.__`You have no email chats`);
          do_not_optimize(local.__`Direct Messages`);
          do_not_optimize(local.__`You have no direct messages`);
          do_not_optimize(local.__`Saved`);
          do_not_optimize(local.__`You have no bookmarked conversations`);
          do_not_optimize(local.__`Channels`);
          do_not_optimize(local.__`You have no channels`);
          do_not_optimize(local.__`Bookmarked`);
          do_not_optimize(local.__`New`);
          do_not_optimize(local.__`You have no unread conversations`);
          do_not_optimize(local.__`Read`);
          do_not_optimize(local.__`You have no read chats`);
          do_not_optimize(local.__`No chats found`);
          do_not_optimize(local.__`Untitled`);
          do_not_optimize(local.__`Remove bookmark`);
          do_not_optimize(local.__`Bookmark chat`);
          do_not_optimize(local.__p(c)`You have ${c} items`);
        },
      };
    }).baseline();
  });

  group('__jsx hit', () => {
    bench('published', function* () {
      yield {
        [0]: getJsxNode,
        bench: (jsx: React.ReactElement) =>
          do_not_optimize(published.__jsx`Hello ${jsx}`),
      };
    });
    bench('local', function* () {
      yield {
        [0]: getJsxNode,
        bench: (jsx: React.ReactElement) =>
          do_not_optimize(local.__jsx`Hello ${jsx}`),
      };
    }).baseline();
  });

  group('__pjsx hit', () => {
    bench('published', function* () {
      yield {
        [0]: getCount,
        [1]: getJsxNode,
        bench: (c: number, jsx: React.ReactElement) =>
          do_not_optimize(published.__pjsx(c)`You have ${jsx} items`),
      };
    });
    bench('local', function* () {
      yield {
        [0]: getCount,
        [1]: getJsxNode,
        bench: (c: number, jsx: React.ReactElement) =>
          do_not_optimize(local.__pjsx(c)`You have ${jsx} items`),
      };
    }).baseline();
  });

  group('__date', () => {
    bench('published', function* () {
      yield {
        [0]: getDate,
        bench: (d: Date) => do_not_optimize(published.__date(d)),
      };
    });
    bench('local', function* () {
      yield {
        [0]: getDate,
        bench: (d: Date) => do_not_optimize(local.__date(d)),
      };
    }).baseline();
  });

  group('__num', () => {
    bench('published', function* () {
      yield {
        [0]: getNumber,
        bench: (n: number) => do_not_optimize(published.__num(n)),
      };
    });
    bench('local', function* () {
      yield {
        [0]: getNumber,
        bench: (n: number) => do_not_optimize(local.__num(n)),
      };
    }).baseline();
  });

  group('__relativeTime', () => {
    bench('published', function* () {
      yield {
        [0]: getRelativeValue,
        bench: (r: { from: Date; to: Date }) =>
          do_not_optimize(published.__relativeTime(r)),
      };
    });
    bench('local', function* () {
      yield {
        [0]: getRelativeValue,
        bench: (r: { from: Date; to: Date }) =>
          do_not_optimize(local.__relativeTime(r)),
      };
    }).baseline();
  });

  group('__list', () => {
    bench('published', function* () {
      yield {
        [0]: getList,
        bench: (l: string[]) => do_not_optimize(published.__list(l)),
      };
    });
    bench('local', function* () {
      yield {
        [0]: getList,
        bench: (l: string[]) => do_not_optimize(local.__list(l)),
      };
    }).baseline();
  });

  group('__formattedTimeDuration', () => {
    bench('published', function* () {
      yield {
        [0]: getDurationObj,
        bench: (d: { hours: number; minutes: number; seconds: number }) =>
          do_not_optimize(published.__formattedTimeDuration(d)),
      };
    });
    bench('local', function* () {
      yield {
        [0]: getDurationObj,
        bench: (d: { hours: number; minutes: number; seconds: number }) =>
          do_not_optimize(local.__formattedTimeDuration(d)),
      };
    }).baseline();
  });

  group('__timeDuration', () => {
    bench('published', function* () {
      yield {
        [0]: getDurationInput,
        bench: (d: { ms: number; short: boolean }) =>
          do_not_optimize(published.__timeDuration(d)),
      };
    });
    bench('local', function* () {
      yield {
        [0]: getDurationInput,
        bench: (d: { ms: number; short: boolean }) =>
          do_not_optimize(local.__timeDuration(d)),
      };
    }).baseline();
  });
});

await run();
