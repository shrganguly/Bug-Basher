import * as dotenv from 'dotenv';
import { AppConfig } from '../types';

dotenv.config();

function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || '';
}

export function getConfig(): AppConfig {
  return {
    port: parseInt(getEnvVar('PORT', false) || '3000', 10),
    baseUrl: getEnvVar('BASE_URL', false) || 'http://localhost:3000',
    bot: {
      appId: getEnvVar('MICROSOFT_APP_ID'),
      appPassword: getEnvVar('MICROSOFT_APP_PASSWORD'),
      appType: getEnvVar('MICROSOFT_APP_TYPE', false) || 'MultiTenant',
      tenantId: getEnvVar('MICROSOFT_APP_TENANT_ID', false),
    },
    ai: {
      provider: (getEnvVar('AI_PROVIDER', false) || 'claude') as 'claude' | 'azure-openai',
      apiKey: getEnvVar('ANTHROPIC_API_KEY', false) || getEnvVar('AZURE_OPENAI_API_KEY', false) || '',
      model: getEnvVar('CLAUDE_MODEL', false) || 'claude-sonnet-4-20250514',
      endpoint: getEnvVar('AZURE_OPENAI_ENDPOINT', false),
      deploymentName: getEnvVar('AZURE_OPENAI_DEPLOYMENT_NAME', false),
      apiVersion: getEnvVar('AZURE_OPENAI_API_VERSION', false) || '2024-08-01-preview',
    },
    ado: {
      organization: getEnvVar('ADO_ORGANIZATION'),
      project: getEnvVar('ADO_PROJECT'),
      pat: getEnvVar('ADO_PAT'),
      areaPath: getEnvVar('ADO_AREA_PATH', false),
      iterationPath: getEnvVar('ADO_ITERATION_PATH', false),
    },
  };
}

export function validateConfig(config: AppConfig): void {
  const errors: string[] = [];

  if (!config.bot.appId) errors.push('Bot App ID is required');
  if (!config.bot.appPassword) errors.push('Bot App Password is required');
  if (!config.ai.apiKey) errors.push('AI API Key is required (ANTHROPIC_API_KEY or AZURE_OPENAI_API_KEY)');

  if (config.ai.provider === 'azure-openai') {
    if (!config.ai.endpoint) errors.push('Azure OpenAI Endpoint is required');
    if (!config.ai.deploymentName) errors.push('Azure OpenAI Deployment Name is required');
  }

  if (!config.ado.organization) errors.push('ADO Organization is required');
  if (!config.ado.project) errors.push('ADO Project is required');
  if (!config.ado.pat) errors.push('ADO PAT is required');

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}
