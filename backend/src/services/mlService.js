// backend/src/services/mlService.js
import axios from 'axios';
import db from '../config/db.js';
import config from '../config/config.js';

const CACHE_DURATION_HOURS = 6;

class MLService {
    constructor() {
        this.client = axios.create({
            baseURL: config.mlServiceUrl,
            timeout: 8000,
        });
    }

    /**
     * Scores a single donor, using a cached score if available and not stale.
     */
    async scoreSingleDonor(donor) {
        // Check for a fresh score in the cache first.
        const { rows: [cachedData] } = await db.query(
            "SELECT last_ml_score, score_cached_at FROM users WHERE id = $1",
            [donor.id]
        );

        if (cachedData && cachedData.last_ml_score && cachedData.score_cached_at) {
            const cacheAgeHours = (new Date() - new Date(cachedData.score_cached_at)) / (1000 * 60 * 60);
            if (cacheAgeHours < CACHE_DURATION_HOURS) {
                console.log(`CACHE HIT: Using cached score for donor ${donor.id}`);
                return { final_score: cachedData.last_ml_score };
            }
        }

        console.log(`CACHE MISS: Calling ML service for donor ${donor.id}`);
        try {
            // If no fresh cache, call the Python ML service.
            const response = await this.client.post('/score-donor', {
                donor_id: donor.id,
                last_donation_date: donor.last_donation,
                streak_count: donor.streak_count || 0,
                notifications_received: donor.notifications_received || 0,
                donations_confirmed: donor.donations_confirmed || 0
            });
            
            const newScore = response.data.final_score;

            // Update the cache in the database with the new score.
            db.query(
                "UPDATE users SET last_ml_score = $1, score_cached_at = NOW() WHERE id = $2",
                [newScore, donor.id]
            ).catch(err => console.error(`Failed to cache ML score for donor ${donor.id}:`, err));

            return { final_score: newScore };

        } catch (error) {
            console.error(`🔴 ML Service Error for donor ${donor.id}:`, error.message);
            throw error; // Re-throw the error to be handled by the calling service.
        }
    }
}

export default new MLService();