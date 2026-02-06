import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';

// Route imports
import authRoutes from './modules/hcp/auth.routes';
import hcpRoutes from './modules/hcp/hcp.routes';
import engagementRoutes from './modules/engagement/engagement.routes';
import fieldForceRoutes from './modules/field-force/field-force.routes';
import complianceRoutes from './modules/compliance/compliance.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import omnichannelRoutes from './modules/omnichannel/omnichannel.routes';
import aiIntelligenceRoutes from './modules/ai-intelligence/ai-intelligence.routes';
import integrationRoutes from './modules/integration/integration.routes';

const app = express();

// ─── SECURITY MIDDLEWARE ───────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));

app.use(cors({
  origin: config.cors.origins,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// ─── RATE LIMITING ─────────────────────────────────────────────

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
});
app.use(limiter);

// ─── PARSING & LOGGING ────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: { write: (message: string) => logger.info(message.trim()) },
}));

// ─── HEALTH CHECK ──────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'pharmacrm-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── API ROUTES ────────────────────────────────────────────────

const api = config.apiPrefix;

app.use(`${api}/auth`, authRoutes);
app.use(`${api}/hcps`, hcpRoutes);
app.use(`${api}/engagement`, engagementRoutes);
app.use(`${api}/field-force`, fieldForceRoutes);
app.use(`${api}/compliance`, complianceRoutes);
app.use(`${api}/analytics`, analyticsRoutes);
app.use(`${api}/omnichannel`, omnichannelRoutes);
app.use(`${api}/ai`, aiIntelligenceRoutes);
app.use(`${api}/integrations`, integrationRoutes);

// ─── API DOCUMENTATION ENDPOINT ───────────────────────────────

app.get(`${api}/docs`, (_req, res) => {
  res.json({
    name: 'PharmaCRM API',
    version: 'v1',
    modules: {
      auth: `${api}/auth — Authentication & user management`,
      hcps: `${api}/hcps — HCP profile management, consent, segmentation`,
      engagement: `${api}/engagement — Interactions & tasks`,
      fieldForce: `${api}/field-force — Visit plans, offline sync, suggestions`,
      compliance: `${api}/compliance — Audit logs, GDPR, consent history`,
      analytics: `${api}/analytics — Dashboards, KPIs, reports`,
      omnichannel: `${api}/omnichannel — Email campaigns, channel recommendations`,
      ai: `${api}/ai — Scoring, NBA, summaries, copilot`,
      integrations: `${api}/integrations — Webhooks, data imports`,
    },
  });
});

// ─── ERROR HANDLING ────────────────────────────────────────────

app.use(errorHandler);

// ─── START SERVER ──────────────────────────────────────────────

const port = config.port;

app.listen(port, () => {
  logger.info(`PharmaCRM Backend started on port ${port}`, {
    env: config.env,
    apiPrefix: config.apiPrefix,
  });
});

export default app;
