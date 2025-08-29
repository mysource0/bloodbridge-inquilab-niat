// backend/src/services/geocodingService.js
import axios from 'axios';

class GeocodingService {
    async getCoords(address, city, pincode) {
        if (!address && !pincode) return null;
        const query = `${address || ''}, ${city || ''}, ${pincode || ''}`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'BloodBridgeAI/1.0 (tech@bloodbridge.org)' }
            });
            if (response.data && response.data.length > 0) {
                const { lat, lon } = response.data[0];
                return { latitude: parseFloat(lat), longitude: parseFloat(lon) };
            }
            return null;
        } catch (error) {
            console.error('Error calling Geocoding API:', error.message);
            return null;
        }
    }
}

export default new GeocodingService();