/**
 * OpenAPI 3.1 description of the REST API, served at /api/docs.
 * Request bodies are generated from the shared Zod schemas, so the docs cannot drift
 * from what the server actually validates.
 */
import { z } from 'zod';
import {
  adminOrderUpdateSchema,
  adminStatusChangeSchema,
  buildCreateOrderSchema,
  changePasswordSchema,
  contentUpdateSchema,
  customerStatusActionSchema,
  forgotPasswordSchema,
  internalNoteSchema,
  loginSchema,
  messageBodySchema,
  portfolioItemSchema,
  registerSchema,
  reorderSchema,
  resetPasswordSchema,
  serviceSchema,
  siteSettingsSchema,
  toggleSchema,
  updateProfileSchema,
  ERROR_CODES,
  LOCALES,
  ORDER_STATUSES,
  PORTFOLIO_CATEGORIES,
  SPACES,
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
const localeParam = { name: 'locale', in: 'query', schema: { type: 'string', enum: [...LOCALES] } };
const pageParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
];
const csrf = [{ csrfHeader: [], sessionCookie: [] }];
const session = [{ sessionCookie: [] }];

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
const spaces = { type: 'array', items: { type: 'string', enum: [...SPACES] } };
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
    properties: {
      id: { type: 'string', format: 'uuid' },
      email: str,
      role: { type: 'string', enum: ['ADMIN', 'CUSTOMER'] },
      preferredLocale: locale,
      profile: {
        type: ['object', 'null'],
        properties: {
          fullName: str,
          phone: nstr,
          country: nstr,
          city: nstr,
          postalCode: nstr,
          street: nstr,
          houseNumber: nstr,
          addressExtra: nstr,
        },
      },
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
      accentColor: str,
      instagramUrl: nstr,
      contactEmail: nstr,
      contactPhone: nstr,
      contactAddress: nstr,
      enabledLocales: { type: 'array', items: locale },
      budgetRequired: bool,
      deadlineRequired: bool,
    },
  },
  AdminSettings: {
    allOf: [
      ref('PublicSettings'),
      { type: 'object', properties: { emailNotificationsEnabled: bool, smtpConfigured: bool } },
    ],
  },
  Service: {
    type: 'object',
    properties: { id: str, name: str, description: nstr, imageUrl: nstr, isWallService: bool },
  },
  PortfolioItem: {
    type: 'object',
    properties: {
      id: str,
      title: str,
      description: nstr,
      category: { type: 'string', enum: [...PORTFOLIO_CATEGORIES] },
      imageUrl: str,
      width: nnum,
      height: nnum,
      unit: { type: ['string', 'null'], enum: ['CM', 'M', null] },
      year: { type: ['integer', 'null'] },
      isFeatured: bool,
      isSample: bool,
      spaces,
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
      serviceName: nstr,
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
          inspiration: ref('Inspiration'),
          width: num,
          height: num,
          unit: str,
          description: str,
          budgetMin: nnum,
          budgetMax: nnum,
          deadline: { type: ['string', 'null'], format: 'date' },
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
      { type: 'object', properties: { customerName: str, customerEmail: str, customerPhone: str, archivedAt: nDateTime } },
    ],
  },
  AdminOrderDetail: {
    allOf: [
      ref('OrderDetail'),
      {
        type: 'object',
        properties: {
          customerId: str,
          customerAccountEmail: str,
          internalNotes: { type: 'array', items: ref('InternalNote') },
          canArchive: bool,
        },
      },
    ],
  },
  CreateOrderResult: {
    type: 'object',
    properties: { order: ref('OrderDetail'), created: bool, user: ref('User') },
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
      body: str,
      readAt: nDateTime,
      createdAt: dateTime,
      isOwn: bool,
    },
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
      category: str,
      isFeatured: bool,
      isPublished: bool,
      isSample: bool,
      spaces,
      allowSimilarRequest: bool,
      sortOrder: { type: 'integer' },
      translations: translations({ title: str, description: nstr }),
    },
  },
  AdminService: {
    type: 'object',
    properties: {
      id: str,
      imageUrl: nstr,
      isActive: bool,
      isWallService: bool,
      sortOrder: { type: 'integer' },
      orderCount: { type: 'integer' },
      translations: translations({ name: str, description: nstr }),
    },
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
  const orderData = jsonSchema(buildCreateOrderSchema({ isGuest: true, budgetRequired: false, deadlineRequired: false }));

  return {
    openapi: '3.1.0',
    info: {
      title: 'Painter & Wall Painting Service API',
      version: '1.0.0',
      description:
        'All non-GET requests require the `X-CSRF-Token` header matching the `csrf` cookie (get one from `GET /api/auth/csrf`). ' +
        'Authentication uses the HttpOnly `sid` session cookie. Validation messages are i18n keys.',
    },
    servers: [{ url: '/' }],
    tags: [
      { name: 'Public' },
      { name: 'Auth' },
      { name: 'Profile' },
      { name: 'Orders' },
      { name: 'Notifications' },
      { name: 'Admin: orders' },
      { name: 'Admin: content' },
    ],
    components: {
      securitySchemes: {
        sessionCookie: { type: 'apiKey', in: 'cookie', name: 'sid' },
        csrfHeader: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' },
      },
      schemas,
      responses: {
        E400: errorResponse('Validation error (VALIDATION_ERROR, upload errors, ORDER_QUOTE_REQUIRED, …)'),
        E401: errorResponse('Not signed in (UNAUTHENTICATED) or wrong credentials (INVALID_CREDENTIALS)'),
        E403: errorResponse('Forbidden (FORBIDDEN) or CSRF failure (CSRF_INVALID)'),
        E404: errorResponse('Not found — also returned for other customers’ resources'),
        E409: errorResponse('Conflict (ORDER_INVALID_TRANSITION, EMAIL_IN_USE, SERVICE_IN_USE, …)'),
        E429: errorResponse('Rate limited (RATE_LIMITED)'),
      },
    },
    paths: {
      '/api/site': {
        get: { tags: ['Public'], summary: 'Public settings and text blocks', parameters: [localeParam], responses: { 200: ok('Site', ref('Site')) } },
      },
      '/api/services': {
        get: {
          tags: ['Public'],
          summary: 'Active services',
          parameters: [localeParam],
          responses: { 200: ok('Services', { type: 'array', items: ref('Service') }) },
        },
      },
      '/api/portfolio': {
        get: {
          tags: ['Public'],
          summary: 'Published portfolio items',
          parameters: [
            localeParam,
            { name: 'category', in: 'query', schema: { type: 'string', enum: [...PORTFOLIO_CATEGORIES] } },
            { name: 'space', in: 'query', schema: { type: 'string', enum: [...SPACES] } },
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
          summary: 'Current user (null when signed out)',
          responses: { 200: ok('User', { type: 'object', properties: { user: { oneOf: [ref('User'), { type: 'null' }] } } }) },
        },
      },
      '/api/auth/register': {
        post: { tags: ['Auth'], summary: 'Create a customer account and sign in', security: csrf, requestBody: body(registerSchema), responses: { 201: ok('Created', ref('User')), ...errors(400, 403, 409, 429) } },
      },
      '/api/auth/login': {
        post: { tags: ['Auth'], summary: 'Sign in (rotates the session)', security: csrf, requestBody: body(loginSchema), responses: { 200: ok('Signed in', ref('User')), ...errors(400, 401, 403, 429) } },
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
      '/api/users/me': {
        patch: { tags: ['Profile'], summary: 'Update profile and preferred language', security: csrf, requestBody: body(updateProfileSchema), responses: { 200: ok('Updated', ref('User')), ...errors(400, 401, 403) } },
      },

      '/api/orders': {
        post: {
          tags: ['Orders'],
          summary: 'Submit a custom order (guests: an account is created)',
          description: `multipart/form-data with \`data\` (JSON, see schema) and up to ${UPLOAD_MAX_FILES} JPG/PNG/WebP images in \`files\`. Password fields are only required for guests. A repeated idempotencyKey returns the existing order with 200. An optional \`inspirationItemId\` must reference a published catalog item that allows similar requests (otherwise 400 \`validation.invalidInspiration\`); it does not count against the file limit.`,
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
        get: { tags: ['Orders'], summary: 'My orders', security: session, parameters: [...pageParams, localeParam], responses: { 200: ok('Page', paginated('OrderSummary')), ...errors(401, 403) } },
      },
      '/api/orders/{id}': {
        get: { tags: ['Orders'], summary: 'My order detail', security: session, parameters: [idParam, localeParam], responses: { 200: ok('Order', ref('OrderDetail')), ...errors(401, 404) } },
      },
      '/api/orders/{id}/status': {
        post: { tags: ['Orders'], summary: 'Accept a quote or cancel', security: csrf, parameters: [idParam], requestBody: body(customerStatusActionSchema), responses: { 200: ok('Order', ref('OrderDetail')), ...errors(400, 401, 404, 409) } },
      },
      '/api/orders/{id}/messages': {
        get: { tags: ['Orders'], summary: 'Message thread', security: session, parameters: [idParam], responses: { 200: ok('Messages', { type: 'array', items: ref('Message') }), ...errors(401, 404) } },
        post: { tags: ['Orders'], summary: 'Send a message', security: csrf, parameters: [idParam], requestBody: body(messageBodySchema), responses: { 201: ok('Sent', ref('Message')), ...errors(400, 401, 404, 429) } },
      },
      '/api/orders/{id}/messages/read': {
        post: { tags: ['Orders'], summary: 'Mark the thread as read', security: csrf, parameters: [idParam], responses: { 204: ok('Done'), ...errors(401, 404) } },
      },
      '/api/attachments/{id}': {
        get: {
          tags: ['Orders'],
          summary: 'Reference image (owner or admin only)',
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

      '/api/admin/stats': {
        get: { tags: ['Admin: orders'], summary: 'Dashboard overview', security: session, responses: { 200: ok('Stats', ref('AdminStats')), ...errors(401, 403) } },
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
      '/api/admin/portfolio/{id}': {
        put: { tags: ['Admin: content'], summary: 'Update', security: csrf, parameters: [idParam], requestBody: body(portfolioItemSchema), responses: { 200: ok('Updated', ref('AdminPortfolioItem')), ...errors(400, 401, 403, 404) } },
        delete: { tags: ['Admin: content'], summary: 'Delete', security: csrf, parameters: [idParam], responses: { 204: ok('Deleted'), ...errors(401, 403, 404) } },
      },
      '/api/admin/portfolio/{id}/featured': {
        post: { tags: ['Admin: content'], summary: 'Toggle featured', security: csrf, parameters: [idParam], requestBody: body(toggleSchema), responses: { 200: ok('Updated', ref('AdminPortfolioItem')), ...errors(400, 401, 403, 404) } },
      },
      '/api/admin/services': {
        get: { tags: ['Admin: content'], summary: 'All services with order counts', security: session, responses: { 200: ok('Services', { type: 'array', items: ref('AdminService') }), ...errors(401, 403) } },
        post: { tags: ['Admin: content'], summary: 'Create', security: csrf, requestBody: body(serviceSchema), responses: { 201: ok('Created', ref('AdminService')), ...errors(400, 401, 403) } },
      },
      '/api/admin/services/reorder': {
        post: { tags: ['Admin: content'], summary: 'Move one service up or down', security: csrf, requestBody: body(reorderSchema), responses: { 200: ok('Services', { type: 'array', items: ref('AdminService') }), ...errors(400, 401, 403, 404) } },
      },
      '/api/admin/services/{id}': {
        put: { tags: ['Admin: content'], summary: 'Update', security: csrf, parameters: [idParam], requestBody: body(serviceSchema), responses: { 200: ok('Updated', ref('AdminService')), ...errors(400, 401, 403, 404) } },
        delete: { tags: ['Admin: content'], summary: 'Delete (409 SERVICE_IN_USE when orders reference it)', security: csrf, parameters: [idParam], responses: { 204: ok('Deleted'), ...errors(401, 403, 404, 409) } },
      },
      '/api/admin/services/{id}/active': {
        post: { tags: ['Admin: content'], summary: 'Activate / deactivate', security: csrf, parameters: [idParam], requestBody: body(toggleSchema), responses: { 200: ok('Updated', ref('AdminService')), ...errors(400, 401, 403, 404) } },
      },
      '/api/admin/content': {
        get: { tags: ['Admin: content'], summary: 'All text blocks in all languages', security: session, responses: { 200: ok('Content', ref('AdminContent')), ...errors(401, 403) } },
        put: { tags: ['Admin: content'], summary: 'Update text blocks', security: csrf, requestBody: body(contentUpdateSchema), responses: { 200: ok('Content', ref('AdminContent')), ...errors(400, 401, 403) } },
      },
      '/api/admin/settings': {
        get: { tags: ['Admin: content'], summary: 'Site settings incl. SMTP status', security: session, responses: { 200: ok('Settings', ref('AdminSettings')), ...errors(401, 403) } },
        put: { tags: ['Admin: content'], summary: 'Update settings', security: csrf, requestBody: body(siteSettingsSchema), responses: { 200: ok('Settings', ref('AdminSettings')), ...errors(400, 401, 403) } },
      },
      '/api/admin/media': {
        post: {
          tags: ['Admin: content'],
          summary: 'Upload a public image (portfolio/service)',
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
