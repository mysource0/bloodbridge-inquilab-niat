// backend/src/services/gamificationService.js
import db from '../config/db.js';
import whatsappService from './whatsappService.js';

// A central place to define all possible achievements in the system.
const ACHIEVEMENTS = {
  FIRST_REGISTRATION: { name: 'Community Hero', points: 50, emoji: '❤️' },
  EMERGENCY_RESPONSE: { name: 'Life Saver', points: 100, emoji: '🚨' },
};

class GamificationService {
  /**
   * Awards points for a specific event, updates the user's total,
   * logs the achievement, and notifies the user.
   * @param {string} userId - The UUID of the user.
   * @param {string} event - The key for the achievement (e.g., 'FIRST_REGISTRATION').
   * @param {string} userPhone - The user's phone number for notification.
   */
  async awardPoints(userId, event, userPhone) {
    const achievement = ACHIEVEMENTS[event];
    if (!achievement) return; // If the event doesn't exist, do nothing.

    try {
      // Add points to the user's total score.
      const { rows: [user] } = await db.query(
        "UPDATE users SET gamification_points = gamification_points + $1 WHERE id = $2 RETURNING gamification_points",
        [achievement.points, userId]
      );

      if (!user) throw new Error("User not found or update failed.");

      // Log this specific achievement in the achievements table.
      await db.query(
        "INSERT INTO achievements(user_id, badge_type, points_awarded) VALUES($1, $2, $3)",
        [userId, achievement.name, achievement.points]
      );

      // Send a notification to the user.
      const notification = `🏆 Achievement Unlocked! 🏆\n\nYou've earned the *${achievement.name}* badge ${achievement.emoji} and received *${achievement.points} points*!\n\nYour new total is *${user.gamification_points} points*.`;
      await whatsappService.sendTextMessage(userPhone, notification);
    } catch (error) {
      console.error(`Error in awardPoints for user ${userId}:`, error);
    }
  }

  // We can add the getDonorStatus function here later.
}

export default new GamificationService();