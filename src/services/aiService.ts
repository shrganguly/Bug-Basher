import Anthropic from '@anthropic-ai/sdk';
import { AzureOpenAI } from 'openai';
import { AIConfig, BugDetails } from '../types';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export class AIService {
  private claudeClient?: Anthropic;
  private azureOpenAIClient?: AzureOpenAI;
  private provider: 'claude' | 'azure-openai';
  private model: string;
  private bugUnderstandingPrompt: string;

  constructor(config: AIConfig) {
    this.provider = config.provider;

    // Load bug understanding prompt from file
    this.bugUnderstandingPrompt = this.loadBugUnderstandingPrompt();

    if (config.provider === 'claude') {
      this.claudeClient = new Anthropic({
        apiKey: config.apiKey,
      });
      this.model = config.model || 'claude-sonnet-4-20250514';
    } else if (config.provider === 'azure-openai') {
      if (!config.endpoint || !config.deploymentName) {
        throw new Error('Azure OpenAI requires endpoint and deploymentName');
      }

      this.azureOpenAIClient = new AzureOpenAI({
        apiKey: config.apiKey,
        endpoint: config.endpoint,
        apiVersion: config.apiVersion || '2024-08-01-preview',
        deployment: config.deploymentName,
      });
      this.model = config.deploymentName;
    } else {
      throw new Error(`Unsupported AI provider: ${config.provider}`);
    }

    logger.info(`AI Service initialized with provider: ${config.provider}`);
  }

  private loadBugUnderstandingPrompt(): string {
    try {
      const promptPath = path.join(__dirname, '../../bug_understanding.md');
      const prompt = fs.readFileSync(promptPath, 'utf-8');
      logger.info('Bug understanding prompt loaded successfully');
      return prompt;
    } catch (error) {
      logger.error('Failed to load bug understanding prompt, using fallback', error);
      // Fallback to basic prompt if file cannot be loaded
      return `You are a bug analysis assistant. Analyze user messages and extract structured bug information.

Return JSON with: title, description, reproSteps, expectedBehavior, actualBehavior, severity (Critical|High|Medium|Low), tags.`;
    }
  }

  public async analyzeBugContext(
    messageText: string,
    conversationContext?: string
  ): Promise<BugDetails> {
    try {
      logger.info('Analyzing bug context with AI', {
        provider: this.provider,
        messageLength: messageText.length
      });

      if (this.provider === 'claude' && this.claudeClient) {
        return await this.analyzeWithClaude(messageText, conversationContext);
      } else if (this.provider === 'azure-openai' && this.azureOpenAIClient) {
        return await this.analyzeWithAzureOpenAI(messageText, conversationContext);
      }

      throw new Error('No AI client configured');
    } catch (error: any) {
      logger.error('AI analysis failed, using fallback parsing', {
        errorType: error.name,
        errorMessage: error.message,
        status: error.status,
        provider: this.provider,
      });

      // Fallback to basic parsing if AI fails
      logger.info('Using fallback parsing for bug details');
      return this.fallbackParsing(messageText);
    }
  }

  private async analyzeWithClaude(
    messageText: string,
    conversationContext?: string
  ): Promise<BugDetails> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(messageText, conversationContext);

    const response = await this.claudeClient!.messages.create({
      model: this.model,
      max_tokens: 1000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from the response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not find JSON in Claude response');
    }

    const parsedResult = JSON.parse(jsonMatch[0]);
    const bugDetails = this.validateAndNormalizeBugDetails(parsedResult);

    logger.info('AI analysis complete', { title: bugDetails.title });
    return bugDetails;
  }

  private async analyzeWithAzureOpenAI(
    messageText: string,
    conversationContext?: string
  ): Promise<BugDetails> {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(messageText, conversationContext);

      const response = await this.azureOpenAIClient!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        // Temperature removed - some Azure OpenAI models only support default (1)
        max_completion_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from Azure OpenAI');
      }

      const parsedResult = JSON.parse(content);
      const bugDetails = this.validateAndNormalizeBugDetails(parsedResult);

      logger.info('AI analysis complete', { title: bugDetails.title });
      return bugDetails;
    } catch (error: any) {
      logger.error('Azure OpenAI API error', {
        status: error.status,
        statusText: error.statusText,
        code: error.code,
        type: error.type,
        message: error.message,
        endpoint: this.azureOpenAIClient?.baseURL,
        deployment: this.model,
      });
      throw error;
    }
  }

  private buildSystemPrompt(): string {
    return this.bugUnderstandingPrompt;
  }

  private buildUserPrompt(messageText: string, conversationContext?: string): string {
    // Clean the message text before analysis
    const cleanedMessage = this.cleanMessageText(messageText);

    let prompt = `Analyze the following message and extract bug information.

IMPORTANT INSTRUCTIONS:
- The user message may contain command phrases like "raise a bug", "create a bug" - these are NOT part of the bug description
- Remove any leading punctuation (dashes, colons, etc.) from your generated title
- Create a professional, actionable title that summarizes the core issue
- Do NOT copy the user's message verbatim as the title - summarize and professionalize it

User Message:
"""
${cleanedMessage}
"""`;

    if (conversationContext) {
      prompt += `\n\nAdditional context from conversation:\n${conversationContext}`;
    }

    prompt += `\n\nReturn only valid JSON with the bug details.`;

    return prompt;
  }

  private cleanMessageText(messageText: string): string {
    let cleaned = messageText;

    // Remove common command patterns that might remain
    cleaned = cleaned.replace(/^.*?(raise|create|report|log)\s+a?\s*bug\s*[-:]\s*/i, '');

    // Remove leading/trailing dashes, colons, and whitespace
    cleaned = cleaned.replace(/^[-:\s]+/, '');
    cleaned = cleaned.replace(/[-:\s]+$/, '');

    // Clean up multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  private validateAndNormalizeBugDetails(parsed: any): BugDetails {
    const severityMap: { [key: string]: BugDetails['severity'] } = {
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };

    const severity =
      severityMap[parsed.severity?.toLowerCase()] || 'Medium';

    // Clean and normalize the title
    let title = parsed.title || 'Bug Report';
    title = this.cleanBugTitle(title);

    return {
      title,
      description: parsed.description || 'No description provided',
      reproSteps: parsed.reproSteps,
      expectedBehavior: parsed.expectedBehavior,
      actualBehavior: parsed.actualBehavior,
      severity,
      tags: parsed.tags || [],
    };
  }

  private cleanBugTitle(title: string): string {
    let cleaned = title;

    // Remove leading punctuation and whitespace
    cleaned = cleaned.replace(/^[-•:*\s]+/, '');

    // Remove trailing punctuation and whitespace
    cleaned = cleaned.replace(/[-:*\s]+$/, '');

    // Capitalize first letter if not already
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    // Ensure title is not too long (max 100 characters)
    if (cleaned.length > 100) {
      cleaned = cleaned.substring(0, 97) + '...';
    }

    return cleaned.trim();
  }

  private fallbackParsing(messageText: string): BugDetails {
    logger.warn('Using fallback parsing for bug details');

    // Simple fallback: use message as title if short, otherwise extract first sentence
    const lines = messageText.split('\n').filter((line) => line.trim());
    const title =
      messageText.length <= 100
        ? messageText
        : lines[0]?.substring(0, 100) || 'Bug Report';

    return {
      title: title.trim(),
      description: messageText,
      severity: 'Medium',
    };
  }
}
