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
    const isPersonalChat = activity.conversation?.conversationType === 'personal';
    const isBotMentioned = this.isBotMentioned(activity, botId);

    logger.info('Chat detection', {
      isPersonalChat,
      isBotMentioned,
      conversationType: activity.conversation?.conversationType
    });

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
            return true;
          }
        }
      }
    }

    // Fallback: Check if text contains @mention
    const text = activity.text || '';
    return text.includes(`<at>${botId}</at>`) || text.includes('@bug raiser');
  }

  private removeBotMentions(text: string, activity: Activity): string {
    let cleanText = text;

    // Remove XML-style mentions
    cleanText = cleanText.replace(/<at>.*?<\/at>/g, '').trim();

    // Remove entity mentions
    if (activity.entities) {
      for (const entity of activity.entities) {
        if (entity.type === 'mention' && entity.text) {
          cleanText = cleanText.replace(entity.text, '').trim();
        }
      }
    }

    return cleanText;
  }

  private detectBugCommand(
    text: string
  ): 'raise_bug' | 'create_bug' | 'report_bug' | undefined {
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
