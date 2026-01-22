import { ActivityHandler, TurnContext, MessageFactory } from 'botbuilder';
import { AppConfig } from '../types';
import { MessageParser } from './messageParser';
import { AIService } from '../services/aiService';
import { ADOService } from '../services/adoService';
import { logger } from '../utils/logger';

export class BugRaiserBot extends ActivityHandler {
  private messageParser: MessageParser;
  private aiService: AIService;
  private adoService: ADOService;
  private botId: string;

  constructor(config: AppConfig) {
    super();

    this.botId = config.bot.appId;
    this.messageParser = new MessageParser();
    this.aiService = new AIService(config.ai);
    this.adoService = new ADOService(config.ado);

    // Handle messages
    this.onMessage(async (context, next) => {
      await this.handleMessage(context);
      await next();
    });

    // Handle member added (when bot joins conversation)
    this.onMembersAdded(async (context, next) => {
      await this.handleMemberAdded(context);
      await next();
    });
  }

  private async handleMessage(context: TurnContext): Promise<void> {
    try {
      const activity = context.activity;

      logger.info('Received message', {
        type: activity.type,
        text: activity.text?.substring(0, 100),
        hasReplyToId: !!activity.replyToId,
      });

      // Parse the message for commands
      const parseResult = this.messageParser.parseCommand(activity, this.botId);

      if (!parseResult.isCommand) {
        logger.debug('Not a command, ignoring');
        return;
      }

      logger.info('Command detected', { commandType: parseResult.commandType });

      // Extract context from replied message
      let messageContext = '';

      if (parseResult.repliedMessageId) {
        // In Teams, we need to fetch the replied message
        // Unfortunately, Bot Framework doesn't provide direct access to replied messages
        // We'll need to extract it from the conversation history or use the text directly
        messageContext = await this.extractRepliedMessageContext(context);
      }

      // If no replied message, use the command message itself (remove the command part)
      if (!messageContext && activity.text) {
        const cleanText = activity.text.replace(/<at>.*?<\/at>/g, '').trim();
        const commandPattern = /(raise|create|report|log)\s+a?\s*bug/i;
        messageContext = cleanText.replace(commandPattern, '').trim();
      }

      if (!messageContext) {
        await context.sendActivity(
          MessageFactory.text(
            '⚠️ Please reply to a message containing bug details, or provide bug information in your message.'
          )
        );
        return;
      }

      logger.info('Processing bug report', { contextLength: messageContext.length });

      // Show typing indicator
      await context.sendActivity({ type: 'typing' });

      // Step 1: Analyze with AI
      const bugDetails = await this.aiService.analyzeBugContext(messageContext);

      logger.info('Bug details extracted', { title: bugDetails.title });

      // Step 2: Create bug in ADO
      const bugUrl = await this.adoService.createBug(bugDetails);

      // Step 3: Send confirmation
      const confirmationMessage = this.buildConfirmationMessage(
        bugDetails.title,
        bugUrl
      );

      await context.sendActivity(MessageFactory.text(confirmationMessage));

      logger.info('Bug created and notification sent', { bugUrl });
    } catch (error) {
      logger.error('Error handling message', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      await context.sendActivity(
        MessageFactory.text(
          `❌ Failed to create bug: ${errorMessage}\n\nPlease check the configuration and try again.`
        )
      );
    }
  }

  private async extractRepliedMessageContext(
    context: TurnContext
  ): Promise<string> {
    try {
      // Try to get replied message from conversation
      // Note: This is a simplified approach. In production, you might need to
      // implement more robust message fetching using Teams API

      // Check if there's a replyToId in the activity
      const replyToId = context.activity.replyToId;

      if (!replyToId) {
        return '';
      }

      // In Teams, the replied message text might be available in entities
      if (context.activity.entities) {
        for (const entity of context.activity.entities) {
          if (entity.type === 'messageBack' && entity.text) {
            return entity.text;
          }
        }
      }

      // If we can't get the replied message directly, we'll need to use
      // Microsoft Graph API or Teams API to fetch it
      // For now, return empty and let the user provide context in their message
      logger.warn('Could not extract replied message context directly');
      return '';
    } catch (error) {
      logger.error('Error extracting replied message context', error);
      return '';
    }
  }

  private buildConfirmationMessage(bugTitle: string, bugUrl: string): string {
    return `✅ **Bug Created Successfully!**\n\n**Title:** ${bugTitle}\n\n**View Bug:** [Click here to open in Azure DevOps](${bugUrl})\n\nYou can now review and update the bug details in ADO.`;
  }

  private async handleMemberAdded(context: TurnContext): Promise<void> {
    const membersAdded = context.activity.membersAdded || [];

    for (const member of membersAdded) {
      if (member.id !== context.activity.recipient.id) {
        const welcomeMessage = this.buildWelcomeMessage();
        await context.sendActivity(MessageFactory.text(welcomeMessage));
      }
    }
  }

  private buildWelcomeMessage(): string {
    return `👋 **Welcome to Bug Raiser Bot!**

I help you create Azure DevOps bugs automatically by analyzing conversation context.

**How to use:**
1. Reply to any message containing bug details
2. Type: \`@bug raiser raise a bug\`
3. I'll analyze the context and create a bug in ADO
4. You'll receive a link to review the bug

**Example commands:**
- \`@bug raiser raise a bug\`
- \`@bug raiser create a bug\`
- \`@bug raiser report a bug\`

Let me know if you need any help!`;
  }
}
