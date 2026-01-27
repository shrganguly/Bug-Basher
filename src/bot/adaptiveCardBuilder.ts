import { Attachment, CardFactory } from 'botbuilder';
import { BugDetails, ADOConfig, UserConfig } from '../types';

export class AdaptiveCardBuilder {
  public static buildBugPreviewCard(
    bugDetails: BugDetails,
    adoConfig: ADOConfig
  ): Attachment {
    const cardBody: any[] = [
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
    ];

    // Use text inputs with smart defaults to avoid card size issues
    // Adaptive Cards don't support dynamic search or cascading dropdowns
    cardBody.push(
      {
        type: 'Input.Text',
        id: 'areaPath',
        label: 'Area Path',
        value: bugDetails.areaPath || adoConfig.areaPath || '',
        placeholder: 'e.g., ODSP Product Experiences\\YourArea',
      },
      {
        type: 'Input.Text',
        id: 'iterationPath',
        label: 'Iteration Path',
        value: bugDetails.iterationPath || adoConfig.iterationPath || '',
        placeholder: 'e.g., ODSP Product Experiences\\Sprint 1',
      }
    );

    // Add remaining fields
    cardBody.push(
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
        type: 'Input.Text',
        id: 'description',
        label: 'Description',
        isMultiline: true,
        value: bugDetails.description,
        maxLength: 4000,
      }
    );

    const card = {
      type: 'AdaptiveCard',
      version: '1.4',
      body: cardBody,
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

  public static buildSetupCard(currentConfig?: UserConfig): Attachment {
    const card = {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: '⚙️ Bug Basher Setup',
          weight: 'bolder',
          size: 'large',
        },
        {
          type: 'TextBlock',
          text: 'Configure your personal settings for creating bugs in Azure DevOps.',
          wrap: true,
          spacing: 'small',
        },
        {
          type: 'Input.Text',
          id: 'pat',
          label: 'Personal Access Token (PAT)',
          isRequired: true,
          style: 'Password',
          value: currentConfig?.pat || '',
          placeholder: 'Your Azure DevOps PAT',
        },
        {
          type: 'TextBlock',
          text: 'ℹ️ Create a PAT at: dev.azure.com → User Settings → Personal access tokens. Requires "Work Items: Read & Write" permission.',
          wrap: true,
          size: 'small',
          isSubtle: true,
          spacing: 'small',
        },
        {
          type: 'Input.Text',
          id: 'areaPath',
          label: 'Area Path',
          isRequired: true,
          value: currentConfig?.areaPath || '',
          placeholder: 'e.g., ODSP Product Experiences\\YourTeam',
        },
        {
          type: 'Input.Text',
          id: 'iterationPath',
          label: 'Iteration Path',
          isRequired: true,
          value: currentConfig?.iterationPath || '',
          placeholder: 'e.g., ODSP Product Experiences\\Sprint 42',
        },
      ],
      actions: [
        {
          type: 'Action.Submit',
          title: '💾 Save Configuration',
          style: 'positive',
          data: { action: 'saveConfig' },
        },
        {
          type: 'Action.Submit',
          title: '❌ Cancel',
          data: { action: 'cancel' },
        },
      ],
    };

    return CardFactory.adaptiveCard(card);
  }
}
