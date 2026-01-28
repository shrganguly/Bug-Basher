import { ActivityHandler, TurnContext, MessageFactory, StatePropertyAccessor, ConversationState, UserState } from 'botbuilder';
import { AppConfig, ADOConfig, UserConfig } from '../types';
import { MessageParser } from './messageParser';
import { AIService } from '../services/aiService';
import { ADOService } from '../services/adoService';
import { AdaptiveCardBuilder } from './adaptiveCardBuilder';
import { logger } from '../utils/logger';
import { encryptionService } from '../utils/encryption';

export class BugRaiserBot extends ActivityHandler {
  private messageParser: MessageParser;
  private aiService: AIService;
  private adoService: ADOService;
  private botId: string;
  private adoConfig: ADOConfig;
  private userConfigAccessor: StatePropertyAccessor<UserConfig>;
  private userState: UserState;

  constructor(config: AppConfig, _conversationState: ConversationState, userState: UserState) {
    super();

    this.botId = config.bot.appId;
    this.adoConfig = config.ado;
    this.userState = userState;

    // Create state accessor for user configuration
    this.userConfigAccessor = userState.createProperty<UserConfig>('userConfig');

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

      // Handle setup command
      if (parseResult.commandType === 'setup') {
        await this.handleSetupCommand(context);
        return;
      }

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
        // Extract the actual bug content from the message
        messageContext = this.extractBugContent(activity.text);

        logger.info('Extracted bug content', {
          original: activity.text?.substring(0, 100),
          extracted: messageContext.substring(0, 100)
        });

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

      // Check if user is configured and config is not expired
      const userConfig = await this.userConfigAccessor.get(context, { isConfigured: false });
      const configValidation = this.validateUserConfig(userConfig);

      if (!configValidation.isValid) {
        const conversationType = context.activity.conversation?.conversationType;
        const isPersonalChat = conversationType === 'personal';

        let setupMessage: string;
        if (configValidation.reason === 'expired') {
          setupMessage = isPersonalChat
            ? '⏰ Your Bug Basher configuration has expired (1 year).\n\n' +
              'Type `setup` to renew your configuration.'
            : '⏰ Your Bug Basher configuration has expired (1 year).\n\n' +
              '🔒 For security, setup must be done in a private chat. Please:\n' +
              '1. Open a direct message with me (Bug Basher)\n' +
              '2. Type `setup` to renew your configuration\n\n' +
              'Then return here to create bugs!';
        } else {
          setupMessage = isPersonalChat
            ? '⚠️ Please set up your Bug Basher configuration first.\n\n' +
              'Type `setup` to configure your Personal Access Token and default paths.'
            : '⚠️ Please set up your Bug Basher configuration first.\n\n' +
              '🔒 For security, setup must be done in a private chat. Please:\n' +
              '1. Open a direct message with me (Bug Basher)\n' +
              '2. Type `setup`\n' +
              '3. Configure your Personal Access Token and default paths\n\n' +
              'Then return here to create bugs!';
        }

        await context.sendActivity(MessageFactory.text(setupMessage));
        return;
      }

      logger.info('Processing bug report', { contextLength: messageContext.length });

      // Show typing indicator
      await context.sendActivity({ type: 'typing' });

      // Step 1: Analyze with AI
      const bugDetails = await this.aiService.analyzeBugContext(messageContext);

      logger.info('Bug details extracted', { title: bugDetails.title });

      // Step 2: Use user's configured paths as defaults
      bugDetails.areaPath = bugDetails.areaPath || userConfig.areaPath || this.adoConfig.areaPath;
      bugDetails.iterationPath = bugDetails.iterationPath || userConfig.iterationPath || this.adoConfig.iterationPath;

      // Step 3: Show preview card for user to review and edit
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
          MessageFactory.text('❌ Cancelled.')
        );
        return;
      }

      // Handle save config action
      if (submittedData.action === 'saveConfig') {
        // Security check: Ensure config is only saved in 1:1 chats
        const conversationType = context.activity.conversation?.conversationType;
        const isPersonalChat = conversationType === 'personal';

        if (!isPersonalChat) {
          await context.sendActivity(
            MessageFactory.text(
              '🔒 **Security Error**: Configuration can only be saved in a private 1:1 chat.\n\n' +
              'Please open a direct message with me and run setup there.'
            )
          );
          logger.warn('Blocked saveConfig attempt in non-personal chat', {
            userId: context.activity.from.id,
            conversationType,
          });
          return;
        }

        // Validate PAT is provided
        if (!submittedData.pat || submittedData.pat.trim().length === 0) {
          await context.sendActivity(
            MessageFactory.text('❌ Personal Access Token is required. Please try again.')
          );
          return;
        }

        // Encrypt the PAT token before storing
        const encryptedPat = encryptionService.encrypt(submittedData.pat);

        // Set expiration to 1 year from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 365);

        const newConfig: UserConfig = {
          pat: encryptedPat, // ✅ Store encrypted PAT
          areaPath: submittedData.areaPath,
          iterationPath: submittedData.iterationPath,
          isConfigured: true,
          configuredAt: new Date(),
          expiresAt: expiresAt, // ✅ Config expires in 1 year
        };

        await this.userConfigAccessor.set(context, newConfig);
        await this.userState.saveChanges(context);

        logger.info('User configuration saved (PAT encrypted)', {
          userId: context.activity.from.id,
          expiresAt: expiresAt.toISOString(),
        });

        await context.sendActivity(
          MessageFactory.text(
            `✅ Configuration saved successfully!\n\n` +
            `Your settings:\n` +
            `- Area Path: ${newConfig.areaPath}\n` +
            `- Iteration Path: ${newConfig.iterationPath}\n` +
            `- Valid for: 1 year (expires ${expiresAt.toLocaleDateString()})\n\n` +
            `🔒 Your PAT token is encrypted and stored securely.\n\n` +
            `You can now use "raise a bug" to create bugs!`
          )
        );
        return;
      }

      // Handle create bug action
      if (submittedData.action === 'createBug') {
        // Show typing indicator
        await context.sendActivity({ type: 'typing' });

        // Get user's configuration
        const userConfig = await this.userConfigAccessor.get(context, { isConfigured: false });

        // Validate config and decrypt PAT
        const configValidation = this.validateUserConfig(userConfig);
        if (!configValidation.isValid) {
          await context.sendActivity(
            MessageFactory.text(
              '⏰ Your configuration has expired. Please run `setup` again to renew.'
            )
          );
          return;
        }

        // Decrypt PAT token for use
        let decryptedPat: string;
        try {
          decryptedPat = encryptionService.decrypt(userConfig.pat!);
        } catch (error) {
          logger.error('Failed to decrypt PAT token', error);
          await context.sendActivity(
            MessageFactory.text(
              '❌ Error decrypting credentials. Please run `setup` again to reconfigure.'
            )
          );
          return;
        }

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

        // Create bug in ADO using decrypted PAT
        const { bugUrl, bugId } = await this.adoService.createBug(bugDetails, decryptedPat);

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

  private async handleSetupCommand(context: TurnContext): Promise<void> {
    try {
      // Security check: Setup should only be done in 1:1 chats to protect PAT credentials
      const conversationType = context.activity.conversation?.conversationType;
      const isPersonalChat = conversationType === 'personal';

      if (!isPersonalChat) {
        await context.sendActivity(
          MessageFactory.text(
            '🔒 **Security Notice**: For your protection, setup must be done in a private 1:1 chat.\n\n' +
            'Please open a direct message with me and type `setup` there to configure your Personal Access Token securely.'
          )
        );
        logger.info('Setup command blocked in non-personal chat', {
          userId: context.activity.from.id,
          conversationType,
        });
        return;
      }

      // Get current user configuration
      const userConfig = await this.userConfigAccessor.get(context, {
        isConfigured: false,
      });

      // Show setup card
      const setupCard = AdaptiveCardBuilder.buildSetupCard(userConfig);
      await context.sendActivity(MessageFactory.attachment(setupCard));

      logger.info('Setup card sent to user', {
        userId: context.activity.from.id,
        isConfigured: userConfig.isConfigured,
      });
    } catch (error) {
      logger.error('Error handling setup command', error);
      await context.sendActivity(
        MessageFactory.text('❌ Failed to show setup card. Please try again.')
      );
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
    return `👋 **Welcome to Bug Basher!**

I help you create Azure DevOps bugs automatically by analyzing conversation context.

**First Time Setup (Required):**
1. In this 1:1 chat, type: \`setup\`
2. Configure your Personal Access Token and default paths
3. Your settings are stored securely and privately

**Creating Bugs:**
- **In 1:1 chat**: Type \`raise a bug\`, \`create a bug\`, or \`report a bug\`
- **In group chats**: Use \`@bug basher raise a bug\` (@ mention required)

**How it works:**
1. Reply to a message containing bug details
2. Use a bug command
3. Review and edit the bug preview
4. Submit to create in Azure DevOps

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

  /**
   * Validate user configuration - check if configured and not expired
   */
  private validateUserConfig(userConfig: UserConfig): { isValid: boolean; reason?: string } {
    // Check if user has configured
    if (!userConfig.isConfigured) {
      return { isValid: false, reason: 'not_configured' };
    }

    // Check if PAT token exists
    if (!userConfig.pat) {
      return { isValid: false, reason: 'no_pat' };
    }

    // Check if config has expired (1 year)
    if (userConfig.expiresAt) {
      const now = new Date();
      const expiresAt = new Date(userConfig.expiresAt);

      if (now > expiresAt) {
        logger.info('User configuration expired', {
          expiresAt: expiresAt.toISOString(),
          now: now.toISOString(),
        });
        return { isValid: false, reason: 'expired' };
      }
    }

    return { isValid: true };
  }

  private extractBugContent(rawText: string): string {
    // Step 1: Remove @ mentions (XML tags from Teams)
    let text = rawText.replace(/<at>.*?<\/at>/g, '').trim();

    // Step 2: Find where the command ends
    // Look for patterns like "raise a bug", "create a bug", etc.
    const commandMatch = text.match(/(raise|create|report|log)\s+a?\s*bug/i);

    if (commandMatch) {
      // Get the position where the command ends
      const commandEndIndex = commandMatch.index! + commandMatch[0].length;

      // Extract everything after the command
      text = text.substring(commandEndIndex).trim();
    }

    // Step 3: Remove any leading separators (-, :, |, etc.)
    text = text.replace(/^[-:•*|\s]+/, '').trim();

    // Step 4: If the text still has bot name or other prefix, try to extract after separator
    // Pattern: "Something separator content" → extract "content"
    const separatorMatch = text.match(/^[^-:|\n]*[-:|\n]\s*(.*)/);
    if (separatorMatch && separatorMatch[1]) {
      text = separatorMatch[1].trim();
    }

    return text;
  }
}
