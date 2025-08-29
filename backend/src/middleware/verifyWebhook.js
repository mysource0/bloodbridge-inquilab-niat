// backend/src/middleware/verifyWebhook.js
import crypto from 'crypto';
import config from '../config/config.js';

/**
 * Middleware to verify WhatsApp webhook POST requests.
 * - Skips signature verification for GET (used by Meta for challenge verification).
 * - Validates signature for POST requests to ensure authenticity.
 */
export const verifyWebhook = (req, res, next) => {
  // Allow GET requests (Meta verification step) to pass through.
  if (req.method === 'GET') {
    return next();
  }

  // Get the signature from the request header.
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.warn('Signature missing for POST webhook');
    return res.status(401).json({ message: 'Signature missing' });
  }

  // --- THIS IS THE CORRECTED SECTION ---
  // Create an HMAC (Hash-based Message Authentication Code) using sha256.
  // We use the `whatsappAppSecret` as the key.
  const hmac = crypto.createHmac('sha256', config.whatsappAppSecret);

  // We MUST use the raw request body string that we saved earlier in server.js.
  // Using `req.body` here will fail because it's already parsed JSON.
  hmac.update(req.rawBody);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  // --- END OF CORRECTION ---

  // Compare the signature from Meta with the one we calculated.
  // We use a timing-safe comparison to enhance security.
  // An invalid signature means the request might be forged.
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    console.warn('Signature mismatch for POST webhook. Check your WHATSAPP_APP_SECRET.');
    return res.status(401).json({ message: 'Invalid signature' });
  }

  // If the signatures match, the request is authentic. Proceed to the next middleware.
  next();
};