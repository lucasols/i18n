import {
  createAITranslator,
  validateTranslations,
  type AIProvider,
  type AITranslator,
} from '@ls-stack/i18n-core/cli';
import { styleText } from 'node:util';
import { typeFlag } from 'type-flag';

const parsed = typeFlag({
  'config-dir': {
    type: String,
    alias: 'c',
  },
  'src-dir': {
    type: String,
    alias: 'r',
  },
  default: {
    type: String,
    alias: 'd',
  },
  fix: {
    type: Boolean,
    alias: 'f',
    default: false,
  },
  'no-color': {
    type: Boolean,
    default: false,
  },
  ai: {
    type: String,
  },
});

const srcDir = parsed.flags['src-dir'];
if (!srcDir) {
  console.error('--src-dir is required');
  process.exit(1);
}

const configDir = parsed.flags['config-dir'];
if (!configDir) {
  console.error('--config-dir is required');
  process.exit(1);
}

let aiTranslator: AITranslator | undefined;

const aiProviderInput =
  parsed.flags.ai ?? process.env['I18N_AI_AUTO_TRANSLATE'];

if (aiProviderInput) {
  if (aiProviderInput !== 'google' && aiProviderInput !== 'openai') {
    console.error(
      `Invalid AI provider: ${aiProviderInput}. Must be 'google' or 'openai'.`,
    );
    process.exit(1);
  }

  const provider: AIProvider = aiProviderInput;

  const apiKeyEnvVar =
    provider === 'google' ?
      'GOOGLE_GENERATIVE_AI_API_KEY'
    : 'OPENAI_API_KEY';
  const hasApiKey = Boolean(process.env[apiKeyEnvVar]);

  if (!hasApiKey) {
    console.warn(
      `Warning: ${apiKeyEnvVar} not set. AI translation will be skipped.`,
    );
  } else {
    aiTranslator = createAITranslator(provider);
  }
}

const { hasError } = await validateTranslations({
  srcDir,
  configDir,
  defaultLocale: parsed.flags.default,
  fix: parsed.flags.fix,
  noColor: parsed.flags['no-color'],
  colorFn: (color, text) => styleText(color, text),
  aiTranslator,
});

if (hasError) {
  process.exit(1);
}
