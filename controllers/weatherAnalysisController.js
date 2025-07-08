// File: controllers/weatherAnalysisController.js
const WeatherCondition = require('../models/WeatherCondition');

const weatherAnalysisController = {
  
  // GET /api/routes/:routeId/weather-analysis
  getWeatherAnalysis: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      const weatherData = await WeatherCondition.find({ routeId });
      
      const analysis = weatherData.length > 0 ? 
        this.analyzeActualWeatherData(weatherData) : 
        this.getDefaultWeatherAnalysis();

      res.json({
        success: true,
        data: {
          weatherAnalysis: analysis,
          seasonalRisks: this.getSeasonalRisks(),
          recommendations: this.getWeatherRecommendations(analysis)
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

  analyzeActualWeatherData: (weatherData) => {
    const seasons = ['summer', 'monsoon', 'autumn', 'winter'];
    const analysis = {};

    seasons.forEach(season => {
      const seasonData = weatherData.filter(data => 
        data.season === season || this.mapSeasonName(data.season) === season
      );

      if (seasonData.length > 0) {
        analysis[season] = {
          averageTemperature: `${Math.round(seasonData.reduce((sum, data) => sum + (data.averageTemperature || 25), 0) / seasonData.length)}°C`,
          averageRiskScore: Math.round((seasonData.reduce((sum, data) => sum + data.riskScore, 0) / seasonData.length) * 10) / 10,
          conditions: this.getDominantConditions(seasonData),
          riskAssessment: this.getSeasonRiskAssessment(season, seasonData)
        };
      } else {
        analysis[season] = this.getDefaultSeasonAnalysis(season);
      }
    });

    return analysis;
  },

  getDefaultWeatherAnalysis: () => {
    return {
      summer: {
        averageTemperature: "38°C",
        temperatureRange: "35°C - 45°C", 
        conditions: "Hot, dry, dust storms, occasional thunderstorms",
        riskAssessment: "High risk of vehicle overheating, tire blowouts, reduced visibility due to dust"
      },
      monsoon: {
        averageTemperature: "31°C",
        temperatureRange: "28°C - 35°C",
        conditions: "Heavy rainfall, thunderstorms, fog", 
        riskAssessment: "Flooding, waterlogging, slippery roads, landslides"
      },
      autumn: {
        averageTemperature: "28°C",
        temperatureRange: "25°C - 32°C",
        conditions: "Mild, pleasant, occasional rain, fog",
        riskAssessment: "Slippery roads post-rain, morning/evening fog"
      },
      winter: {
        averageTemperature: "12°C", 
        temperatureRange: "5°C - 20°C (Night: 0°C - 2°C)",
        conditions: "Cold, foggy mornings, frost at night, icy roads",
        riskAssessment: "Icy roads, black ice, frost, battery failure, poor visibility due to fog"
      }
    };
  },

  getSeasonalRisks: () => {
    return [
      {
        season: "Summer",
        majorRisks: ["Heat", "dust storms", "thermal damage"],
        keyDriverActions: ["Stay hydrated", "avoid peak hours"],
        keyVehicleChecks: ["Cooling system", "tire pressure"]
      },
      {
        season: "Monsoon", 
        majorRisks: ["Flooding", "low visibility"],
        keyDriverActions: ["Slow down", "use lights/wipers"],
        keyVehicleChecks: ["Brakes", "wipers", "electrical system check"]
      },
      {
        season: "Autumn",
        majorRisks: ["Fog", "dust", "wet roads"],
        keyDriverActions: ["Be cautious in foggy/damp conditions"], 
        keyVehicleChecks: ["Wiper blades", "regular cleaning"]
      },
      {
        season: "Winter",
        majorRisks: ["Ice", "fog", "frost", "weak battery"],
        keyDriverActions: ["Use winter tires", "reduce speed"],
        keyVehicleChecks: ["Antifreeze", "battery health", "fluids"]
      }
    ];
  },

  getWeatherRecommendations: (analysis) => {
    return [
      "Monitor seasonal weather patterns before travel",
      "Carry appropriate emergency supplies for each season",
      "Adjust travel times based on seasonal conditions",
      "Maintain vehicle according to seasonal requirements",
      "Keep emergency weather protection gear"
    ];
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
    return Object.keys(conditions).sort((a, b) => conditions[b] - conditions[a])[0] || 'clear';
  },

  getSeasonRiskAssessment: (season, seasonData) => {
    const avgRisk = seasonData.reduce((sum, data) => sum + data.riskScore, 0) / seasonData.length;
    
    if (avgRisk >= 7) return "High risk conditions - enhanced precautions required";
    if (avgRisk >= 5) return "Moderate risk conditions - standard precautions needed";
    return "Low risk conditions - normal precautions sufficient";
  },

  getDefaultSeasonAnalysis: (season) => {
    const defaults = {
      summer: { averageTemperature: "38°C", conditions: "Hot and dry", riskAssessment: "Heat-related risks" },
      monsoon: { averageTemperature: "31°C", conditions: "Wet and humid", riskAssessment: "Water-related risks" },
      autumn: { averageTemperature: "28°C", conditions: "Mild and pleasant", riskAssessment: "Fog-related risks" },
      winter: { averageTemperature: "12°C", conditions: "Cold and foggy", riskAssessment: "Cold-related risks" }
    };
    return defaults[season] || { averageTemperature: "25°C", conditions: "Variable", riskAssessment: "Standard risks" };
  }
};