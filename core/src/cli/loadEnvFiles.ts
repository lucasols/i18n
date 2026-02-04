import { config } from 'dotenv';

export function loadEnvFiles(): void {
  config({ path: ['.env.local', '.env'], quiet: true });
}
