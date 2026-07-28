# PaneTera Developer Guide

## Prerequisites

- Node.js 18+ and npm
- Git
- (Optional) Chrome for browser operator features

## Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd PaneTera

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORTAL_TOKEN` | Yes | Authentication token (change from default) |
| `OPENAI_API_KEY` | For agent | OpenAI API key for agent runtime |
| `ANTHROPIC_API_KEY` | Optional | Anthropic API key |
| `GOOGLE_API_KEY` | Optional | Google AI API key |
| `OLLAMA_BASE_URL` | Optional | Ollama server URL (default: http://localhost:11434) |
| `PORT` | No | Server port (default: 4000) |
| `LOG_LEVEL` | No | Logging level: debug, info, warn, error, fatal |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |

## Project Structure

```
PaneTera/
├── server/              # Backend
│   ├── agent/           # Agent runtime
│   ├── mcp/             # MCP integration
│   ├── rig/             # Rig governance
│   ├── middleware/       # Express middleware
│   ├── logging/         # Logger and metrics
│   └── index.ts         # Main server
├── src/                 # Frontend (React)
│   ├── components/      # UI components
│   ├── hooks/           # React hooks
│   ├── composer/        # Intent resolver
│   ├── theme/           # Design tokens
│   └── App.tsx          # Main app
├── shared/              # Shared types
├── test/                # Tests
└── docs/                # Documentation
```

## Development Commands

```bash
# Start dev server with hot reload
npm run dev

# Run linter
npm run lint

# Run all tests
npm test

# Run specific test
npx tsx test/agentRunQueue.test.ts

# Build for production
npm run build

# Preview production build
npm run preview
```

## Testing

Tests use Node.js built-in test runner with `tsx`:

```bash
# Run all tests (takes ~30s)
npm test

# Run a single test file
npx tsx test/agentRunQueue.test.ts

# Run tests matching a pattern
npm test | grep "AgentRunQueue"
```

### Test Categories

- `*.test.ts` - Unit tests (server logic)
- `*.test.tsx` - Component tests (React)
- Integration tests are included in unit test files

## Architecture

### Agent Runtime

The agent runtime manages LLM-powered task execution:

1. **Run Store** - Persists run state
2. **Runtime** - Executes tasks with capabilities
3. **Capabilities** - Available tools and actions
4. **Queue** - Manages concurrent runs
5. **History** - Records completed runs

### Browser Operator

The browser operator enables web interaction:

1. **Chrome Extension** - Captures page state
2. **Action Store** - Queues actions
3. **Observation Store** - Manages visual evidence
4. **MCP Tools** - Exposes browser capabilities

### MCP Integration

Model Context Protocol integration:

1. **Connections** - Managed MCP servers
2. **Capabilities** - Discovered tools/resources
3. **Approval** - Governance for tool invocation
4. **Provenance** - Audit trail

## Security

- Rate limiting on API endpoints
- Input validation and sanitization
- CORS restricted to localhost/extension origins
- Security headers (CSP, HSTS, etc.)
- Bearer token authentication

## Monitoring

### Structured Logging

All logs are JSON formatted:

```json
{
  "timestamp": "2026-07-26T12:00:00.000Z",
  "level": "info",
  "message": "Agent run completed",
  "requestId": "req-123456",
  "duration": 4500,
  "metadata": { "runId": "...", "status": "completed" }
}
```

### Metrics

Access metrics via:
- In-memory via `metrics` singleton
- Export endpoint (add `/api/metrics`)

## Troubleshooting

### Server won't start

- Check `PORTAL_TOKEN` is set in `.env`
- Verify port 4000 is available
- Check for missing dependencies: `npm install`

### Agent runtime unavailable

- Set `OPENAI_API_KEY` in `.env`
- Check API key validity
- Review server logs for errors

### Browser extension not connecting

- Ensure extension is installed and enabled
- Check Chrome DevTools for errors
- Verify server is running on localhost:4000

## Contributing

1. Create feature branch from `dev`
2. Write tests for new functionality
3. Run `npm run lint && npm test`
4. Submit PR with clear description
