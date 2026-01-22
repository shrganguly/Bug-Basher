import Anthropic from '@anthropic-ai/sdk';
import { AIConfig, BugDetails } from '../types';
import { logger } from '../utils/logger';

export class AIService {
  private claudeClient?: Anthropic;
  private model: string;

  constructor(config: AIConfig) {
    if (config.provider === 'claude') {
      this.claudeClient = new Anthropic({
        apiKey: config.apiKey,
      });
      this.model = config.model || 'claude-sonnet-4-20250514';
    } else {
      throw new Error('Only Claude provider is currently supported');
    }
  }

  public async analyzeBugContext(
    messageText: string,
    conversationContext?: string
  ): Promise<BugDetails> {
    try {
      logger.info('Analyzing bug context with AI', { messageLength: messageText.length });

      if (this.claudeClient) {
        return await this.analyzeWithClaude(messageText, conversationContext);
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

  private buildSystemPrompt(): string {
    return `You are a bug analysis assistant. Analyze user messages and extract bug information.

Your task:
1. Extract a concise, actionable bug title (max 100 characters)
2. Write a detailed description explaining the issue
3. Identify reproduction steps if mentioned
4. Determine expected vs actual behavior
5. Assess severity level: Critical, High, Medium, or Low

Severity guidelines:
- Critical: System crash, data loss, security vulnerability
- High: Major feature broken, blocks user workflow
- Medium: Feature partially broken, workaround exists
- Low: Minor issue, cosmetic problem, enhancement

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "title": "Bug title here",
  "description": "Detailed description",
  "reproSteps": "1. Step one\\n2. Step two\\n3. Step three",
  "expectedBehavior": "What should happen",
  "actualBehavior": "What actually happens",
  "severity": "High"
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
