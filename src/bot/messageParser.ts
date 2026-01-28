import { Activity, TurnContext } from 'botbuilder';
import { CommandParseResult } from '../types';
import { logger } from '../utils/logger';

export class MessageParser {
  private readonly bugCommandPatterns = [
    /raise\s+a?\s*bug/i,
    /create\s+a?\s*bug/i,
    /report\s+a?\s*bug/i,
    /log\s+a?\s*bug/i,
  ];

  public parseCommand(activity: Activity, botId: string): CommandParseResult {
    const result: CommandParseResult = {
      isCommand: false,
    };

    if (!activity.text) {
      logger.info('No text in activity');
      return result;
    }

    const text = activity.text.trim();

    // In personal (1:1) chats, process all messages
    // In group chats/channels, require bot mention
    // Note: Teams sometimes treats bot 1:1 chats as "groupChat", so we check for mentions
    const isPersonalChat = activity.conversation?.conversationType === 'personal';
    const isBotMentioned = this.isBotMentioned(activity, botId);

    logger.info('Chat detection', {
      isPersonalChat,
      isBotMentioned,
      conversationType: activity.conversation?.conversationType
    });

    // If bot is mentioned, always process (works in any chat type)
    // If personal chat, process without mention
    if (!isPersonalChat && !isBotMentioned) {
      logger.info('Not personal chat and bot not mentioned, skipping');
      return result;
    }

    // Remove bot mention from text for cleaner parsing
    const cleanText = this.removeBotMentions(text, activity);

    logger.info('Cleaned text for parsing', {
      originalText: text.substring(0, 100),
      cleanText: cleanText.substring(0, 100)
    });

    // Check for bug-related commands
    const commandType = this.detectBugCommand(cleanText);

    logger.info('Command detection result', { commandType });

    if (commandType) {
      result.isCommand = true;
      result.commandType = commandType;

      // Check if this is a reply to another message
      if (activity.replyToId) {
        result.repliedMessageId = activity.replyToId;
      }
    }

    logger.debug('Parsed command', result);
    return result;
  }

  public async getRepliedMessageText(
    _context: TurnContext,
    _messageId: string
  ): Promise<string | undefined> {
    try {
      // Note: Bot Framework doesn't provide direct access to replied messages
      // In production, you would need to:
      // 1. Use Microsoft Graph API to fetch the message
      // 2. Store message history in your database
      // 3. Use Teams-specific APIs through the connector

      // For now, we'll rely on the bot to extract context from the current message
      logger.warn('getRepliedMessageText not fully implemented');
      return undefined;
    } catch (error) {
      logger.error('Failed to fetch replied message', error);
      return undefined;
    }
  }

  private isBotMentioned(activity: Activity, botId: string): boolean {
    // Check entities for mentions
    if (activity.entities) {
      for (const entity of activity.entities) {
        if (entity.type === 'mention') {
          const mention = entity.mentioned;
          if (mention && mention.id === botId) {
            logger.info('Bot mentioned via entity ID match');
            return true;
          }
        }
      }
    }

    // Fallback: Check if text contains @mention tags (any name)
    const text = activity.text || '';
    const hasAtMention = text.includes('<at>') && text.includes('</at>');

    logger.info('Bot mention check', {
      hasAtMention,
      textPreview: text.substring(0, 100)
    });

    // If there's any @mention in the text, assume it's the bot since this is likely a bot conversation
    return hasAtMention || text.includes('@bug raiser') || text.includes('@bug basher');
  }

  private removeBotMentions(text: string, activity: Activity): string {
    let cleanText = text;

    // Remove XML-style mentions (multiple variations)
    cleanText = cleanText.replace(/<at>.*?<\/at>/gi, '');
    cleanText = cleanText.replace(/<at[^>]*>.*?<\/at>/gi, '');

    // Also remove common bot mention patterns
    cleanText = cleanText.replace(/@bug basher/gi, '');
    cleanText = cleanText.replace(/@bug raiser/gi, '');
    cleanText = cleanText.replace(/@speak easy/gi, '');

    // Remove entity mentions
    if (activity.entities) {
      for (const entity of activity.entities) {
        if (entity.type === 'mention' && entity.text) {
          cleanText = cleanText.replace(entity.text, '');
        }
      }
    }

    // Clean up extra whitespace
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    logger.info('After removing mentions', {
      before: text.substring(0, 50),
      after: cleanText.substring(0, 50)
    });

    return cleanText;
  }

  private detectBugCommand(
    text: string
  ): 'raise_bug' | 'create_bug' | 'report_bug' | 'setup' | undefined {
    // Check for setup command first (matches "setup", "set up", "configure", "config")
    if (/\b(set\s*up|setup|configure|config)\b/i.test(text)) {
      return 'setup';
    }

    // Check for bug commands
    for (const pattern of this.bugCommandPatterns) {
      if (pattern.test(text)) {
        const match = text.match(pattern);
        if (match) {
          const command = match[0].toLowerCase();
          if (command.includes('raise')) return 'raise_bug';
          if (command.includes('create')) return 'create_bug';
          if (command.includes('report')) return 'report_bug';
          if (command.includes('log')) return 'raise_bug';
        }
      }
    }
    return undefined;
  }
}
