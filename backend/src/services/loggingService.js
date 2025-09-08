// backend/src/services/loggingService.js
import db from '../config/db.js';

class LoggingService {
  /**
   * Logs an incoming message and now includes the user's phone number directly.
   */
  async logIncoming(phone, message) {
    try {
      // Find the user's ID to maintain the relationship, but also store the phone number.
      const { rows: [user] } = await db.query(
        'SELECT id FROM users WHERE phone = $1',
        [phone]
      );
      const userId = user ? user.id : null;

      // Insert the incoming message, user_id, and the user_phone into the table.
      await db.query(
        'INSERT INTO conversations (user_id, user_phone, message) VALUES ($1, $2, $3)',
        [userId, phone, message]
      );
    } catch (error) {
      console.error('Error logging incoming message to DB:', error);
    }
  }

  /**
   * Logs an outgoing message by finding the last message from a specific phone number.
   */
  async logOutgoing(phone, response) {
    try {
      // Find the last conversation from this user's phone number that doesn't have a response yet
      // and update it with the bot's reply. This is more direct than looking up the user ID first.
      await db.query(
        `UPDATE conversations 
         SET response = $1 
         WHERE id = (
           SELECT id FROM conversations 
           WHERE user_phone = $2 AND response IS NULL 
           ORDER BY created_at DESC 
           LIMIT 1
         )`,
        [response, phone]
      );
    } catch (error) {
      console.error('Error logging outgoing message to DB:', error);
    }
  }
}

export default new LoggingService();