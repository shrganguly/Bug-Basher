import axios, { AxiosInstance } from 'axios';
import { ADOConfig, BugDetails, ADOWorkItem, ImageAttachment } from '../types';
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

  public async createBug(bugDetails: BugDetails, userPat?: string): Promise<{ bugUrl: string; bugId: number }> {
    try {
      logger.info('Creating bug in Azure DevOps', { title: bugDetails.title });

      // Step 1: Upload images FIRST to get their URLs (if any)
      let imageUrls: { name: string; url: string }[] = [];
      if (bugDetails.imageAttachments && bugDetails.imageAttachments.length > 0) {
        logger.info('Pre-uploading image attachments to get URLs', {
          count: bugDetails.imageAttachments.length,
          imageNames: bugDetails.imageAttachments.map(img => img.name),
        });
        imageUrls = await this.uploadImagesAndGetUrls(bugDetails.imageAttachments, userPat);
        logger.info('Images uploaded, URLs obtained', { count: imageUrls.length });
      }

      // Step 2: Build JSON Patch document with embedded images
      const patchDocument = this.buildPatchDocument(bugDetails, imageUrls);

      // Use user's PAT if provided, otherwise use default client
      const client = userPat ? this.createClientWithPAT(userPat) : this.client;

      const workItemUrl = `/wit/workitems/$Bug?api-version=7.0`;
      const response = await client.post<ADOWorkItem>(
        workItemUrl,
        patchDocument
      );

      const workItem = response.data;
      const bugId = workItem.id;
      const encodedProject = encodeURIComponent(this.config.project);
      const bugUrl = `https://dev.azure.com/${this.config.organization}/${encodedProject}/_workitems/edit/${bugId}`;

      logger.info('Bug created successfully with embedded images', { bugId, bugUrl, imageCount: imageUrls.length });

      // Step 3: Link the attachments to the work item (for the Attachments tab)
      if (imageUrls.length > 0) {
        logger.info('Linking attachments to work item', { bugId, count: imageUrls.length });
        await this.linkAttachmentsToWorkItem(bugId, imageUrls, userPat);
        logger.info('All attachments linked successfully', { bugId });
      }

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

  private buildPatchDocument(bugDetails: BugDetails, imageUrls: { name: string; url: string }[] = []): any[] {
    const patches = [
      {
        op: 'add',
        path: '/fields/System.Title',
        value: bugDetails.title,
      },
      {
        op: 'add',
        path: '/fields/System.Description',
        value: this.buildHtmlDescription(bugDetails, imageUrls),
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.Severity',
        value: this.mapSeverityToADO(bugDetails.severity),
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.TCM.ReproSteps',
        value: this.buildHtmlReproSteps(bugDetails, imageUrls),
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

    return patches;
  }

  private buildHtmlDescription(bugDetails: BugDetails, imageUrls: { name: string; url: string }[] = []): string {
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

    // Add embedded images if present
    if (imageUrls.length > 0) {
      html += '<br/><h3>Screenshots</h3>';
      for (const image of imageUrls) {
        html += `<p><img src="${image.url}" alt="${this.escapeHtml(image.name)}" style="max-width: 100%; height: auto;" /></p>`;
      }
    }

    html += '<br/><p><em>Created automatically by Teams Bug Raiser Bot</em></p></div>';

    return html;
  }

  private buildHtmlReproSteps(bugDetails: BugDetails, imageUrls: { name: string; url: string }[] = []): string {
    let html = '<div>';

    // Add the main description
    html += `<h3>Description</h3><p>${this.escapeHtml(bugDetails.description)}</p>`;

    // Add reproduction steps if available
    if (bugDetails.reproSteps) {
      html += '<br/><h3>Steps to Reproduce</h3>';
      html += `<p>${this.escapeHtml(bugDetails.reproSteps).replace(/\n/g, '<br/>')}</p>`;
    }

    // Add expected vs actual behavior
    if (bugDetails.expectedBehavior || bugDetails.actualBehavior) {
      html += '<br/>';

      if (bugDetails.expectedBehavior) {
        html += `<h3>Expected Behavior</h3><p>${this.escapeHtml(bugDetails.expectedBehavior)}</p>`;
      }

      if (bugDetails.actualBehavior) {
        html += `<h3>Actual Behavior</h3><p>${this.escapeHtml(bugDetails.actualBehavior)}</p>`;
      }
    }

    // Add embedded images if present - at the end so they show up in Repro Steps
    if (imageUrls.length > 0) {
      html += '<br/><h3>Screenshots</h3>';
      for (const image of imageUrls) {
        html += `<div style="margin: 10px 0;"><img src="${image.url}" alt="${this.escapeHtml(image.name)}" style="max-width: 800px; height: auto; border: 1px solid #ddd;" /></div>`;
      }
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

  private createClientWithPAT(pat: string): AxiosInstance {
    const auth = Buffer.from(`:${pat}`).toString('base64');
    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json-patch+json',
      },
    });
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

  /**
   * Upload images and get their URLs for embedding in HTML
   */
  private async uploadImagesAndGetUrls(
    attachments: ImageAttachment[],
    userPat?: string
  ): Promise<{ name: string; url: string }[]> {
    const imageUrls: { name: string; url: string }[] = [];

    for (const attachment of attachments) {
      try {
        if (!attachment.content) {
          logger.warn('Skipping attachment without content', { name: attachment.name });
          continue;
        }

        // Upload the file to ADO attachments storage
        const attachmentUrl = await this.uploadAttachmentFile(attachment, userPat);

        imageUrls.push({
          name: attachment.name,
          url: attachmentUrl,
        });

        logger.info('Image uploaded and URL obtained', {
          fileName: attachment.name,
          url: attachmentUrl,
        });
      } catch (error) {
        logger.error('Failed to upload image', {
          fileName: attachment.name,
          error,
        });
        // Continue with other images even if one fails
      }
    }

    return imageUrls;
  }

  /**
   * Link uploaded attachments to work item (for Attachments tab)
   */
  private async linkAttachmentsToWorkItem(
    workItemId: number,
    imageUrls: { name: string; url: string }[],
    userPat?: string
  ): Promise<void> {
    for (const image of imageUrls) {
      try {
        await this.linkAttachmentToWorkItem(workItemId, image.url, image.name, userPat);
        logger.info('Attachment linked to work item', { workItemId, fileName: image.name });
      } catch (error) {
        logger.error('Failed to link attachment to work item', {
          workItemId,
          fileName: image.name,
          error,
        });
        // Continue with other attachments even if one fails
      }
    }
  }

  /**
   * Upload attachment file to Azure DevOps and get attachment reference URL
   */
  private async uploadAttachmentFile(
    attachment: ImageAttachment,
    userPat?: string
  ): Promise<string> {
    try {
      const uploadUrl = `https://dev.azure.com/${this.config.organization}/${this.config.project}/_apis/wit/attachments?fileName=${encodeURIComponent(attachment.name)}&api-version=7.0`;

      // Create client with appropriate auth
      const auth = Buffer.from(`:${userPat || this.config.pat}`).toString('base64');
      const uploadClient = axios.create({
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/octet-stream',
        },
      });

      const response = await uploadClient.post(uploadUrl, attachment.content);

      logger.info('Attachment file uploaded', {
        fileName: attachment.name,
        attachmentUrl: response.data.url,
      });

      return response.data.url;
    } catch (error) {
      logger.error('Failed to upload attachment file', {
        fileName: attachment.name,
        error,
      });
      throw error;
    }
  }

  /**
   * Link uploaded attachment to work item
   */
  private async linkAttachmentToWorkItem(
    workItemId: number,
    attachmentUrl: string,
    fileName: string,
    userPat?: string
  ): Promise<void> {
    try {
      const patchDocument = [
        {
          op: 'add',
          path: '/relations/-',
          value: {
            rel: 'AttachedFile',
            url: attachmentUrl,
            attributes: {
              comment: `Uploaded from Teams: ${fileName}`,
            },
          },
        },
      ];

      const client = userPat ? this.createClientWithPAT(userPat) : this.client;
      await client.patch(
        `/wit/workitems/${workItemId}?api-version=7.0`,
        patchDocument
      );

      logger.info('Attachment linked to work item', { workItemId, fileName });
    } catch (error) {
      logger.error('Failed to link attachment to work item', {
        workItemId,
        fileName,
        error,
      });
      throw error;
    }
  }
}
