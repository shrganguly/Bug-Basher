# Teams Bug Raiser Agent

An intelligent Microsoft Teams bot that automatically creates Azure DevOps bugs by analyzing conversation context using AI.

## Features

- **@mention Bot**: Simply reply to a message and type `@bug raiser raise a bug`
- **AI-Powered Context Analysis**: Uses Azure OpenAI to intelligently extract bug title, description, and details
- **Automatic Bug Creation**: Creates bugs in Azure DevOps with proper formatting
- **Instant Feedback**: Returns clickable ADO bug links for review

## User Workflow

1. Someone posts a message describing a bug in Teams
2. Reply to that message with: `@bug raiser raise a bug`
3. The bot analyzes the context using AI
4. The bot creates a bug in your ADO board
5. The bot responds with a link to the created bug

## Architecture

- **Runtime**: Node.js 16+ with TypeScript
- **Framework**: Express.js + Bot Framework SDK v4
- **AI Integration**: Azure OpenAI API
- **ADO Integration**: Azure DevOps REST API

## Prerequisites

- Node.js 16+
- Azure Bot Service app registration
- Azure OpenAI deployment
- Azure DevOps Personal Access Token (PAT)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.template` to `.env` and fill in your credentials:

```bash
cp .env.template .env
```

Required variables:
- `MICROSOFT_APP_ID` - Bot Framework app ID
- `MICROSOFT_APP_PASSWORD` - Bot Framework app password
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint URL
- `AZURE_OPENAI_API_KEY` - Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT_NAME` - Your GPT deployment name
- `ADO_ORGANIZATION` - Azure DevOps organization name
- `ADO_PROJECT` - Azure DevOps project name
- `ADO_PAT` - Personal Access Token with Work Items: Read, Write permissions

### 3. Build the Project

```bash
npm run build
```

### 4. Run Locally

```bash
npm run dev
```

### 5. Test with ngrok

```bash
ngrok http 3000
```

Update your Bot Framework messaging endpoint to: `https://your-ngrok-url.ngrok.io/api/messages`

## Deployment

### Azure App Service

```bash
# Deploy to Azure (requires Azure CLI)
az webapp up --name teams-bug-raiser --resource-group your-rg
```

### Render.com

1. Connect your GitHub repository
2. Configure environment variables in Render dashboard
3. Deploy automatically on push

## Teams App Installation

1. Navigate to `appPackage/` directory
2. Update `manifest.json` with your Bot ID and domain
3. Create a ZIP file containing:
   - `manifest.json`
   - `color.png`
   - `outline.png`
4. Upload to Teams (Admin Center or sideload)

## Usage Examples

**Simple Bug Report**:
```
User: The login button doesn't work on mobile
@bug raiser raise a bug
→ Bot creates: "Login button not working on mobile"
```

**Detailed Bug Report**:
```
User: When I click submit on the payment form, it shows error 500.
      This happens every time I try to pay with credit card.
@bug raiser raise a bug
→ Bot creates comprehensive bug with repro steps
```

## Project Structure

```
TeamsBugRaiser/
├── src/
│   ├── server.ts              # Express server + Bot Framework
│   ├── bot/
│   │   ├── bugRaiserBot.ts   # Main bot logic
│   │   └── messageParser.ts  # Command parsing
│   ├── services/
│   │   ├── aiService.ts      # Azure OpenAI integration
│   │   └── adoService.ts     # Azure DevOps API
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces
│   └── utils/
│       ├── config.ts         # Configuration
│       └── logger.ts         # Logging
├── appPackage/
│   ├── manifest.json         # Teams manifest
│   └── *.png                 # App icons
└── package.json
```

## Security Considerations

- Never commit `.env` file to version control
- Use scoped ADO PAT with minimal permissions
- Validate all Teams activities before processing
- Sanitize user input before sending to AI/ADO
- Implement rate limiting for production

## Troubleshooting

**Bot doesn't respond**:
- Check Bot Framework messaging endpoint is correct
- Verify app ID and password are correct
- Check bot is added to the Teams conversation

**Bug creation fails**:
- Verify ADO PAT has correct permissions
- Check ADO organization and project names
- Ensure AreaPath and IterationPath exist

**AI analysis errors**:
- Verify Azure OpenAI endpoint and API key
- Check deployment name matches your Azure OpenAI deployment
- Ensure API version is supported

## License

MIT
