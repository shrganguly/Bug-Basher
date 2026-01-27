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

  public async createBug(bugDetails: BugDetails): Promise<{ bugUrl: string; bugId: number }> {
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
      const encodedProject = encodeURIComponent(this.config.project);
      const bugUrl = `https://dev.azure.com/${this.config.organization}/${encodedProject}/_workitems/edit/${bugId}`;

      logger.info('Bug created successfully', { bugId, bugUrl });
      return { bugUrl, bugId };
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
    ];

    // Add tags (combine user tags with auto-created tag)
    const userTags = bugDetails.tags?.filter(t => t).join('; ') || '';
    const allTags = userTags ? `${userTags}; Teams Bot; Auto-Created` : 'Teams Bot; Auto-Created';
    patches.push({
      op: 'add',
      path: '/fields/System.Tags',
      value: allTags,
    });

    // Add optional fields from bugDetails or config
    const areaPath = bugDetails.areaPath || this.config.areaPath;
    if (areaPath) {
      patches.push({
        op: 'add',
        path: '/fields/System.AreaPath',
        value: areaPath,
      });
    }

    const iterationPath = bugDetails.iterationPath || this.config.iterationPath;
    if (iterationPath) {
      patches.push({
        op: 'add',
        path: '/fields/System.IterationPath',
        value: iterationPath,
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

  public async getAreaPaths(): Promise<string[]> {
    try {
      logger.info('Fetching area paths from ADO');

      const response = await this.client.get(
        `/wit/classificationnodes/areas?$depth=10&api-version=7.0`
      );

      const paths = this.flattenClassificationNodes(response.data, 'area');
      logger.info('Area paths fetched', { count: paths.length });
      return paths;
    } catch (error) {
      logger.error('Failed to fetch area paths', error);
      // Return default if fetch fails
      return this.config.areaPath ? [this.config.areaPath] : [];
    }
  }

  public async getIterationPaths(): Promise<string[]> {
    try {
      logger.info('Fetching iteration paths from ADO');

      const response = await this.client.get(
        `/wit/classificationnodes/iterations?$depth=10&api-version=7.0`
      );

      const paths = this.flattenClassificationNodes(response.data, 'iteration');
      logger.info('Iteration paths fetched', { count: paths.length });
      return paths;
    } catch (error) {
      logger.error('Failed to fetch iteration paths', error);
      // Return default if fetch fails
      return this.config.iterationPath ? [this.config.iterationPath] : [];
    }
  }

  private flattenClassificationNodes(
    node: any,
    type: 'area' | 'iteration',
    parentPath = ''
  ): string[] {
    const paths: string[] = [];

    // Build current path
    const currentPath = parentPath
      ? `${parentPath}\\${node.name}`
      : node.name;

    // Add current path if it's not the root project node
    if (parentPath) {
      paths.push(currentPath);
    }

    // Recursively process children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        paths.push(...this.flattenClassificationNodes(child, type, currentPath));
      }
    }

    return paths;
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
