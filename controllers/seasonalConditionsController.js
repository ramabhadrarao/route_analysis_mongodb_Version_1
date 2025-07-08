// File: controllers/seasonalConditionsController.js
// Purpose: Handle seasonal weather conditions and traffic patterns

const WeatherCondition = require('../models/WeatherCondition');
const TrafficData = require('../models/TrafficData');
const Route = require('../models/Route');

const seasonalConditionsController = {

  // GET /api/routes/:routeId/seasonal-conditions
  getSeasonalConditions: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      // Get weather data for different seasons
      const weatherData = await WeatherCondition.find({ routeId });
      
      // Process seasonal conditions based on the route data
      const seasonalConditions = this.processSeasonalData(weatherData, route);
      
      // Get weather-related accident zones
      const weatherAccidentZones = this.getWeatherAccidentZones();

      res.json({
        success: true,
        data: {
          seasonalConditions: seasonalConditions,
          weatherAccidentZones: weatherAccidentZones,
          routeSpecificData: {
            totalDistance: route.totalDistance,
            majorHighways: route.majorHighways || ['NH-344', 'NH-709'],
            terrain: route.terrain || 'Rural Plains'
          }
        },
        message: 'Seasonal conditions retrieved successfully'
      });

    } catch (error) {
      console.error('Error fetching seasonal conditions:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving seasonal conditions',
        error: error.message
      });
    }
  },

  // Process seasonal data based on actual weather conditions or provide defaults
  processSeasonalData: (weatherData, route) => {
    const seasons = ['summer', 'monsoon', 'post-monsoon', 'winter'];
    const seasonalConditions = [];

    seasons.forEach(season => {
      const seasonData = weatherData.filter(data => 
        data.season === season || this.mapSeasonName(data.season) === season
      );

      switch (season) {
        case 'summer':
          seasonalConditions.push(...this.getSummerConditions(seasonData, route));
          break;
        case 'monsoon':
          seasonalConditions.push(...this.getMonsoonConditions(seasonData, route));
          break;
        case 'post-monsoon':
          seasonalConditions.push(...this.getPostMonsoonConditions(seasonData, route));
          break;
        case 'winter':
          seasonalConditions.push(...this.getWinterConditions(seasonData, route));
          break;
      }
    });

    // Add toll plaza information
    seasonalConditions.push(this.getTollPlazaInfo(route));

    return seasonalConditions;
  },

  getSummerConditions: (seasonData, route) => {
    const conditions = [];
    
    // NH-344 Summer conditions
    conditions.push({
      season: "Summer (Apr-Jun)",
      criticalStretches: [
        {
          road: "NH-344",
          coordinates: { lat: 29.47233, lng: 77.15492 },
          challenges: "High temperatures -> vehicle overheating, tire blowouts",
          driverCaution: "Pre-check cooling systems and carry extra water",
          mapLink: "https://maps.app.goo.gl/Vipnj6uBn7yVbYkN8"
        },
        {
          road: "NH-709",
          coordinates: { lat: 29.20039, lng: 77.23554 },
          challenges: "High temperatures -> vehicle overheating, tire blowouts",
          driverCaution: "Pre-check cooling systems and carry extra water",
          mapLink: "https://maps.app.goo.gl/sTx9de9gwqyrJ4yK6"
        },
        {
          road: "Rural plains section",
          coordinates: { lat: 29.32311, lng: 77.23216 },
          challenges: "Extreme heat exposure, limited shade, dust storms",
          driverCaution: "Plan travel during cooler hours, carry sun protection",
          mapLink: "https://maps.app.goo.gl/EUCi34WzWc9yPbpw5"
        }
      ],
      temperatureRange: "35°C - 45°C",
      riskLevel: "High",
      recommendations: [
        "Travel during early morning hours (5 AM - 9 AM)",
        "Carry extra coolant and water",
        "Check tire pressure and condition before travel",
        "Avoid midday travel (11 AM - 4 PM)",
        "Use sun protection and cooling aids"
      ]
    });

    return conditions;
  },

  getMonsoonConditions: (seasonData, route) => {
    const conditions = [];
    
    conditions.push({
      season: "Monsoon (Jul-Sep)",
      criticalStretches: [
        {
          road: "NH-344",
          coordinates: { lat: 29.37410, lng: 77.24443 },
          challenges: "Waterlogging, reduced visibility, flooding",
          driverCaution: "Slow down, use wipers, headlights on, plan for delays",
          mapLink: "https://maps.app.goo.gl/hQdsWv42KK6UyzfX7"
        },
        {
          road: "NH-709",
          coordinates: { lat: 29.48548, lng: 77.26013 },
          challenges: "Waterlogging, reduced visibility, flooding",
          driverCaution: "Slow down, use wipers, headlights on, plan for delays",
          mapLink: "https://maps.app.goo.gl/seBjMKjw813qcNMXA"
        }
      ],
      temperatureRange: "28°C - 35°C",
      riskLevel: "High",
      recommendations: [
        "Avoid travel during heavy rainfall warnings",
        "Check weather forecasts hourly",
        "Carry emergency supplies and food",
        "Use headlights during daytime in rain",
        "Maintain 50% reduced speed in wet conditions",
        "Avoid flooded road sections"
      ]
    });

    return conditions;
  },

  getPostMonsoonConditions: (seasonData, route) => {
    const conditions = [];
    
    conditions.push({
      season: "Post-Monsoon/Autumn (Oct-Nov)",
      criticalStretches: [
        {
          road: "NH-344",
          coordinates: { lat: 29.37410, lng: 77.24443 },
          challenges: "Wet roads, occasional fog, unpredictable weather",
          driverCaution: "Carry rain gear, reduce speed, check tire tread depth",
          mapLink: "https://maps.app.goo.gl/vmbF2wGbjaTo4oHA6"
        },
        {
          road: "NH-709",
          coordinates: { lat: 29.20039, lng: 77.23554 },
          challenges: "Wet roads, occasional fog, unpredictable weather",
          driverCaution: "Carry rain gear, reduce speed, check tire tread depth",
          mapLink: "https://maps.app.goo.gl/PPt1m1EZRi9Mie54A"
        },
        {
          road: "Rural plains section",
          coordinates: { lat: 29.32311, lng: 77.23216 },
          challenges: "Wet roads, localized flooding after rains, cooler temperatures",
          driverCaution: "Check weather forecasts, avoid flooded areas, carry emergency supplies",
          mapLink: "https://maps.app.goo.gl/EbTV5hnYFP4ndUAj6"
        }
      ],
      temperatureRange: "25°C - 32°C",
      riskLevel: "Medium",
      recommendations: [
        "Check tire tread depth and condition",
        "Carry rain gear and warm clothing",
        "Monitor weather conditions closely",
        "Avoid driving through standing water",
        "Use fog lights when visibility is poor"
      ]
    });

    return conditions;
  },

  getWinterConditions: (seasonData, route) => {
    const conditions = [];
    
    conditions.push({
      season: "Winter (Dec-Mar)",
      criticalStretches: [
        {
          road: "NH-344",
          coordinates: { lat: 29.37410, lng: 77.24443 },
          challenges: "Morning fog, occasional frost, cold temperatures",
          driverCaution: "Use fog lights, reduce speed, allow extra time",
          mapLink: "https://maps.app.goo.gl/vmbF2wGbjaTo4oHA6"
        },
        {
          road: "Rural plains section",
          coordinates: { lat: 29.32311, lng: 77.23216 },
          challenges: "Dense fog, frost on roads, poor visibility",
          driverCaution: "Travel after sunrise, use fog lights, maintain safe distance",
          mapLink: "https://maps.app.goo.gl/EbTV5hnYFP4ndUAj6"
        }
      ],
      temperatureRange: "5°C - 20°C (Night: 0°C - 2°C)",
      riskLevel: "Medium",
      recommendations: [
        "Avoid early morning travel (5 AM - 8 AM) due to fog",
        "Carry warm clothing and blankets",
        "Check battery and antifreeze levels",
        "Use fog lights and maintain low speed",
        "Allow extra travel time",
        "Carry emergency heating supplies"
      ]
    });

    return conditions;
  },

  getTollPlazaInfo: (route) => {
    return {
      season: "Year-round",
      criticalStretches: [
        {
          road: "NH-709 - Estimated toll plaza",
          coordinates: { lat: 29.4, lng: 77.3 },
          challenges: "Buildup of queues during peak times, payment delays",
          driverCaution: "Plan breaks before toll, ensure lane discipline, keep exact change/FASTag ready",
          mapLink: "https://maps.app.goo.gl/zzsiCvE8ryD4rPVC8"
        }
      ],
      riskLevel: "Low",
      recommendations: [
        "Ensure FASTag is functional",
        "Keep cash ready as backup",
        "Plan for potential delays during peak hours",
        "Maintain lane discipline in toll approach"
      ]
    };
  },

  getWeatherAccidentZones: () => {
    return [
      {
        area: "NH-344 (Ghata Village)",
        weatherRisk: "Extreme Heat",
        riskType: "Tire Blowouts",
        solution: "Shade shelters, road resurfacing"
      },
      {
        area: "NH-709 (Ambeta)",
        weatherRisk: "Fog",
        riskType: "Low Visibility",
        solution: "Fog lights, reflective signs"
      },
      {
        area: "Putha Village Stretch",
        weatherRisk: "Frost",
        riskType: "Skidding",
        solution: "Apply salt/sand, use winter tires"
      },
      {
        area: "Oil Terminal Junctions",
        weatherRisk: "Rain/Fog",
        riskType: "Poor Visibility",
        solution: "Better signage, signalization"
      },
      {
        area: "Moti Filling Station Access",
        weatherRisk: "Rain/Fog",
        riskType: "Slippery Surfaces",
        solution: "Drainage improvement, widen shoulders"
      }
    ];
  },

  // GET /api/routes/:routeId/weather-analysis
  getWeatherAnalysis: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      const weatherData = await WeatherCondition.find({ routeId });
      
      if (!weatherData || weatherData.length === 0) {
        return res.status(200).json({
          success: true,
          data: this.getDefaultWeatherAnalysis(),
          message: 'Default weather analysis provided (no specific data available)'
        });
      }

      // Analyze weather data by season
      const seasonalAnalysis = {
        summer: this.analyzeSeasonData(weatherData, 'summer'),
        monsoon: this.analyzeSeasonData(weatherData, 'monsoon'),
        autumn: this.analyzeSeasonData(weatherData, 'autumn'),
        winter: this.analyzeSeasonData(weatherData, 'winter')
      };

      // Calculate overall weather risk
      const overallRisk = this.calculateOverallWeatherRisk(weatherData);

      res.json({
        success: true,
        data: {
          seasonalAnalysis: seasonalAnalysis,
          overallRisk: overallRisk,
          criticalWeatherZones: weatherData.filter(data => data.riskScore >= 7).length,
          averageRiskScore: weatherData.length > 0 ? 
            Math.round((weatherData.reduce((sum, data) => sum + data.riskScore, 0) / weatherData.length) * 10) / 10 : 0
        },
        message: 'Weather analysis completed successfully'
      });

    } catch (error) {
      console.error('Error in weather analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Error performing weather analysis',
        error: error.message
      });
    }
  },

  analyzeSeasonData: (weatherData, season) => {
    const seasonData = weatherData.filter(data => 
      data.season === season || this.mapSeasonName(data.season) === season
    );

    if (seasonData.length === 0) {
      return this.getDefaultSeasonData(season);
    }

    return {
      averageTemperature: seasonData.reduce((sum, data) => sum + (data.averageTemperature || 25), 0) / seasonData.length,
      averageRiskScore: seasonData.reduce((sum, data) => sum + data.riskScore, 0) / seasonData.length,
      dominantConditions: this.getDominantConditions(seasonData),
      riskAreas: seasonData.filter(data => data.riskScore >= 6).length,
      recommendations: this.getSeasonRecommendations(season, seasonData)
    };
  },

  getDefaultWeatherAnalysis: () => {
    return {
      seasonalAnalysis: {
        summer: {
          averageTemperature: 38,
          temperatureRange: "35°C - 45°C",
          conditions: "Hot, dry, dust storms, occasional thunderstorms",
          riskAssessment: "High risk of vehicle overheating, tire blowouts, reduced visibility due to dust"
        },
        monsoon: {
          averageTemperature: 31,
          temperatureRange: "28°C - 35°C",
          conditions: "Heavy rainfall, thunderstorms, fog",
          riskAssessment: "Flooding, waterlogging, slippery roads, landslides"
        },
        autumn: {
          averageTemperature: 28,
          temperatureRange: "25°C - 32°C",
          conditions: "Mild, pleasant, occasional rain, fog",
          riskAssessment: "Slippery roads post-rain, morning/evening fog"
        },
        winter: {
          averageTemperature: 12,
          temperatureRange: "5°C - 20°C (Night: 0°C - 2°C)",
          conditions: "Cold, foggy mornings, frost at night, icy roads",
          riskAssessment: "Icy roads, black ice, frost, battery failure, poor visibility due to fog"
        }
      }
    };
  },

  mapSeasonName: (season) => {
    const seasonMap = {
      'spring': 'summer',
      'summer': 'summer',
      'monsoon': 'monsoon',
      'rainy': 'monsoon',
      'autumn': 'autumn',
      'post-monsoon': 'autumn',
      'winter': 'winter'
    };
    return seasonMap[season?.toLowerCase()] || season;
  },

  getDominantConditions: (seasonData) => {
    const conditions = {};
    seasonData.forEach(data => {
      conditions[data.weatherCondition] = (conditions[data.weatherCondition] || 0) + 1;
    });
    
    return Object.keys(conditions).sort((a, b) => conditions[b] - conditions[a]);
  },

  getSeasonRecommendations: (season, seasonData) => {
    const baseRecommendations = {
      summer: [
        "Travel during cooler hours",
        "Carry extra water and coolant",
        "Check tire pressure regularly",
        "Use sun protection"
      ],
      monsoon: [
        "Monitor weather forecasts",
        "Reduce speed in wet conditions", 
        "Use headlights during rain",
        "Avoid flooded areas"
      ],
      autumn: [
        "Check tire tread depth",
        "Carry rain gear",
        "Monitor fog conditions",
        "Allow extra travel time"
      ],
      winter: [
        "Use fog lights",
        "Avoid early morning travel",
        "Check battery condition",
        "Carry warm clothing"
      ]
    };

    return baseRecommendations[season] || [];
  },

  calculateOverallWeatherRisk: (weatherData) => {
    if (!weatherData || weatherData.length === 0) {
      return { level: 'Medium', score: 3, description: 'Seasonal weather variations expected' };
    }

    const avgRisk = weatherData.reduce((sum, data) => sum + data.riskScore, 0) / weatherData.length;
    
    if (avgRisk >= 7) {
      return { level: 'High', score: avgRisk, description: 'Significant weather-related risks identified' };
    } else if (avgRisk >= 5) {
      return { level: 'Medium', score: avgRisk, description: 'Moderate weather-related precautions required' };
    } else {
      return { level: 'Low', score: avgRisk, description: 'Standard weather precautions sufficient' };
    }
  },

  getDefaultSeasonData: (season) => {
    const defaults = {
      summer: { averageTemperature: 38, averageRiskScore: 7, riskAreas: 3 },
      monsoon: { averageTemperature: 31, averageRiskScore: 6, riskAreas: 4 },
      autumn: { averageTemperature: 28, averageRiskScore: 4, riskAreas: 2 },
      winter: { averageTemperature: 12, averageRiskScore: 5, riskAreas: 2 }
    };
    
    return defaults[season] || { averageTemperature: 25, averageRiskScore: 3, riskAreas: 1 };
  }
};

module.exports = seasonalConditionsController;