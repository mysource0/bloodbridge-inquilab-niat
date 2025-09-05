// backend/src/services/gamificationService.js
import db from '../config/db.js';
import whatsappService from './whatsappService.js';

const ACHIEVEMENTS = {
  FIRST_REGISTRATION: { name: 'Community Hero', points: 50, emoji: '❤️' },
  EMERGENCY_RESPONSE: { name: 'Life Saver', points: 100, emoji: '🚨' },
};

class GamificationService {
   async awardPoints(userId, event, userPhone) {
    const achievement = ACHIEVEMENTS[event];
    if (!achievement) return;

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

  /**
   * ✅ UPDATED: Fetches and formats a complete status report for a donor,
   * including their availability status.
   */
  async getDonorStatus(phone) {
    try {
      // Query now includes availability_status and cooldown_until
      const { rows: [user] } = await db.query(
        'SELECT id, name, gamification_points, last_donation, availability_status, cooldown_until FROM users WHERE phone = $1',
        [phone]
      );
      if (!user) {
        return "It looks like you're not registered as a donor yet. Reply with 'I want to register' to get started!";
      }
      
      const { rows: [rankData] } = await db.query(
        'SELECT count(*) FROM users WHERE user_type = \'donor\' AND gamification_points > $1',
        [user.gamification_points]
      );
      const rank = parseInt(rankData.count) + 1;

      // Format the availability status for the user
      let availabilityMessage = 'Available ✅';
      if (user.availability_status === 'unavailable' && user.cooldown_until) {
        const cooldownDate = new Date(user.cooldown_until).toLocaleDateString('en-IN');
        availabilityMessage = `On Cooldown until ${cooldownDate} ⏳`;
      } else if (user.availability_status !== 'available') {
        availabilityMessage = 'Not Available ❌';
      }

      let statusMessage = `*📊 Your Donor Dashboard 📊*\n\n`;
      statusMessage += `*Name:* ${user.name}\n`;
      statusMessage += `*Status:* ${availabilityMessage}\n`; // Add the status line
      statusMessage += `*Points:* ${user.gamification_points} 🏅\n`;
      statusMessage += `*Current Rank:* #${rank} of all our heroes\n`;
      statusMessage += `*Last Donation:* ${user.last_donation ? new Date(user.last_donation).toLocaleDateString('en-IN') : 'N/A'}`;
      
      return statusMessage;
    } catch (error) {
      console.error(`Error in getDonorStatus for phone ${phone}:`, error);
      return "Sorry, I couldn't fetch your status at this time. Please try again later.";
    }
  }

  /**
   * ✅ UPDATED: Fetches the Top 5 donors AND the requesting user's rank.
   */
  async getLeaderboardMessage(phone) {
    try {
      // Query 1: Get the Top 5 donors
      const { rows: topDonors } = await db.query(
        `SELECT name, gamification_points FROM users 
         WHERE user_type = 'donor' AND gamification_points > 0
         ORDER BY gamification_points DESC LIMIT 5`
      );

      if (topDonors.length === 0) {
        return "The leaderboard is empty right now, but the next donation could change that!";
      }

      // Query 2: Get the current user's rank
      const { rows: [userRankData] } = await db.query(
        `SELECT count(*) FROM users WHERE user_type = 'donor' AND gamification_points > (
           SELECT gamification_points FROM users WHERE phone = $1
         )`,
        [phone]
      );
      const userRank = parseInt(userRankData.count) + 1;

      // Format the message
      let leaderboardMessage = "🏆 *Top 5 Blood Warriors* 🏆\n\n";
      const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
      topDonors.forEach((donor, index) => {
        leaderboardMessage += `${medals[index]} *${donor.name}* (${donor.gamification_points} points)\n`;
      });
      leaderboardMessage += `\n*Your Rank:* #${userRank}`;

      return leaderboardMessage;
    } catch (error) {
      console.error('Error fetching leaderboard for chatbot:', error);
      return "Sorry, I couldn't fetch the leaderboard right now.";
    }
  }
}

export default new GamificationService();