/**
 * WeatherService.js
 * Handles fetching weather and UV data from Open-Meteo API.
 */

class WeatherService {
    constructor() {
        this.baseUrl = "https://api.open-meteo.com/v1/forecast";
    }

    /**
     * Get weather and UV data for coordinates.
     * @param {number} lat 
     * @param {number} lon 
     */
    async getWeatherData(lat = 21.0285, lon = 105.8542) { // Default to Hanoi
        try {
            const url = `${this.baseUrl}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&hourly=uv_index&timezone=auto&forecast_days=1`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Weather API Error");
            
            const data = await response.json();
            
            // Get current UV index (closest hourly value)
            const hour = new Date().getHours();
            const uvIndex = data.hourly.uv_index[hour] || 0;

            // Fetch location name via reverse geocoding
            let locationName = "Hà Nội, VN";
            if (lat !== 21.0285 || lon !== 105.8542) {
                locationName = await this.getReverseGeocoding(lat, lon);
            }
            
            return {
                temp: data.current.temperature_2m,
                humidity: data.current.relative_humidity_2m,
                weatherCode: data.current.weather_code,
                uvIndex: uvIndex,
                location: locationName
            };
        } catch (error) {
            console.error("Failed to fetch weather:", error);
            return null;
        }
    }

    /**
     * Get human-readable location name from coordinates.
     */
    async getReverseGeocoding(lat, lon) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12&addressdetails=1`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'DermAI-Vision/1.0'
                }
            });
            if (!response.ok) return "Vị trí hiện tại";
            
            const data = await response.json();
            const addr = data.address;
            const city = addr.city || addr.town || addr.village || addr.suburb || addr.state || "Vị trí hiện tại";
            const country = addr.country_code ? addr.country_code.toUpperCase() : "";
            
            return country ? `${city}, ${country}` : city;
        } catch (error) {
            console.error("Reverse geocoding error:", error);
            return "Vị trí hiện tại";
        }
    }

    getUVAdvice(uvIndex) {
        if (uvIndex < 3) return { level: "Thấp", advice: "An toàn để ra ngoài. Cần dưỡng ẩm nhẹ.", color: "#10b981", video: "Mesh_strips_wave,_202603211318.mp4" };
        if (uvIndex < 6) return { level: "Trung bình", advice: "Nên che chắn khi ra ngoài lâu. Dùng kem chống nắng SPF 30+.", color: "#f59e0b", video: "Mesh_strips_wave,_202603211318.mp4" };
        if (uvIndex < 8) return { level: "Cao", advice: "Nguy cơ tổn thương da cao. Tránh nắng từ 10h-16h. Dùng SPF 50+.", color: "#ef4444", video: "sunny.mp4" };
        return { level: "Rất cao", advice: "Cực kỳ nguy hiểm. Hạn chế ra ngoài tối đa. Che chắn kỹ và dùng KCN mạnh.", color: "#7c3aed", video: "sunny.mp4" };
    }

    /**
     * Map Open-Meteo weather codes to a theme (video background).
     * @param {number} code 
     * @param {number} uvIndex
     */
    getWeatherTheme(code, uvIndex = 0) {
        // WMO Weather interpretation codes (WW)
        // https://open-meteo.com/en/docs
        
        // If UV is very high and it's not raining, treat as sunny
        if (uvIndex >= 6 && code <= 3) {
            return { type: "sunny", label: "Trời rất nắng", video: "sunny.mp4" };
        }

        if (code === 0 || code === 1 || code === 2) return { type: "sunny", label: "Trời nắng", video: "sunny.mp4" };
        if (code === 3) return { type: "cloudy", label: "Trời râm", video: "cloudy.mp4" };
        if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95)) 
            return { type: "rainy", label: "Trời mưa", video: "rainy.mp4" };
        
        // Default / Dull
        return { type: "dull", label: "Trời âm u", video: "cloudy.mp4" };
    }
}


export default new WeatherService();
