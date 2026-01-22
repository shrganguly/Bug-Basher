import axios, { AxiosInstance } from 'axios';
import { ADOConfig, BugDetails, ADOWorkItem } from '../types';
import { logger } from '../utils/logger';

export class ADOService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(private config: ADOConfig) {
    this.baseUrl = `https://dev.azure.com/${config.organization}/${config.project}/_apis`;

    // Create axios instance with authentication
    const auth = Buffer.from(`:${config.pat}`).toString('base64');
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json-patch+json',
      },
    });
  }

  public async createBug(bugDetails: BugDetails): Promise<string> {
    try {
      logger.info('Creating bug in Azure DevOps', { title: bugDetails.title });

      const workItemUrl = `/wit/workitems/$Bug?api-version=7.0`;

      // Build JSON Patch document for creating work item
      const patchDocument = this.buildPatchDocument(bugDetails);

      const response = await this.client.post<ADOWorkItem>(
        workItemUrl,
        patchDocument
      );

      const workItem = response.data;
      const bugId = workItem.id;
      const bugUrl = `https://dev.azure.com/${this.config.organization}/${this.config.project}/_workitems/edit/${bugId}`;

      logger.info('Bug created successfully', { bugId, bugUrl });
      return bugUrl;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('ADO API error', {
          status: error.response?.status,
          data: error.response?.data,
        });
        throw new Error(
          `Failed to create bug: ${error.response?.data?.message || error.message}`
        );
      }
      logger.error('Failed to create bug', error);
      throw error;
    }
  }

  private buildPatchDocument(bugDetails: BugDetails): any[] {
    const patches = [
      {
        op: 'add',
        path: '/fields/System.Title',
        value: bugDetails.title,
      },
      {
        op: 'add',
        path: '/fields/System.Description',
        value: this.buildHtmlDescription(bugDetails),
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.Severity',
        value: this.mapSeverityToADO(bugDetails.severity),
      },
      {
        op: 'add',
        path: '/fields/System.Tags',
        value: 'Teams Bot; Auto-Created',
      },
    ];

    // Add optional fields if configured
    if (this.config.areaPath) {
      patches.push({
        op: 'add',
        path: '/fields/System.AreaPath',
        value: this.config.areaPath,
      });
    }

    if (this.config.iterationPath) {
      patches.push({
        op: 'add',
        path: '/fields/System.IterationPath',
        value: this.config.iterationPath,
      });
    }

    // Add repro steps if available
    if (bugDetails.reproSteps) {
      patches.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.TCM.ReproSteps',
        value: `<div>${this.escapeHtml(bugDetails.reproSteps)}</div>`,
      });
    }

    return patches;
  }

  private buildHtmlDescription(bugDetails: BugDetails): string {
    let html = `<div><p>${this.escapeHtml(bugDetails.description)}</p>`;

    if (bugDetails.expectedBehavior || bugDetails.actualBehavior) {
      html += '<br/><h3>Behavior</h3>';

      if (bugDetails.expectedBehavior) {
        html += `<p><strong>Expected:</strong> ${this.escapeHtml(bugDetails.expectedBehavior)}</p>`;
      }

      if (bugDetails.actualBehavior) {
        html += `<p><strong>Actual:</strong> ${this.escapeHtml(bugDetails.actualBehavior)}</p>`;
      }
    }

    if (bugDetails.reproSteps) {
      html += '<br/><h3>Reproduction Steps</h3>';
      html += `<p>${this.escapeHtml(bugDetails.reproSteps).replace(/\n/g, '<br/>')}</p>`;
    }

    html += '<br/><p><em>Created automatically by Teams Bug Raiser Bot</em></p></div>';

    return html;
  }

  private mapSeverityToADO(severity: BugDetails['severity']): string {
    const severityMap: { [key: string]: string } = {
      Critical: '1 - Critical',
      High: '2 - High',
      Medium: '3 - Medium',
      Low: '4 - Low',
    };

    return severityMap[severity] || '3 - Medium';
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}
