import { validateTranslations } from '@ls-stack/i18n-core/cli';
import { consoleFmt as c } from '@ls-stack/utils/consoleFmt';
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

const { hasError } = await validateTranslations({
  srcDir,
  configDir,
  defaultLocale: parsed.flags.default,
  fix: parsed.flags.fix,
  noColor: parsed.flags['no-color'],
  colorFn: (color: string, text: string) => c.color(color as 'red', text),
});

if (hasError) {
  process.exit(1);
}
