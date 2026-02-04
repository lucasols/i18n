import { config } from 'dotenv';

export function loadEnvFiles(): void {
  config();
}
