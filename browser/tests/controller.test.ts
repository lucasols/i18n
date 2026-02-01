import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('controller', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('onChange notifies on locale change', async () => {
    const { i18nitialize } = await import('../src/main');

    const controller = i18nitialize({
      locales: [
        {
          id: 'en',
          loader: () => Promise.resolve({ default: {} }),
        },
        {
          id: 'pt',
          loader: () => Promise.resolve({ default: { hello: 'olá' } }),
        },
      ],
    });

    let callCount = 0;
    controller.onChange(() => {
      callCount++;
    });

    await controller.setLocale('pt');

    expect(callCount).toBeGreaterThan(0);
    expect(controller.getActiveLocale()).toBe('pt');
    expect(controller.isLoaded()).toBe(true);
  });
});
