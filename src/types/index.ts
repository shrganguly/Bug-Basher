export interface BugDetails {
  title: string;
  description: string;
  reproSteps?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  tags?: string[];
  originalMessage?: string;
  areaPath?: string;
  iterationPath?: string;
}

export interface ADOConfig {
  organization: string;
  project: string;
  pat: string;
  areaPath?: string;
  iterationPath?: string;
}

export interface AIConfig {
  provider: 'claude' | 'azure-openai';
  apiKey: string;
  // For Azure OpenAI
  endpoint?: string;
  deploymentName?: string;
  apiVersion?: string;
  // For Claude
  model?: string;
}

export interface BotConfig {
  appId: string;
  appPassword: string;
  appType?: string;
  tenantId?: string;
}

export interface AppConfig {
  port: number;
  baseUrl: string;
  bot: BotConfig;
  ai: AIConfig;
  ado: ADOConfig;
}

export interface CommandParseResult {
  isCommand: boolean;
  commandType?: 'raise_bug' | 'create_bug' | 'report_bug' | 'setup';
  repliedMessageId?: string;
  repliedMessageText?: string;
}

export interface ADOWorkItem {
  id: number;
  url: string;
  fields: {
    'System.Title': string;
    'System.Description': string;
    'System.State': string;
    [key: string]: any;
  };
}

export interface ConversationConfig {
  areaPath?: string;
  iterationPath?: string;
  isConfigured: boolean;
}

export interface UserConfig {
  pat?: string;
  areaPath?: string;
  iterationPath?: string;
  isConfigured: boolean;
  configuredAt?: Date;
}
