import Anthropic from '@anthropic-ai/sdk';
import { AzureOpenAI } from 'openai';
import { AIConfig, BugDetails } from '../types';
import { logger } from '../utils/logger';

export class AIService {
  private claudeClient?: Anthropic;
  private azureOpenAIClient?: AzureOpenAI;
  private provider: 'claude' | 'azure-openai';
  private model: string;

  constructor(config: AIConfig) {
    this.provider = config.provider;

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
    } catch (error) {
      logger.error('AI analysis failed', error);
      // Fallback to basic parsing if AI fails
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
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(messageText, conversationContext);

    const response = await this.azureOpenAIClient!.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
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
  }

  private buildSystemPrompt(): string {
    return `You are a bug analysis assistant. Analyze user messages and extract bug information.

Your task:
1. Create a concise, professional bug title (max 80 characters) - SUMMARIZE, don't copy verbatim. Use technical, actionable language.
2. Write a detailed description - Start with "Original message: " followed by the user's message in quotes, then add your analysis
3. Identify reproduction steps if mentioned
4. Determine expected vs actual behavior
5. Assess severity level: Critical, High, Medium, or Low
6. Suggest 3-5 relevant tags (keywords like "login", "mobile", "UI", "performance", etc.)

Title examples:
- Good: "Login button unresponsive on mobile Safari"
- Bad: "Login button is not working" (too generic, not summarized)

Severity guidelines:
- Critical: System crash, data loss, security vulnerability
- High: Major feature broken, blocks user workflow
- Medium: Feature partially broken, workaround exists
- Low: Minor issue, cosmetic problem, enhancement

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "title": "Concise summarized title",
  "description": "Detailed description",
  "reproSteps": "1. Step one\\n2. Step two\\n3. Step three",
  "expectedBehavior": "What should happen",
  "actualBehavior": "What actually happens",
  "severity": "High",
  "tags": ["tag1", "tag2", "tag3"]
}

If information is not explicitly provided, make reasonable inferences from context.`;
  }

  private buildUserPrompt(messageText: string, conversationContext?: string): string {
    let prompt = `Analyze this bug report:\n\n${messageText}`;

    if (conversationContext) {
      prompt += `\n\nAdditional context from conversation:\n${conversationContext}`;
    }

    return prompt;
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

    return {
      title: parsed.title || 'Bug Report',
      description: parsed.description || 'No description provided',
      reproSteps: parsed.reproSteps,
      expectedBehavior: parsed.expectedBehavior,
      actualBehavior: parsed.actualBehavior,
      severity,
      tags: parsed.tags || [],
    };
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
