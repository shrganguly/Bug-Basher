import express, { Request, Response } from 'express';
import cors from 'cors';
import {
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  createBotFrameworkAuthenticationFromConfiguration,
  MemoryStorage,
  ConversationState,
  UserState,
  Storage,
} from 'botbuilder';
import { getConfig, validateConfig } from './utils/config';
import { logger } from './utils/logger';
import { BugRaiserBot } from './bot/bugRaiserBot';
import { FileStorage } from './utils/fileStorage';

// Load and validate configuration
const config = getConfig();
validateConfig(config);

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Bot Framework setup
const botConfig = {
  MicrosoftAppId: config.bot.appId,
  MicrosoftAppPassword: config.bot.appPassword,
  MicrosoftAppType: config.bot.appType || 'MultiTenant',
  MicrosoftAppTenantId: config.bot.tenantId,
};

logger.info('Bot Framework Configuration:', {
  appId: botConfig.MicrosoftAppId ? `${botConfig.MicrosoftAppId.substring(0, 8)}...` : 'NOT SET',
  appType: botConfig.MicrosoftAppType,
  tenantId: botConfig.MicrosoftAppTenantId || 'Not specified',
});

const credentialsFactory = new ConfigurationServiceClientCredentialFactory(botConfig);
const botFrameworkAuthentication = createBotFrameworkAuthenticationFromConfiguration(
  null,
  credentialsFactory
);
const adapter = new CloudAdapter(botFrameworkAuthentication);

// Error handler for bot framework
adapter.onTurnError = async (context, error) => {
  logger.error('Bot turn error', {
    errorType: error.name,
    errorMessage: error.message,
    statusCode: (error as any).statusCode,
    stack: error.stack,
  });

  // Send user-friendly message
  await context.sendActivity('Sorry, something went wrong. Please try again later.');
};

// Create storage and state management
// Using File Storage for persistence (FREE solution)
let storage: Storage;

const useFileStorage = process.env.USE_FILE_STORAGE !== 'false'; // Default to true

if (useFileStorage) {
  logger.info('✅ Using File Storage for state persistence');
  storage = new FileStorage();
} else {
  logger.warn('❌ Using MemoryStorage - State will be lost on every restart!');
  storage = new MemoryStorage();
}

const conversationState = new ConversationState(storage);
const userState = new UserState(storage);

// Add middleware to save state after each turn
adapter.use(async (context, next) => {
  await next();
  await conversationState.saveChanges(context);
  await userState.saveChanges(context);
});

// Create bot instance
const bot = new BugRaiserBot(config, conversationState, userState);

// Routes
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Teams Bug Raiser Bot',
    version: '1.0.0',
    status: 'running',
    message: 'Bot is ready to receive messages',
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      botConfigured: !!(botConfig.MicrosoftAppId && botConfig.MicrosoftAppPassword),
      aiConfigured: !!(config.ai.endpoint && config.ai.apiKey),
      adoConfigured: !!(config.ado.organization && config.ado.project && config.ado.pat),
    },
  });
});

// Bot Framework messages endpoint (required)
app.post('/api/messages', async (req: Request, res: Response) => {
  logger.debug('Received activity', { type: req.body?.type });

  await adapter.process(req, res, async (context) => {
    await bot.run(context);
  });
});

// Test endpoint for ADO connection
app.get('/api/test-ado', async (_req: Request, res: Response) => {
  try {
    const { ADOService } = await import('./services/adoService');
    new ADOService(config.ado);

    res.json({
      status: 'ADO configuration valid',
      organization: config.ado.organization,
      project: config.ado.project,
      message: 'Ready to create bugs',
    });
  } catch (error) {
    logger.error('ADO test failed', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test endpoint for AI connection
app.get('/api/test-ai', async (_req: Request, res: Response) => {
  try {
    const { AIService } = await import('./services/aiService');
    const aiService = new AIService(config.ai);

    const testResult = await aiService.analyzeBugContext(
      'The login button is broken on mobile Safari'
    );

    res.json({
      status: 'AI service working',
      testResult,
    });
  } catch (error) {
    logger.error('AI test failed', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
  logger.info(`Bot endpoint: ${config.baseUrl}/api/messages`);
  logger.info('Bug Raiser Bot is ready!');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

export { app, bot, adapter };
