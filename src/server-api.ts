import express, { Request, Response } from 'express';
import cors from 'cors';
import { AIService } from './services/aiService';
import { ADOService } from './services/adoService';
import { getConfig } from './utils/config';
import { logger } from './utils/logger';

const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const config = getConfig();
const aiService = new AIService(config.ai);
const adoService = new ADOService(config.ado);

// Health check endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'Bug Basher API',
    version: '1.0.0',
  });
});

// Main API endpoint for creating bugs
app.post('/api/create-bug', async (req: Request, res: Response) => {
  try {
    const { description, context } = req.body;

    // Validate input
    if (!description) {
      return res.status(400).json({
        error: 'Missing required field: description',
      });
    }

    logger.info('Creating bug from API request', {
      descriptionLength: description.length,
      hasContext: !!context,
    });

    // Step 1: Analyze with AI
    const bugDetails = await aiService.analyzeBugContext(
      description,
      context
    );

    logger.info('Bug details extracted', { title: bugDetails.title });

    // Step 2: Create bug in ADO
    const bugUrl = await adoService.createBug(bugDetails);

    logger.info('Bug created successfully', { bugUrl });

    // Step 3: Return response
    return res.status(200).json({
      success: true,
      bugUrl,
      bugDetails: {
        title: bugDetails.title,
        description: bugDetails.description,
        severity: bugDetails.severity,
      },
    });
  } catch (error) {
    logger.error('Error creating bug', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

// Start server
app.listen(port, () => {
  logger.info('='.repeat(50));
  logger.info('Bug Basher API is ready!');
  logger.info(`Server running on port ${port}`);
  logger.info(`API endpoint: http://localhost:${port}/api/create-bug`);
  logger.info('='.repeat(50));
});
