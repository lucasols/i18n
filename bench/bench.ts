import * as local from '@ls-stack/i18n';
import * as published from 'i18n-published';
import { bench, group, run } from 'mitata';
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

async function setup(mod) {
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

const name = 'Lucas';
const count = 2;
const jsxNode = React.createElement('span', null, 'X');
const list = ['alpha', 'beta', 'gamma'];
const date = new Date('2024-01-01T00:00:00Z');
const fromDate = new Date('2024-01-01T00:00:00Z');
const toDate = new Date('2024-01-02T00:00:00Z');
const relativeValue = { from: fromDate, to: toDate };
const durationObj = { hours: 1, minutes: 2, seconds: 3 };
const durationInput = { ms: 123456, short: true };

const cases: [string, (mod: typeof local | typeof published) => void][] = [
  ['__ hit', (mod) => mod.__`Hello ${name}`],
  ['__ miss', (mod) => mod.__`Missing ${name}`],
  ['__p hit', (mod) => mod.__p(count)`You have ${count} items`],
  [
    'chat menu render',
    (mod) => {
      mod.__`Comments`;
      mod.__`You have no comments chats`;
      mod.__`Email`;
      mod.__`You have no email chats`;
      mod.__`Direct Messages`;
      mod.__`You have no direct messages`;
      mod.__`Saved`;
      mod.__`You have no bookmarked conversations`;
      mod.__`Channels`;
      mod.__`You have no channels`;
      mod.__`Bookmarked`;
      mod.__`New`;
      mod.__`You have no unread conversations`;
      mod.__`Read`;
      mod.__`You have no read chats`;
      mod.__`No chats found`;
      mod.__`Untitled`;
      mod.__`Remove bookmark`;
      mod.__`Bookmark chat`;
      mod.__p(count)`You have ${count} items`;
    },
  ],
  ['__jsx hit', (mod) => mod.__jsx`Hello ${jsxNode}`],
  ['__pjsx hit', (mod) => mod.__pjsx(count)`You have ${jsxNode} items`],
  ['__date', (mod) => mod.__date(date)],
  ['__num', (mod) => mod.__num(12345.678)],
  ['__relativeTime', (mod) => mod.__relativeTime(relativeValue)],
  ['__list', (mod) => mod.__list(list)],
  [
    '__formattedTimeDuration',
    (mod) => mod.__formattedTimeDuration(durationObj),
  ],
  ['__timeDuration', (mod) => mod.__timeDuration(durationInput)],
];

for (const [label, fn] of cases) {
  group(label, () => {
    bench('published', () => fn(published)).baseline();
    bench('local', () => fn(local));
  });
}

await run();
