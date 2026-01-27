import { Attachment, CardFactory } from 'botbuilder';
import { BugDetails, ADOConfig } from '../types';

export class AdaptiveCardBuilder {
  public static buildBugPreviewCard(
    bugDetails: BugDetails,
    adoConfig: ADOConfig,
    originalMessage: string,
    areaPaths: string[],
    iterationPaths: string[]
  ): Attachment {
    const card = {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: '🐛 Bug Preview',
          weight: 'bolder',
          size: 'large',
          color: 'accent',
        },
        {
          type: 'TextBlock',
          text: 'Review and edit the bug details before creating:',
          wrap: true,
          spacing: 'small',
        },
        {
          type: 'Input.Text',
          id: 'title',
          label: 'Bug Title',
          isRequired: true,
          value: bugDetails.title,
          maxLength: 255,
        },
        {
          type: 'Input.ChoiceSet',
          id: 'areaPath',
          label: 'Area Path',
          value: bugDetails.areaPath || adoConfig.areaPath || (areaPaths.length > 0 ? areaPaths[0] : ''),
          choices: areaPaths.map(path => ({ title: path, value: path })),
          style: 'compact',
        },
        {
          type: 'Input.ChoiceSet',
          id: 'iterationPath',
          label: 'Iteration Path',
          value: bugDetails.iterationPath || adoConfig.iterationPath || (iterationPaths.length > 0 ? iterationPaths[0] : ''),
          choices: iterationPaths.map(path => ({ title: path, value: path })),
          style: 'compact',
        },
        {
          type: 'Input.ChoiceSet',
          id: 'severity',
          label: 'Severity',
          value: bugDetails.severity,
          isRequired: true,
          choices: [
            { title: '1 - Critical', value: 'Critical' },
            { title: '2 - High', value: 'High' },
            { title: '3 - Medium', value: 'Medium' },
            { title: '4 - Low', value: 'Low' },
          ],
        },
        {
          type: 'Input.Text',
          id: 'tags',
          label: 'Tags (comma-separated)',
          value: bugDetails.tags?.join(', ') || '',
          placeholder: 'e.g., login, mobile, UI',
        },
        {
          type: 'TextBlock',
          text: 'Details',
          weight: 'bolder',
          spacing: 'medium',
        },
        {
          type: 'Container',
          style: 'emphasis',
          items: [
            {
              type: 'TextBlock',
              text: `**Original Message:**\n"${originalMessage}"`,
              wrap: true,
              spacing: 'small',
            },
          ],
        },
        {
          type: 'Input.Text',
          id: 'description',
          label: 'Description',
          isMultiline: true,
          value: bugDetails.description,
          maxLength: 4000,
        },
        {
          type: 'Input.Text',
          id: 'reproSteps',
          label: 'Reproduction Steps (optional)',
          isMultiline: true,
          value: bugDetails.reproSteps || '',
          placeholder: '1. Step one\n2. Step two\n3. Step three',
        },
      ],
      actions: [
        {
          type: 'Action.Submit',
          title: '✅ Create Bug',
          style: 'positive',
          data: {
            action: 'createBug',
          },
        },
        {
          type: 'Action.Submit',
          title: '❌ Cancel',
          data: {
            action: 'cancel',
          },
        },
      ],
    };

    return CardFactory.adaptiveCard(card);
  }

  public static buildConfirmationCard(
    bugTitle: string,
    bugUrl: string,
    bugId: number
  ): Attachment {
    const card = {
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
          type: 'FactSet',
          facts: [
            {
              title: 'Bug ID:',
              value: `#${bugId}`,
            },
            {
              title: 'Title:',
              value: bugTitle,
            },
          ],
        },
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'View in Azure DevOps',
          url: bugUrl,
        },
      ],
    };

    return CardFactory.adaptiveCard(card);
  }
}
