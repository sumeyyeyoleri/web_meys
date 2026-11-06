/**
 * OpenAPI 3.1 description of the REST API, served at /api/docs.
 * Request bodies are generated from the shared Zod schemas, so the docs cannot drift
 * from what the server actually validates.
 */
import { z } from 'zod';
import {
  adminOrderUpdateSchema,
  adminPreferencesSchema,
  adminStatusChangeSchema,
  createOrderSchema,
  changePasswordSchema,
  contentUpdateSchema,
  customerStatusActionSchema,
  forgotPasswordSchema,
  internalNoteSchema,
  loginSchema,
  messageBodySchema,
  translateMessageSchema,
  adminProfileSchema,
  categorySchema,
  changeEmailSchema,
  portfolioItemSchema,
  reorderSchema,
  resetPasswordSchema,
  siteSettingsSchema,
  toggleSchema,
  ERROR_CODES,
  LOCALES,
  ORDER_STATUSES,
  UPLOAD_MAX_FILES,
} from '@painter/shared';

type Json = Record<string, unknown>;

const jsonSchema = (schema: z.ZodType): Json =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Json;

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: Json) => ({ 'application/json': { schema } });
const body = (schema: z.ZodType) => ({ required: true, content: json(jsonSchema(schema)) });
const ok = (description: string, schema?: Json) => (schema ? { description, content: json(schema) } : { description });

const errors = (...statuses: number[]) =>
  Object.fromEntries(statuses.map((status) => [String(status), { $ref: `#/components/responses/E${status}` }]));

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const messageIdParam = { ...idParam, name: 'messageId' };
const localeParam = { name: 'locale', in: 'query', schema: { type: 'string', enum: [...LOCALES] } };
const pageParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
];
const csrf = [{ csrfHeader: [], sessionCookie: [] }];
const session = [{ sessionCookie: [] }];
const tracking = [{ orderToken: [] }];
const trackingCsrf = [{ orderToken: [], csrfHeader: [] }];

const paginated = (item: string) => ({
  type: 'object',
  required: ['items', 'page', 'pageSize', 'total', 'totalPages'],
  properties: {
    items: { type: 'array', items: ref(item) },
    page: { type: 'integer' },
    pageSize: { type: 'integer' },
    total: { type: 'integer' },
    totalPages: { type: 'integer' },
  },
});

const str = { type: 'string' };
const nstr = { type: ['string', 'null'] };
const num = { type: 'number' };
const nnum = { type: ['number', 'null'] };
const bool = { type: 'boolean' };
const dateTime = { type: 'string', format: 'date-time' };
const nDateTime = { type: ['string', 'null'], format: 'date-time' };
const status = { type: 'string', enum: [...ORDER_STATUSES] };
const locale = { type: 'string', enum: [...LOCALES] };
const unit = { type: ['string', 'null'], enum: ['CM', 'M', null] };
const translations = (props: Json) => ({
  type: 'object',
  properties: Object.fromEntries(LOCALES.map((l) => [l, { type: 'object', properties: props }])),
});

const schemas: Record<string, Json> = {
  Error: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string', enum: [...ERROR_CODES] },
          message: str,
          fields: {
            type: 'object',
            additionalProperties: str,
            description: 'Field path → i18n validation key, e.g. { "email": "validation.email" }',
          },
        },
      },
    },
  },
  User: {
    type: 'object',
    description: "The artist's account (customers have no account).",
    properties: {
      id: { type: 'string', format: 'uuid' },
      email: str,
      name: { type: ['string', 'null'], description: 'Display name from "My account"' },
      preferredLocale: locale,
      createdAt: dateTime,
    },
  },
  Site: {
    type: 'object',
    properties: {
      locale,
      settings: ref('PublicSettings'),
      content: { type: 'object', additionalProperties: str, description: 'Text blocks by key (hero.title, …)' },
    },
  },
  PublicSettings: {
    type: 'object',
    properties: {
      businessName: str,
      logoUrl: { type: 'string', nullable: true, description: 'Uploaded logo; null → the name is shown as a wordmark' },
      accentColor: str,
      instagramUrl: nstr,
      contactEmail: nstr,
      contactPhone: nstr,
      contactAddress: nstr,
      enabledLocales: { type: 'array', items: locale },
      emailAvailable: { type: 'boolean', description: 'SMTP configured — the site can send emails' },
      translationAvailable: { type: 'boolean', description: 'DEEPL_API_KEY configured — messages can be translated' },
      welcomeEnabled: { type: 'boolean', description: 'Home page welcome screen, once per browser session' },
      welcomeImageUrl: { type: 'string', nullable: true, description: 'Welcome background; null → the first featured artwork' },
    },
  },
  AdminSettings: {
    allOf: [
      ref('PublicSettings'),
      { type: 'object', properties: { emailNotificationsEnabled: bool, smtpConfigured: bool } },
    ],
  },
  CategoryRef: {
    type: 'object',
    properties: { id: str, slug: { type: 'string', description: 'URL value for the catalog filter' }, name: str },
  },
  Category: {
    allOf: [
      ref('CategoryRef'),
      {
        type: 'object',
        properties: {
          description: nstr,
          coverImageUrl: nstr,
          defaultUnit: unit,
          showOnSite: { type: 'boolean', description: 'Catalog filter and services page' },
          showInOrderForm: bool,
          hasWorks: { type: 'boolean', description: 'Has works on the site (then it is a catalog filter)' },
        },
      },
    ],
  },
  PortfolioItem: {
    type: 'object',
    properties: {
      id: str,
      title: str,
      description: nstr,
      category: { oneOf: [ref('CategoryRef'), { type: 'null' }], description: 'null = uncategorised' },
      imageUrl: str,
      width: nnum,
      height: nnum,
      unit,
      year: { type: ['integer', 'null'] },
      isFeatured: bool,
      isSample: bool,
      allowSimilarRequest: { type: 'boolean', description: 'Whether "Request something similar" is offered' },
    },
  },
  Inspiration: {
    type: ['object', 'null'],
    description: 'Catalog item the order started from; title in the order communication language.',
    properties: { id: str, title: str, imageUrl: str },
  },
  OrderSummary: {
    type: 'object',
    properties: {
      id: str,
      reference: { type: 'string', example: 'ORD-2026-7K3QXM' },
      title: str,
      status,
      categoryName: { type: ['string', 'null'], description: "The category in the viewer's language, else the former service name" },
      quoteAmount: nnum,
      unreadMessages: { type: 'integer' },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
  OrderDetail: {
    allOf: [
      ref('OrderSummary'),
      {
        type: 'object',
        description: 'All submitted data, attachments, status history and allowed transitions for the viewer.',
        properties: {
          categoryId: { type: ['string', 'null'] },
          previousServiceName: { type: ['string', 'null'], description: 'The chosen service/category name when the order has no category or it differs from the category' },
          inspiration: ref('Inspiration'),
          additionalSpecs: { ...nstr, description: 'Older orders only: requested changes compared to the inspiration example' },
          width: num,
          height: num,
          unit: str,
          description: str,
          budgetMin: { ...nnum, description: 'Older orders only' },
          budgetMax: { ...nnum, description: 'Older orders only' },
          deadline: { type: ['string', 'null'], format: 'date', description: 'Older orders only' },
          contact: { type: 'object' },
          projectAddress: { type: 'object' },
          attachments: { type: 'array', items: ref('Attachment') },
          statusHistory: { type: 'array', items: ref('StatusHistory') },
          allowedTransitions: { type: 'array', items: status },
          archivedAt: nDateTime,
        },
      },
    ],
  },
  AdminOrderSummary: {
    allOf: [
      ref('OrderSummary'),
      {
        type: 'object',
        properties: { customerName: str, customerEmail: nstr, customerPhone: nstr, archivedAt: nDateTime },
      },
    ],
  },
  AdminOrderDetail: {
    allOf: [
      ref('OrderDetail'),
      {
        type: 'object',
        properties: {
          internalNotes: { type: 'array', items: ref('InternalNote') },
          canArchive: bool,
        },
      },
    ],
  },
  CreateOrderResult: {
    type: 'object',
    properties: { order: ref('OrderDetail'), created: bool, tracking: ref('TrackingLink') },
  },
  TrackingLink: {
    type: 'object',
    description: 'Private link to an order (the customer has no account). The token inside is only returned this once (only its hash is stored).',
    properties: {
      url: { type: 'string', example: 'https://example.be/track#<token>' },
      expiresAt: dateTime,
      emailSent: { type: 'boolean', description: 'True only when the email with the link was accepted by SMTP' },
    },
  },
  Attachment: {
    type: 'object',
    properties: { id: str, originalName: str, mimeType: str, sizeBytes: { type: 'integer' }, url: str, createdAt: dateTime },
  },
  StatusHistory: {
    type: 'object',
    properties: {
      id: str,
      fromStatus: { ...status, type: ['string', 'null'] },
      toStatus: status,
      changedByRole: str,
      note: nstr,
      quoteAmount: nnum,
      createdAt: dateTime,
    },
  },
  Message: {
    type: 'object',
    properties: {
      id: str,
      senderRole: str,
      senderName: str,
      locale: { type: 'string', enum: [...LOCALES], description: "The sender's language when it was written" },
      body: str,
      readAt: nDateTime,
      createdAt: dateTime,
      isOwn: bool,
    },
  },
  MessageTranslation: {
    type: 'object',
    description: 'Machine translation (DeepL), stored per message and language.',
    properties: { messageId: str, locale: { type: 'string', enum: [...LOCALES] }, body: str },
  },
  InternalNote: {
    type: 'object',
    description: 'Only ever returned by /api/admin endpoints.',
    properties: { id: str, body: str, authorEmail: str, createdAt: dateTime },
  },
  Notification: {
    type: 'object',
    properties: {
      id: str,
      type: { type: 'string', enum: ['ORDER_SUBMITTED', 'ORDER_STATUS_CHANGED', 'ORDER_MESSAGE'] },
      orderId: nstr,
      orderReference: nstr,
      status: { ...status, type: ['string', 'null'] },
      readAt: nDateTime,
      createdAt: dateTime,
    },
  },
  AdminStats: {
    type: 'object',
    properties: {
      totalOrders: { type: 'integer' },
      newOrders: { type: 'integer' },
      inReview: { type: 'integer' },
      inProgress: { type: 'integer' },
      completed: { type: 'integer' },
      unreadCustomerMessages: { type: 'integer' },
      recentOrders: { type: 'array', items: ref('AdminOrderSummary') },
      recentMessages: { type: 'array', items: { type: 'object' } },
    },
  },
  AdminPortfolioItem: {
    type: 'object',
    properties: {
      id: str,
      imageUrl: str,
      categoryId: { type: ['string', 'null'], description: 'null = uncategorised' },
      categoryHidden: { type: 'boolean', description: 'The category is hidden, so the work is not on the site' },
      isFeatured: bool,
      isPublished: bool,
      isSample: bool,
      allowSimilarRequest: bool,
      sortOrder: { type: 'integer' },
      translations: translations({ title: str, description: nstr }),
    },
  },
  AdminCategory: {
    type: 'object',
    properties: {
      id: str,
      slug: str,
      isVisible: { type: 'boolean', description: 'false = the category and all its works are hidden on the site' },
      sortOrder: { type: 'integer' },
      showInOrderForm: bool,
      coverImageUrl: nstr,
      defaultUnit: unit,
      itemCount: { type: 'integer' },
      orderCount: { type: 'integer' },
      translations: translations({ name: str, description: nstr }),
    },
  },
  SetupChecklist: {
    type: 'object',
    description: '"Personalise your site": true = done, worked out from the data',
    properties: { logo: bool, firstWork: bool, aboutText: bool, samplesHidden: bool, contactDetails: bool },
  },
  AdminContent: {
    type: 'object',
    properties: {
      items: { type: 'array', items: { type: 'object', properties: { key: str, locale, value: str } } },
    },
  },
};

const errorResponse = (description: string) => ({ description, content: json(ref('Error')) });

export function buildOpenApiSpec(): Json {
  const orderData = jsonSchema(createOrderSchema);

  return {
    openapi: '3.1.0',
    info: {
      title: 'Painter & Wall Painting Service API',
      version: '1.0.0',
      description:
        'All non-GET requests require the `X-CSRF-Token` header matching the `csrf` cookie (get one from `GET /api/auth/csrf`). ' +
        'The artist signs in with the HttpOnly `sid` session cookie; customers have no account and use the `X-Order-Token` header from their tracking link. Validation messages are i18n keys.',
    },
    servers: [{ url: '/' }],
    tags: [
      { name: 'Public' },
      { name: 'Auth' },
      { name: 'Orders' },
      { name: 'Tracking', description: "The customer's order through the private tracking link" },
      { name: 'Notifications' },
      { name: 'Admin: orders' },
      { name: 'Admin: content' },
    ],
    components: {
      securitySchemes: {
        sessionCookie: { type: 'apiKey', in: 'cookie', name: 'sid' },
        csrfHeader: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' },
        orderToken: { type: 'apiKey', in: 'header', name: 'X-Order-Token', description: 'Token from the private tracking link (/track#<token>)' },
      },
      schemas,
      responses: {
        E400: errorResponse('Validation error (VALIDATION_ERROR, upload errors, ORDER_QUOTE_REQUIRED, …)'),
        E401: errorResponse('Not signed in (UNAUTHENTICATED) or wrong credentials (INVALID_CREDENTIALS)'),
        E403: errorResponse('Forbidden (FORBIDDEN) or CSRF failure (CSRF_INVALID)'),
        E404: errorResponse('Not found — also returned for unknown, expired or revoked tracking tokens'),
        E409: errorResponse('Conflict (ORDER_INVALID_TRANSITION, …)'),
        E429: errorResponse('Rate limited (RATE_LIMITED)'),
        E502: errorResponse('Translation service error (TRANSLATION_FAILED)'),
        E503: errorResponse('Translation not configured or quota used up (TRANSLATION_UNAVAILABLE, TRANSLATION_LIMIT_REACHED)'),
      },
    },
    paths: {
      '/api/site': {
        get: { tags: ['Public'], summary: 'Public settings and text blocks', parameters: [localeParam], responses: { 200: ok('Site', ref('Site')) } },
      },
      '/api/categories': {
        get: {
          tags: ['Public'],
          summary: 'Categories shown on the site or in the order form (catalog filters = showOnSite && hasWorks; services page = showOnSite; order form = showInOrderForm)',
          parameters: [localeParam],
          responses: { 200: ok('Categories', { type: 'array', items: ref('Category') }) },
        },
      },
      '/api/portfolio': {
        get: {
          tags: ['Public'],
          summary: 'Portfolio items on the site (published, category not hidden)',
          parameters: [
            localeParam,
            { name: 'category', in: 'query', description: 'Category slug; unknown or hidden slugs match nothing', schema: { type: 'string' } },
            { name: 'featured', in: 'query', schema: { type: 'boolean' } },
          ],
          responses: { 200: ok('Items', { type: 'array', items: ref('PortfolioItem') }), ...errors(400) },
        },
      },
      '/api/portfolio/{id}': {
        get: {
          tags: ['Public'],
          summary: 'One published portfolio item (e.g. for /order?from=<id>)',
          parameters: [idParam, localeParam],
          responses: { 200: ok('Item', ref('PortfolioItem')), ...errors(404) },
        },
      },

      '/api/auth/csrf': {
        get: { tags: ['Auth'], summary: 'Get (and set) the CSRF token', responses: { 200: ok('Token', { type: 'object', properties: { csrfToken: str } }) } },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'The signed-in artist (null when signed out)',
          responses: { 200: ok('User', { type: 'object', properties: { user: { oneOf: [ref('User'), { type: 'null' }] } } }) },
        },
      },
      '/api/auth/login': {
        post: { tags: ['Auth'], summary: 'Artist sign-in (rotates the session)', security: csrf, requestBody: body(loginSchema), responses: { 200: ok('Signed in', ref('User')), ...errors(400, 401, 403, 429) } },
      },
      '/api/auth/logout': {
        post: { tags: ['Auth'], summary: 'Sign out', security: csrf, responses: { 204: ok('Signed out'), ...errors(403) } },
      },
      '/api/auth/forgot-password': {
        post: {
          tags: ['Auth'],
          summary: 'Request a reset link (same response whether or not the account exists)',
          security: csrf,
          requestBody: body(forgotPasswordSchema),
          responses: { 202: ok('Accepted'), ...errors(400, 403, 429) },
        },
      },
      '/api/auth/reset-password': {
        post: { tags: ['Auth'], summary: 'Set a new password with a reset token', security: csrf, requestBody: body(resetPasswordSchema), responses: { 204: ok('Password changed'), ...errors(400, 403, 429) } },
      },
      '/api/auth/change-password': {
        post: { tags: ['Auth'], summary: 'Change password (ends all other sessions)', security: csrf, requestBody: body(changePasswordSchema), responses: { 204: ok('Password changed'), ...errors(400, 401, 403) } },
      },

      '/api/orders': {
        post: {
          tags: ['Orders'],
          summary: 'Submit a custom order (no account)',
          description: `multipart/form-data with \`data\` (JSON, see schema) and up to ${UPLOAD_MAX_FILES} JPG/PNG/WebP images in \`files\`. Customers have no account: the response contains the private \`tracking\` link, shown only once, and also emailed when an email address was given and SMTP is configured (\`emailSent\`). Name and phone are required, the email is optional. A repeated idempotencyKey returns the existing order with 200 and a fresh tracking link; the same key with other contact details gives 409. An optional \`inspirationItemId\` must reference a published catalog item that allows similar requests (otherwise 400 \`validation.invalidInspiration\`); it does not count against the file limit.`,
          security: csrf,
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['data'],
                  properties: {
                    data: { type: 'string', description: 'JSON-encoded order', contentMediaType: 'application/json', contentSchema: orderData },
                    files: { type: 'array', items: { type: 'string', format: 'binary' } },
                  },
                },
              },
            },
          },
          responses: {
            201: ok('Created', ref('CreateOrderResult')),
            200: ok('Existing order (idempotent repeat)', ref('CreateOrderResult')),
            ...errors(400, 403, 409, 429),
          },
        },
      },
      '/api/track/order': {
        get: { tags: ['Tracking'], summary: 'Order detail', security: tracking, parameters: [localeParam], responses: { 200: ok('Order', ref('OrderDetail')), ...errors(404, 429) } },
      },
      '/api/track/status': {
        post: { tags: ['Tracking'], summary: 'Accept a quote or cancel', security: trackingCsrf, requestBody: body(customerStatusActionSchema), responses: { 200: ok('Order', ref('OrderDetail')), ...errors(400, 403, 404, 409, 429) } },
      },
      '/api/track/messages': {
        get: { tags: ['Tracking'], summary: 'Message thread', security: tracking, responses: { 200: ok('Messages', { type: 'array', items: ref('Message') }), ...errors(404, 429) } },
        post: { tags: ['Tracking'], summary: 'Send a message', security: trackingCsrf, requestBody: body(messageBodySchema), responses: { 201: ok('Sent', ref('Message')), ...errors(400, 403, 404, 429) } },
      },
      '/api/track/messages/read': {
        post: { tags: ['Tracking'], summary: 'Mark the thread as read', security: trackingCsrf, responses: { 204: ok('Done'), ...errors(403, 404, 429) } },
      },
      '/api/track/messages/{messageId}/translate': {
        post: {
          tags: ['Tracking'],
          summary: 'Translate a message (on request, cached)',
          security: trackingCsrf,
          parameters: [messageIdParam],
          requestBody: body(translateMessageSchema),
          responses: { 200: ok('Translation', ref('MessageTranslation')), ...errors(400, 403, 404, 429, 502, 503) },
        },
      },
      '/api/track/attachments/{id}': {
        get: {
          tags: ['Tracking'],
          summary: 'Reference image of the tracked order',
          security: tracking,
          parameters: [idParam, { name: 'download', in: 'query', schema: { type: 'string', enum: ['1'] } }],
          responses: { 200: { description: 'Image', content: { 'image/*': { schema: { type: 'string', format: 'binary' } } } }, ...errors(404, 429) },
        },
      },
      '/api/attachments/{id}': {
        get: {
          tags: ['Orders'],
          summary: 'Reference image (artist only; customers use /api/track/attachments/{id})',
          security: session,
          parameters: [idParam, { name: 'download', in: 'query', schema: { type: 'string', enum: ['1'] } }],
          responses: { 200: { description: 'Image', content: { 'image/*': { schema: { type: 'string', format: 'binary' } } } }, ...errors(401, 404) },
        },
      },

      '/api/notifications': {
        get: { tags: ['Notifications'], summary: 'My notifications', security: session, parameters: pageParams, responses: { 200: ok('Page', paginated('Notification')), ...errors(401) } },
      },
      '/api/notifications/unread-count': {
        get: { tags: ['Notifications'], summary: 'Unread count', security: session, responses: { 200: ok('Count', { type: 'object', properties: { count: { type: 'integer' } } }), ...errors(401) } },
      },
      '/api/notifications/{id}/read': {
        post: { tags: ['Notifications'], summary: 'Mark one as read', security: csrf, parameters: [idParam], responses: { 204: ok('Done'), ...errors(401, 404) } },
      },
      '/api/notifications/read-all': {
        post: { tags: ['Notifications'], summary: 'Mark all as read', security: csrf, responses: { 204: ok('Done'), ...errors(401) } },
      },

      '/api/admin/me': {
        patch: { tags: ['Admin: orders'], summary: "The artist's dashboard language (also used for the artist's emails)", security: csrf, requestBody: body(adminPreferencesSchema), responses: { 200: ok('Updated', ref('User')), ...errors(400, 401, 403) } },
      },
      '/api/admin/account/profile': {
        put: { tags: ['Admin: account'], summary: 'My account: display name (empty = none)', security: csrf, requestBody: body(adminProfileSchema), responses: { 200: ok('Updated', ref('User')), ...errors(400, 401, 403) } },
      },
      '/api/admin/account/email': {
        post: {
          tags: ['Admin: account'],
          summary: 'My account: sign-in email (current password required; signs out every other session, sets a fresh session cookie)',
          security: csrf,
          requestBody: body(changeEmailSchema),
          responses: { 200: ok('Updated', ref('User')), ...errors(400, 401, 403, 409) },
        },
      },
      '/api/admin/stats': {
        get: { tags: ['Admin: orders'], summary: 'Dashboard overview', security: session, responses: { 200: ok('Stats', ref('AdminStats')), ...errors(401, 403) } },
      },
      '/api/admin/setup-checklist': {
        get: { tags: ['Admin: content'], summary: '"Personalise your site" checklist', security: session, responses: { 200: ok('Checklist', ref('SetupChecklist')), ...errors(401, 403) } },
      },
      '/api/admin/orders': {
        get: {
          tags: ['Admin: orders'],
          summary: 'List, filter and search orders',
          security: session,
          parameters: [
            ...pageParams,
            { name: 'status', in: 'query', schema: status },
            { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'q', in: 'query', description: 'Reference, customer name, email or phone', schema: str },
            { name: 'includeArchived', in: 'query', schema: bool },
            localeParam,
          ],
          responses: { 200: ok('Page', paginated('AdminOrderSummary')), ...errors(400, 401, 403) },
        },
      },
      '/api/admin/orders/{id}': {
        get: { tags: ['Admin: orders'], summary: 'Order detail incl. internal notes', security: session, parameters: [idParam], responses: { 200: ok('Order', ref('AdminOrderDetail')), ...errors(401, 403, 404) } },
        put: { tags: ['Admin: orders'], summary: 'Edit order details', security: csrf, parameters: [idParam], requestBody: body(adminOrderUpdateSchema), responses: { 200: ok('Order', ref('AdminOrderDetail')), ...errors(400, 401, 403, 404, 409) } },
      },
      '/api/admin/orders/{id}/status': {
        post: { tags: ['Admin: orders'], summary: 'Change status (QUOTE_SENT requires quoteAmount)', security: csrf, parameters: [idParam], requestBody: body(adminStatusChangeSchema), responses: { 200: ok('Order', ref('AdminOrderDetail')), ...errors(400, 401, 403, 404, 409) } },
      },
      '/api/admin/orders/{id}/archive': {
        post: { tags: ['Admin: orders'], summary: 'Archive a completed/cancelled order', security: csrf, parameters: [idParam], responses: { 200: ok('Order', ref('AdminOrderDetail')), ...errors(401, 403, 404, 409) } },
      },
      '/api/admin/orders/{id}/messages': {
        get: { tags: ['Admin: orders'], summary: 'Customer thread', security: session, parameters: [idParam], responses: { 200: ok('Messages', { type: 'array', items: ref('Message') }), ...errors(401, 403, 404) } },
        post: { tags: ['Admin: orders'], summary: 'Reply to the customer', security: csrf, parameters: [idParam], requestBody: body(messageBodySchema), responses: { 201: ok('Sent', ref('Message')), ...errors(400, 401, 403, 404) } },
      },
      '/api/admin/orders/{id}/messages/read': {
        post: { tags: ['Admin: orders'], summary: 'Mark customer messages as read', security: csrf, parameters: [idParam], responses: { 204: ok('Done'), ...errors(401, 403, 404) } },
      },
      '/api/admin/orders/{id}/messages/{messageId}/translate': {
        post: {
          tags: ['Admin: orders'],
          summary: 'Translate a message (on request, cached)',
          security: csrf,
          parameters: [idParam, messageIdParam],
          requestBody: body(translateMessageSchema),
          responses: { 200: ok('Translation', ref('MessageTranslation')), ...errors(400, 401, 403, 404, 429, 502, 503) },
        },
      },
      '/api/admin/orders/{id}/tracking-link': {
        post: {
          tags: ['Admin: orders'],
          summary: 'Create a new tracking link',
          description: 'Revokes every earlier link of the order and returns a new one (shown only once). Emailed to the order contact when an email address is known and SMTP is configured.',
          security: csrf,
          parameters: [idParam],
          responses: { 201: ok('New link', ref('TrackingLink')), ...errors(401, 403, 404) },
        },
      },
      '/api/admin/orders/{id}/notes': {
        get: { tags: ['Admin: orders'], summary: 'Internal notes', security: session, parameters: [idParam], responses: { 200: ok('Notes', { type: 'array', items: ref('InternalNote') }), ...errors(401, 403, 404) } },
        post: { tags: ['Admin: orders'], summary: 'Add an internal note', security: csrf, parameters: [idParam], requestBody: body(internalNoteSchema), responses: { 201: ok('Created', ref('InternalNote')), ...errors(400, 401, 403, 404) } },
      },

      '/api/admin/portfolio': {
        get: { tags: ['Admin: content'], summary: 'All portfolio items', security: session, responses: { 200: ok('Items', { type: 'array', items: ref('AdminPortfolioItem') }), ...errors(401, 403) } },
        post: { tags: ['Admin: content'], summary: 'Create', security: csrf, requestBody: body(portfolioItemSchema), responses: { 201: ok('Created', ref('AdminPortfolioItem')), ...errors(400, 401, 403) } },
      },
      '/api/admin/portfolio/reorder': {
        post: { tags: ['Admin: content'], summary: 'Move one item up or down', security: csrf, requestBody: body(reorderSchema), responses: { 200: ok('Items', { type: 'array', items: ref('AdminPortfolioItem') }), ...errors(400, 401, 403, 404) } },
      },
      '/api/admin/portfolio/hide-samples': {
        post: {
          tags: ['Admin: content'],
          summary: 'Hide all sample works (unpublishes every isSample item)',
          security: csrf,
          responses: { 200: ok('Hidden', { type: 'object', properties: { hidden: { type: 'integer' } } }), ...errors(401, 403) },
        },
      },
      '/api/admin/portfolio/{id}': {
        put: { tags: ['Admin: content'], summary: 'Update', security: csrf, parameters: [idParam], requestBody: body(portfolioItemSchema), responses: { 200: ok('Updated', ref('AdminPortfolioItem')), ...errors(400, 401, 403, 404) } },
        delete: { tags: ['Admin: content'], summary: 'Delete', security: csrf, parameters: [idParam], responses: { 204: ok('Deleted'), ...errors(401, 403, 404) } },
      },
      '/api/admin/portfolio/{id}/featured': {
        post: { tags: ['Admin: content'], summary: 'Toggle featured', security: csrf, parameters: [idParam], requestBody: body(toggleSchema), responses: { 200: ok('Updated', ref('AdminPortfolioItem')), ...errors(400, 401, 403, 404) } },
      },
      '/api/admin/portfolio/{id}/published': {
        post: { tags: ['Admin: content'], summary: 'Publish / unpublish a work', security: csrf, parameters: [idParam], requestBody: body(toggleSchema), responses: { 200: ok('Updated', ref('AdminPortfolioItem')), ...errors(400, 401, 403, 404) } },
      },
      '/api/admin/categories': {
        get: { tags: ['Admin: content'], summary: 'All catalog categories with work counts', security: session, responses: { 200: ok('Categories', { type: 'array', items: ref('AdminCategory') }), ...errors(401, 403) } },
        post: { tags: ['Admin: content'], summary: 'Create (name in NL/EN/TR required; the URL slug is made from the English name)', security: csrf, requestBody: body(categorySchema), responses: { 201: ok('Created', ref('AdminCategory')), ...errors(400, 401, 403) } },
      },
      '/api/admin/categories/reorder': {
        post: { tags: ['Admin: content'], summary: 'Move one category up or down', security: csrf, requestBody: body(reorderSchema), responses: { 200: ok('Categories', { type: 'array', items: ref('AdminCategory') }), ...errors(400, 401, 403, 404) } },
      },
      '/api/admin/categories/{id}': {
        put: { tags: ['Admin: content'], summary: 'Update names and visibility (the slug stays)', security: csrf, parameters: [idParam], requestBody: body(categorySchema), responses: { 200: ok('Updated', ref('AdminCategory')), ...errors(400, 401, 403, 404) } },
        delete: {
          tags: ['Admin: content'],
          summary: 'Delete; its works move to `moveTo` or become uncategorised — works are never deleted',
          security: csrf,
          parameters: [idParam, { name: 'moveTo', in: 'query', schema: { type: 'string', format: 'uuid' } }],
          responses: { 204: ok('Deleted'), ...errors(400, 401, 403, 404) },
        },
      },
      '/api/admin/categories/{id}/visible': {
        post: { tags: ['Admin: content'], summary: 'Show / hide the category and its works on the site', security: csrf, parameters: [idParam], requestBody: body(toggleSchema), responses: { 200: ok('Updated', ref('AdminCategory')), ...errors(400, 401, 403, 404) } },
      },
      '/api/admin/content': {
        get: { tags: ['Admin: content'], summary: 'All text blocks in all languages', security: session, responses: { 200: ok('Content', ref('AdminContent')), ...errors(401, 403) } },
        put: { tags: ['Admin: content'], summary: 'Update text blocks', security: csrf, requestBody: body(contentUpdateSchema), responses: { 200: ok('Content', ref('AdminContent')), ...errors(400, 401, 403) } },
      },
      '/api/admin/settings': {
        get: { tags: ['Admin: content'], summary: 'Site settings incl. SMTP status', security: session, responses: { 200: ok('Settings', ref('AdminSettings')), ...errors(401, 403) } },
        put: { tags: ['Admin: content'], summary: 'Update settings', security: csrf, requestBody: body(siteSettingsSchema), responses: { 200: ok('Settings', ref('AdminSettings')), ...errors(400, 401, 403) } },
      },
      '/api/admin/settings/logo': {
        post: {
          tags: ['Admin: content'],
          summary: 'Upload the site logo (SVG, PNG or WebP; SVGs with scripts, event handlers or external references are rejected)',
          security: csrf,
          requestBody: {
            required: true,
            content: { 'multipart/form-data': { schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } } },
          },
          responses: { 200: ok('Settings', ref('AdminSettings')), ...errors(400, 401, 403) },
        },
        delete: { tags: ['Admin: content'], summary: 'Remove the logo (back to the wordmark)', security: csrf, responses: { 200: ok('Settings', ref('AdminSettings')), ...errors(401, 403) } },
      },
      '/api/admin/media': {
        post: {
          tags: ['Admin: content'],
          summary: 'Upload a public image (catalog work, category cover, welcome screen); optimised to WebP, at most 2400 px, metadata removed',
          security: csrf,
          requestBody: {
            required: true,
            content: { 'multipart/form-data': { schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } } },
          },
          responses: { 201: ok('Uploaded', { type: 'object', properties: { url: str } }), ...errors(400, 401, 403) },
        },
      },
    },
  };
}
