import { analyzeTranslations } from '@ls-stack/i18n-core/compiler';
import type ts from '@typescript/typescript6';
import { expect, test, vi } from 'vitest';

const walk = vi.hoisted(() => ({ visitedNodes: 0 }));

vi.mock('@typescript/typescript6', async (importOriginal) => {
  const original = await importOriginal<{ default: typeof ts }>();
  const tsModule = original.default;

  const forEachChild: typeof tsModule.forEachChild = (
    node,
    cbNode,
    cbNodes,
  ) => {
    walk.visitedNodes++;
    return tsModule.forEachChild(node, cbNode, cbNodes);
  };

  return { default: { ...tsModule, forEachChild } };
});

function getHandlers(count: number): string {
  return Array.from(
    { length: count },
    (_, i) => `
      const onSelect${i} = (event: MouseEvent, items: Item[]) => {
        if (!event.defaultPrevented) setSelected(items[${i}]?.id ?? null);
        trackEvent('select', { index: ${i}, total: items.length });
      };
    `,
  ).join('\n');
}

function countVisitedNodes(code: string): number {
  walk.visitedNodes = 0;
  analyzeTranslations('/app/src/ChannelList.tsx', code);
  return walk.visitedNodes;
}

test('only walks the parts of the file that contain translation names', () => {
  const code = (handlers: number) => `
    export function ChannelList({ items }: Props) {
      ${getHandlers(handlers)}
      return <Empty title={__\`No channels\`} count={items.length} />;
    }
  `;

  const { calls } = analyzeTranslations('/app/src/ChannelList.tsx', code(200));
  expect(calls.map((call) => call.hash)).toEqual(['No channels']);

  // the code without translation names is skipped, so the walk doesn't grow
  // with the size of the file
  const visitedWith10Handlers = countVisitedNodes(code(10));
  const visitedWith200Handlers = countVisitedNodes(code(200));

  expect(visitedWith200Handlers).toBe(visitedWith10Handlers);
  expect(visitedWith200Handlers).toBeLessThan(30);
});

test('code with unicode escapes is fully walked', () => {
  const code = `
    const nbsp = '\\u00a0';
    ${getHandlers(10)}
    export const title = __\`Channels\`;
  `;

  const { calls } = analyzeTranslations('/app/src/ChannelList.tsx', code);

  expect(calls.map((call) => call.hash)).toEqual(['Channels']);
  expect(countVisitedNodes(code)).toBeGreaterThan(100);
});
