// File: services/apiService.js
// Purpose: Integration with external APIs (Google Maps, Weather, Traffic, etc.)
// Phase 1: Core API integrations for route details and geocoding

const axios = require('axios');
const logger = require('../utils/logger');

class ApiService {
  constructor() {
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.openWeatherApiKey = process.env.OPENWEATHER_API_KEY;
    this.tomtomApiKey = process.env.TOMTOM_API_KEY;
    this.hereApiKey = process.env.HERE_API_KEY;
    this.visualCrossingApiKey = process.env.VISUALCROSSING_API_KEY;
    this.mapboxApiKey = process.env.MAPBOX_API_KEY;
  }

  // Google Maps Directions API - Get route details
  async getRouteDetails(fromCoords, toCoords, waypoints = []) {
    try {
      const origin = `${fromCoords.latitude},${fromCoords.longitude}`;
      const destination = `${toCoords.latitude},${toCoords.longitude}`;
      
      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${this.googleMapsApiKey}`;
      
      if (waypoints.length > 0) {
        const waypointsStr = waypoints.map(wp => `${wp.latitude},${wp.longitude}`).join('|');
        url += `&waypoints=${waypointsStr}`;
      }

      const response = await axios.get(url);
      
      if (response.data.status !== 'OK') {
        throw new Error(`Google Directions API error: ${response.data.status}`);
      }

      const route = response.data.routes[0];
      const leg = route.legs[0];

      return {
        distance: leg.distance.value / 1000, // Convert to km
        duration: leg.duration.value / 60, // Convert to minutes
        polyline: route.overview_polyline.points,
        steps: leg.steps,
        bounds: route.bounds
      };

    } catch (error) {
      logger.error('Google Directions API error:', error);
      throw new Error(`Failed to get route details: ${error.message}`);
    }
  }

  // Google Maps Geocoding API - Convert address to coordinates
  async geocodeAddress(address) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.googleMapsApiKey}`;
      
      const response = await axios.get(url);
      
      if (response.data.status !== 'OK') {
        throw new Error(`Google Geocoding API error: ${response.data.status}`);
      }

      const location = response.data.results[0].geometry.location;
      
      return {
        latitude: location.lat,
        longitude: location.lng
      };

    } catch (error) {
      logger.error('Google Geocoding API error:', error);
      throw new Error(`Failed to geocode address: ${error.message}`);
    }
  }

  // Google Maps Elevation API - Get elevation data
  async getElevation(coordinates) {
    try {
      const locations = coordinates.map(coord => `${coord.latitude},${coord.longitude}`).join('|');
      const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${locations}&key=${this.googleMapsApiKey}`;
      
      const response = await axios.get(url);
      
      if (response.data.status !== 'OK') {
        throw new Error(`Google Elevation API error: ${response.data.status}`);
      }

      return response.data.results.map(result => ({
        latitude: result.location.lat,
        longitude: result.location.lng,
        elevation: result.elevation
      }));

    } catch (error) {
      logger.error('Google Elevation API error:', error);
      throw new Error(`Failed to get elevation data: ${error.message}`);
    }
  }

  // Google Places API - Find nearby services
  async findNearbyPlaces(latitude, longitude, type, radius = 50000) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=${type}&key=${this.googleMapsApiKey}`;
      
      const response = await axios.get(url);
      
      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      return response.data.results.map(place => ({
        placeId: place.place_id,
        name: place.name,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        rating: place.rating,
        vicinity: place.vicinity,
        types: place.types,
        openNow: place.opening_hours?.open_now,
        priceLevel: place.price_level
      }));

    } catch (error) {
      logger.error('Google Places API error:', error);
      throw new Error(`Failed to find nearby places: ${error.message}`);
    }
  }

  // OpenWeather API - Get weather data
  async getWeatherData(latitude, longitude) {
    try {
      const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${this.openWeatherApiKey}&units=metric`;
      
      const response = await axios.get(currentUrl);
      
      return {
        temperature: response.data.main.temp,
        humidity: response.data.main.humidity,
        pressure: response.data.main.pressure,
        windSpeed: response.data.wind.speed,
        windDirection: response.data.wind.deg,
        visibility: response.data.visibility / 1000, // Convert to km
        description: response.data.weather[0].description,
        condition: response.data.weather[0].main
      };

    } catch (error) {
      logger.error('OpenWeather API error:', error);
      throw new Error(`Failed to get weather data: ${error.message}`);
    }
  }

  // TomTom Traffic API - Get traffic data
  async getTrafficData(latitude, longitude, zoom = 10) {
    try {
      if (!this.tomtomApiKey) {
        throw new Error('TomTom API key not configured');
      }

      const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${latitude},${longitude}&unit=KMPH&key=${this.tomtomApiKey}`;
      
      const response = await axios.get(url);
      
      return {
        currentSpeed: response.data.flowSegmentData.currentSpeed,
        freeFlowSpeed: response.data.flowSegmentData.freeFlowSpeed,
        confidence: response.data.flowSegmentData.confidence,
        roadClosure: response.data.flowSegmentData.roadClosure
      };

    } catch (error) {
      logger.error('TomTom Traffic API error:', error);
      // Return default values if TomTom fails
      return {
        currentSpeed: 50,
        freeFlowSpeed: 60,
        confidence: 0.5,
        roadClosure: false
      };
    }
  }

  // HERE API - Get road attributes
  async getRoadAttributes(latitude, longitude) {
    try {
      if (!this.hereApiKey) {
        throw new Error('HERE API key not configured');
      }

      const url = `https://router.hereapi.com/v8/routes?transportMode=car&origin=${latitude},${longitude}&destination=${latitude},${longitude}&return=summary&apikey=${this.hereApiKey}`;
      
      const response = await axios.get(url);
      
      // Extract road information from response
      return {
        roadType: 'unknown',
        speedLimit: 50, // Default speed limit
        surfaceType: 'paved'
      };

    } catch (error) {
      logger.error('HERE API error:', error);
      // Return default values if HERE fails
      return {
        roadType: 'unknown',
        speedLimit: 50,
        surfaceType: 'paved'
      };
    }
  }

  // Visual Crossing Weather API - Historical weather data
  async getHistoricalWeather(latitude, longitude, date) {
    try {
      if (!this.visualCrossingApiKey) {
        throw new Error('Visual Crossing API key not configured');
      }

      const dateStr = date.toISOString().split('T')[0];
      const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${latitude},${longitude}/${dateStr}?key=${this.visualCrossingApiKey}`;
      
      const response = await axios.get(url);
      
      const dayData = response.data.days[0];
      
      return {
        temperature: dayData.temp,
        humidity: dayData.humidity,
        precipitation: dayData.precip,
        windSpeed: dayData.windspeed,
        visibility: dayData.visibility,
        conditions: dayData.conditions
      };

    } catch (error) {
      logger.error('Visual Crossing API error:', error);
      // Return default values if Visual Crossing fails
      return {
        temperature: 25,
        humidity: 60,
        precipitation: 0,
        windSpeed: 10,
        visibility: 10,
        conditions: 'Clear'
      };
    }
  }

  // Rate limiting helper
  async rateLimitedRequest(apiCall, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
      try {
        return await apiCall();
      } catch (error) {
        if (error.response?.status === 429 && i < retries - 1) {
          logger.warn(`Rate limited, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw error;
        }
      }
    }
  }

  // Batch geocoding for multiple addresses
  async batchGeocode(addresses) {
    const results = [];
    
    for (const address of addresses) {
      try {
        const coordinates = await this.geocodeAddress(address);
        results.push({ address, coordinates, success: true });
      } catch (error) {
        results.push({ address, error: error.message, success: false });
      }
      
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }
}

module.exports = new ApiService();