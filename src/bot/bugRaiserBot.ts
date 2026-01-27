import { ActivityHandler, TurnContext, MessageFactory } from 'botbuilder';
import { AppConfig, ADOConfig } from '../types';
import { MessageParser } from './messageParser';
import { AIService } from '../services/aiService';
import { ADOService } from '../services/adoService';
import { AdaptiveCardBuilder } from './adaptiveCardBuilder';
import { logger } from '../utils/logger';

export class BugRaiserBot extends ActivityHandler {
  private messageParser: MessageParser;
  private aiService: AIService;
  private adoService: ADOService;
  private botId: string;
  private adoConfig: ADOConfig;

  constructor(config: AppConfig) {
    super();

    this.botId = config.bot.appId;
    this.adoConfig = config.ado;
    this.messageParser = new MessageParser();
    this.aiService = new AIService(config.ai);
    this.adoService = new ADOService(config.ado);

    // Handle messages
    this.onMessage(async (context, next) => {
      // Check if this is a card submission
      if (context.activity.value && context.activity.value.action) {
        await this.handleCardSubmission(context);
      } else {
        await this.handleMessage(context);
      }
      await next();
    });

    // Handle member added (when bot joins conversation)
    this.onMembersAdded(async (context, next) => {
      await this.handleMemberAdded(context);
      await next();
    });

  }

  // Override handleTeamsMessagingExtensionSubmitAction to handle message actions
  protected async handleTeamsMessagingExtensionSubmitAction(
    context: TurnContext,
    _action: any
  ): Promise<any> {
    return await this.handleMessageAction(context);
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
      logger.info('Parsing command with botId', { botId: this.botId });
      const parseResult = this.messageParser.parseCommand(activity, this.botId);

      logger.info('Parse result', {
        isCommand: parseResult.isCommand,
        commandType: parseResult.commandType,
        conversationType: activity.conversation?.conversationType
      });

      if (!parseResult.isCommand) {
        logger.info('Not a command, ignoring');
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

        // Remove quoted message author line (Teams includes "Author Name\r\nMessage content")
        // Split by line breaks and skip the first line if it looks like a name
        const lines = messageContext.split(/\r?\n/).filter(line => line.trim());
        if (lines.length > 1) {
          // If first line is short (< 50 chars) and looks like a name, skip it
          const firstLine = lines[0].trim();
          if (firstLine.length < 50 && !firstLine.includes('.') && !firstLine.includes('?')) {
            messageContext = lines.slice(1).join('\n').trim();
            logger.info('Removed author line from quoted message', {
              removedLine: firstLine,
              remainingContext: messageContext.substring(0, 100)
            });
          }
        }
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

      // Step 2: Show preview card for user to review and edit
      // Using text inputs for area/iteration to avoid card size limits
      const previewCard = AdaptiveCardBuilder.buildBugPreviewCard(
        bugDetails,
        this.adoConfig
      );

      await context.sendActivity(MessageFactory.attachment(previewCard));

      logger.info('Bug preview card sent to user');
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

  private async handleCardSubmission(context: TurnContext): Promise<void> {
    try {
      const submittedData = context.activity.value;

      logger.info('Card submission received', {
        action: submittedData.action,
      });

      // Handle cancel action
      if (submittedData.action === 'cancel') {
        await context.sendActivity(
          MessageFactory.text('❌ Bug creation cancelled.')
        );
        return;
      }

      // Handle create bug action
      if (submittedData.action === 'createBug') {
        // Show typing indicator
        await context.sendActivity({ type: 'typing' });

        // Extract submitted values
        const bugDetails = {
          title: submittedData.title,
          description: submittedData.description,
          reproSteps: submittedData.reproSteps,
          severity: submittedData.severity as 'Critical' | 'High' | 'Medium' | 'Low',
          tags: submittedData.tags
            ? submittedData.tags.split(',').map((t: string) => t.trim())
            : [],
          areaPath: submittedData.areaPath || this.adoConfig.areaPath,
          iterationPath: submittedData.iterationPath || this.adoConfig.iterationPath,
        };

        logger.info('Creating bug with submitted data', {
          title: bugDetails.title,
          severity: bugDetails.severity,
        });

        // Create bug in ADO
        const { bugUrl, bugId } = await this.adoService.createBug(bugDetails);

        // Send confirmation card
        const confirmationCard = AdaptiveCardBuilder.buildConfirmationCard(
          bugDetails.title,
          bugUrl,
          bugId
        );

        await context.sendActivity(MessageFactory.attachment(confirmationCard));

        logger.info('Bug created and confirmation sent', { bugId, bugUrl });
      }
    } catch (error) {
      logger.error('Error handling card submission', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      await context.sendActivity(
        MessageFactory.text(
          `❌ Failed to create bug: ${errorMessage}\n\nPlease check the values and try again.`
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

  private async handleMessageAction(context: TurnContext): Promise<any> {
    try {
      logger.info('Received message action');

      // Extract the message text from the action
      const messageText = context.activity.value?.messagePayload?.body?.content || '';

      if (!messageText) {
        return {
          status: 200,
          body: {
            composeExtension: {
              type: 'message',
              text: '⚠️ Could not extract message content. Please try again.',
            },
          },
        };
      }

      logger.info('Processing message action', { messageLength: messageText.length });

      // Analyze with AI
      const bugDetails = await this.aiService.analyzeBugContext(messageText);

      // Create bug in ADO
      const { bugUrl } = await this.adoService.createBug(bugDetails);

      // Return success response
      return {
        status: 200,
        body: {
          composeExtension: {
            type: 'result',
            attachmentLayout: 'list',
            attachments: [
              {
                contentType: 'application/vnd.microsoft.card.adaptive',
                content: {
                  type: 'AdaptiveCard',
                  version: '1.4',
                  body: [
                    {
                      type: 'TextBlock',
                      text: '✅ Bug Created Successfully!',
                      weight: 'bolder',
                      size: 'large',
                      color: 'good',
                    },
                    {
                      type: 'TextBlock',
                      text: bugDetails.title,
                      weight: 'bolder',
                      wrap: true,
                    },
                    {
                      type: 'TextBlock',
                      text: bugDetails.description,
                      wrap: true,
                      spacing: 'small',
                    },
                  ],
                  actions: [
                    {
                      type: 'Action.OpenUrl',
                      title: 'View in Azure DevOps',
                      url: bugUrl,
                    },
                  ],
                },
              },
            ],
          },
        },
      };
    } catch (error) {
      logger.error('Error handling message action', error);

      return {
        status: 200,
        body: {
          composeExtension: {
            type: 'message',
            text: `❌ Failed to create bug: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        },
      };
    }
  }
}
