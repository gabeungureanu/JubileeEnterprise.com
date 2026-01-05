import { Hono } from 'hono';
import { handleStripeWebhook } from '../services/payment.js';

const webhooks = new Hono();

// Stripe webhook endpoint
webhooks.post('/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');

  if (signature === undefined) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  const payload = await c.req.text();

  const result = await handleStripeWebhook(payload, signature);

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ received: true });
});

export { webhooks };
