// File: controllers/seasonalConditionsController.js (DYNAMIC VERSION)
// Purpose: Handle DYNAMIC seasonal weather conditions based on actual route data
// ENHANCEMENT: Uses real route points, weather data, and geographic analysis

const WeatherCondition = require('../models/WeatherCondition');
const TrafficData = require('../models/TrafficData');
const Route = require('../models/Route');
const mongoose = require('mongoose');

const seasonalConditionsController = {

  // GET /api/routes/:routeId/seasonal-conditions
  getSeasonalConditions: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      // Verify route exists and get complete route data
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      console.log(`🌦️ Analyzing seasonal conditions for route: ${route.routeId}`);

      // Get actual weather data for this route
      const weatherData = await WeatherCondition.find({ routeId });
      
      // Analyze route geography for climate zones
      const climateAnalysis = analyzeRouteClimate(route);
      
      // Generate DYNAMIC seasonal conditions based on actual route data
      const seasonalConditions = await generateDynamicSeasonalConditions(route, weatherData, climateAnalysis);
      
      // Get route-specific weather accident zones
      const weatherAccidentZones = await identifyRouteWeatherRisks(route, weatherData);

      // Generate route-specific recommendations
      const routeRecommendations = generateRouteSpecificRecommendations(route, seasonalConditions);

      res.json({
        success: true,
        data: {
          routeInfo: {
            routeId: route.routeId,
            routeName: route.routeName,
            fromLocation: route.fromName,
            toLocation: route.toName,
            totalDistance: route.totalDistance,
            terrain: route.terrain,
            actualHighways: route.majorHighways || extractHighwaysFromRoute(route)
          },
          climateAnalysis: climateAnalysis,
          seasonalConditions: seasonalConditions,
          weatherAccidentZones: weatherAccidentZones,
          routeSpecificRecommendations: routeRecommendations,
          dataQuality: {
            weatherDataPoints: weatherData.length,
            routeGPSPoints: route.routePoints?.length || 0,
            analysisMethod: weatherData.length > 0 ? 'REAL_DATA' : 'GEOGRAPHIC_ESTIMATION',
            lastUpdated: new Date()
          }
        },
        message: `Dynamic seasonal analysis completed for ${route.totalDistance}km route`
      });

    } catch (error) {
      console.error('Error fetching dynamic seasonal conditions:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving seasonal conditions',
        error: error.message
      });
    }
  },

  // GET /api/routes/:routeId/weather-analysis  
  getWeatherAnalysis: async (req, res) => {
    try {
      const { routeId } = req.params;
      
      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({
          success: false,
          message: 'Route not found'
        });
      }

      const weatherData = await WeatherCondition.find({ routeId });
      
      let analysis;
      if (weatherData && weatherData.length > 0) {
        // Use REAL weather data
        analysis = await performRealWeatherAnalysis(route, weatherData);
      } else {
        // Generate GEOGRAPHIC weather analysis based on route location
        analysis = await performGeographicWeatherAnalysis(route);
      }

      res.json({
        success: true,
        data: {
          routeInfo: {
            routeId: route.routeId,
            routeName: route.routeName,
            fromLocation: route.fromName,
            toLocation: route.toName
          },
          weatherAnalysis: analysis,
          dataSource: weatherData.length > 0 ? 'REAL_WEATHER_DATA' : 'GEOGRAPHIC_CLIMATE_MODEL',
          confidence: weatherData.length > 0 ? 'HIGH' : 'MEDIUM'
        },
        message: 'Dynamic weather analysis completed successfully'
      });

    } catch (error) {
      console.error('Error in dynamic weather analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Error performing weather analysis',
        error: error.message
      });
    }
  }
};

// ============================================================================
// DYNAMIC ANALYSIS FUNCTIONS
// ============================================================================

function analyzeRouteClimate(route) {
  // Analyze route coordinates to determine climate characteristics
  const startLat = route.fromCoordinates?.latitude;
  const startLng = route.fromCoordinates?.longitude;
  const endLat = route.toCoordinates?.latitude;
  const endLng = route.toCoordinates?.longitude;

  if (!startLat || !startLng || !endLat || !endLng) {
    return getDefaultClimateAnalysis();
  }

  // Determine climate zone based on geographic location
  const avgLat = (startLat + endLat) / 2;
  const avgLng = (startLng + endLng) / 2;
  
  // Climate analysis based on Indian geography
  const climateZone = determineIndianClimateZone(avgLat, avgLng);
  const elevationEstimate = estimateElevationFromTerrain(route.terrain);
  const coastalProximity = calculateCoastalProximity(avgLat, avgLng);

  return {
    primaryClimateZone: climateZone,
    avgLatitude: Math.round(avgLat * 1000) / 1000,
    avgLongitude: Math.round(avgLng * 1000) / 1000,
    estimatedElevation: elevationEstimate,
    coastalInfluence: coastalProximity,
    monsoonIntensity: calculateMonsoonIntensity(avgLat, avgLng),
    temperatureRange: getTemperatureRangeForZone(climateZone),
    rainfallPattern: getRainfallPattern(avgLat, avgLng),
    extremeWeatherRisk: calculateExtremeWeatherRisk(climateZone, route.terrain)
  };
}

async function generateDynamicSeasonalConditions(route, weatherData, climateAnalysis) {
  const conditions = [];
  const seasons = ['summer', 'monsoon', 'autumn', 'winter'];

  for (const season of seasons) {
    // Get real weather data for this season if available
    const seasonWeatherData = weatherData.filter(data => 
      data.season === season || mapSeasonName(data.season) === season
    );

    // Generate season-specific conditions based on route and climate
    const seasonCondition = await generateSeasonCondition(
      season, 
      route, 
      seasonWeatherData, 
      climateAnalysis
    );
    
    conditions.push(seasonCondition);
  }

  return conditions;
}

async function generateSeasonCondition(season, route, seasonWeatherData, climateAnalysis) {
  // Generate DYNAMIC critical stretches based on actual route points
  const criticalStretches = await identifyRouteCriticalStretches(route, season, seasonWeatherData);
  
  // Calculate season-specific risks based on climate and route data
  const seasonRisks = calculateSeasonSpecificRisks(season, climateAnalysis, route.terrain);
  
  // Generate realistic temperature ranges based on location
  const temperatureRange = calculateSeasonTemperature(season, climateAnalysis);
  
  // Get season-specific recommendations based on actual route characteristics
  const recommendations = generateSeasonRecommendations(season, route, climateAnalysis, seasonRisks);

  return {
    season: getSeasonDisplayName(season),
    climateZone: climateAnalysis.primaryClimateZone,
    criticalStretches: criticalStretches,
    temperatureRange: temperatureRange,
    riskLevel: seasonRisks.overallRisk,
    primaryChallenges: seasonRisks.challenges,
    recommendations: recommendations,
    dataSource: seasonWeatherData.length > 0 ? 'REAL_DATA' : 'CLIMATE_MODEL',
    confidence: seasonWeatherData.length > 0 ? 0.9 : 0.7
  };
}

async function identifyRouteCriticalStretches(route, season, seasonWeatherData) {
  const stretches = [];
  
  // Use actual route points if available
  if (route.routePoints && route.routePoints.length > 0) {
    // Analyze route in segments
    const segmentSize = Math.max(1, Math.floor(route.routePoints.length / 5)); // 5 segments
    
    for (let i = 0; i < route.routePoints.length; i += segmentSize) {
      const segment = route.routePoints.slice(i, i + segmentSize);
      const midPoint = segment[Math.floor(segment.length / 2)];
      
      // Find nearest weather data
      const nearestWeatherData = findNearestWeatherData(midPoint, seasonWeatherData);
      
      const stretch = {
        road: `Route segment ${Math.floor(i / segmentSize) + 1}`,
        coordinates: {
          lat: midPoint.latitude,
          lng: midPoint.longitude
        },
        distanceFromStart: midPoint.distanceFromStart || (i / route.routePoints.length) * route.totalDistance,
        challenges: getSeasonChallenges(season, nearestWeatherData, route.terrain),
        driverCaution: getSeasonDriverCaution(season, nearestWeatherData),
        riskScore: nearestWeatherData?.riskScore || calculateEstimatedRisk(season, route.terrain),
        mapLink: `https://www.google.com/maps/place/${midPoint.latitude},${midPoint.longitude}`
      };
      
      stretches.push(stretch);
    }
  } else {
    // Fallback: Create stretches based on start/end points
    const midLat = (route.fromCoordinates.latitude + route.toCoordinates.latitude) / 2;
    const midLng = (route.fromCoordinates.longitude + route.toCoordinates.longitude) / 2;
    
    stretches.push({
      road: `${route.fromName} to ${route.toName}`,
      coordinates: { lat: midLat, lng: midLng },
      distanceFromStart: route.totalDistance / 2,
      challenges: getSeasonChallenges(season, null, route.terrain),
      driverCaution: getSeasonDriverCaution(season, null),
      riskScore: calculateEstimatedRisk(season, route.terrain),
      mapLink: `https://www.google.com/maps/place/${midLat},${midLng}`
    });
  }
  
  return stretches;
}

async function identifyRouteWeatherRisks(route, weatherData) {
  const risks = [];
  
  // Identify high-risk weather zones along the actual route
  const highRiskWeatherData = weatherData.filter(data => data.riskScore >= 6);
  
  if (highRiskWeatherData.length > 0) {
    // Use real weather risk data
    highRiskWeatherData.forEach(data => {
      risks.push({
        area: `Route point at ${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`,
        weatherRisk: data.weatherCondition,
        riskType: determineRiskType(data.weatherCondition, data.riskScore),
        severity: data.riskScore,
        season: data.season,
        solution: generateRiskSolution(data.weatherCondition, data.riskScore),
        coordinates: { lat: data.latitude, lng: data.longitude }
      });
    });
  } else {
    // Generate estimated risks based on route characteristics
    risks.push(...generateEstimatedWeatherRisks(route));
  }
  
  return risks;
}

function generateRouteSpecificRecommendations(route, seasonalConditions) {
  const recommendations = {
    routeSpecific: [],
    seasonal: [],
    emergency: [],
    timing: []
  };

  // Route-specific recommendations
  if (route.terrain === 'hilly') {
    recommendations.routeSpecific.push('Check brake fluid and cooling system for hilly terrain');
    recommendations.routeSpecific.push('Use engine braking on descents');
  }
  
  if (route.terrain === 'rural') {
    recommendations.routeSpecific.push('Carry extra fuel - limited fuel stations in rural areas');
    recommendations.routeSpecific.push('Inform others of travel plans due to remote route');
  }

  if (route.totalDistance > 200) {
    recommendations.routeSpecific.push('Plan mandatory rest stops every 2 hours for long route');
    recommendations.routeSpecific.push('Carry emergency supplies for extended journey');
  }

  // Seasonal recommendations based on analysis
  const highRiskSeasons = seasonalConditions.filter(s => s.riskLevel === 'High' || s.riskLevel === 'Critical');
  if (highRiskSeasons.length > 0) {
    recommendations.seasonal.push(`Avoid travel during: ${highRiskSeasons.map(s => s.season).join(', ')}`);
    recommendations.seasonal.push('Monitor weather forecasts 24 hours before travel');
  }

  // Emergency recommendations
  recommendations.emergency.push('Carry satellite communication device for remote areas');
  recommendations.emergency.push('Share real-time location with control room');
  
  // Timing recommendations
  const bestSeasons = seasonalConditions.filter(s => s.riskLevel === 'Low' || s.riskLevel === 'Medium');
  if (bestSeasons.length > 0) {
    recommendations.timing.push(`Optimal travel seasons: ${bestSeasons.map(s => s.season).join(', ')}`);
  }

  return recommendations;
}

// ============================================================================
// GEOGRAPHIC CLIMATE ANALYSIS FUNCTIONS
// ============================================================================

function determineIndianClimateZone(lat, lng) {
  // Indian climate zone determination based on coordinates
  if (lat > 30) return 'Himalayan';
  if (lat > 25 && lng < 78) return 'Northern Plains';
  if (lat > 23 && lng > 85) return 'Eastern';
  if (lat < 15 && lng > 75) return 'Southern Peninsula';
  if (lng < 72) return 'Western';
  if (lat > 20) return 'Central';
  return 'Tropical';
}

function calculateMonsoonIntensity(lat, lng) {
  // Calculate monsoon intensity based on Indian geography
  if (lng < 72) return 'Very High'; // Western coast
  if (lat < 15) return 'High'; // Southern India
  if (lat > 25 && lng > 85) return 'Very High'; // Northeast
  if (lat > 25) return 'Medium'; // Northern plains
  return 'High';
}

function getTemperatureRangeForZone(climateZone) {
  const ranges = {
    'Himalayan': { summer: '15°C - 25°C', winter: '-5°C - 10°C' },
    'Northern Plains': { summer: '35°C - 45°C', winter: '5°C - 20°C' },
    'Eastern': { summer: '30°C - 40°C', winter: '10°C - 25°C' },
    'Southern Peninsula': { summer: '28°C - 38°C', winter: '15°C - 28°C' },
    'Western': { summer: '30°C - 40°C', winter: '15°C - 30°C' },
    'Central': { summer: '35°C - 45°C', winter: '10°C - 25°C' },
    'Tropical': { summer: '28°C - 35°C', winter: '20°C - 30°C' }
  };
  
  return ranges[climateZone] || ranges['Central'];
}

function calculateSeasonTemperature(season, climateAnalysis) {
  const ranges = getTemperatureRangeForZone(climateAnalysis.primaryClimateZone);
  
  switch (season) {
    case 'summer':
      return ranges.summer;
    case 'winter':
      return ranges.winter;
    case 'monsoon':
      // Monsoon temperatures are usually moderate
      const summerMax = parseInt(ranges.summer.split(' - ')[1]);
      const winterMin = parseInt(ranges.winter.split(' - ')[0]);
      const monsoonMin = Math.max(winterMin, summerMax - 15);
      const monsoonMax = summerMax - 5;
      return `${monsoonMin}°C - ${monsoonMax}°C`;
    case 'autumn':
      // Autumn is between monsoon and winter
      const winterMax = parseInt(ranges.winter.split(' - ')[1]);
      const autumnMin = parseInt(ranges.winter.split(' - ')[0]) + 5;
      const autumnMax = winterMax + 8;
      return `${autumnMin}°C - ${autumnMax}°C`;
    default:
      return ranges.summer;
  }
}

function getSeasonChallenges(season, weatherData, terrain) {
  if (weatherData) {
    // Use real weather data challenges
    return `${weatherData.weatherCondition} conditions with risk score ${weatherData.riskScore}`;
  }
  
  // Generate challenges based on season and terrain
  const seasonChallenges = {
    summer: {
      'hilly': 'Overheating on steep climbs, tire stress',
      'rural': 'Extreme heat, dust storms, limited shade',
      'urban': 'Heat islands, AC strain, tire blowouts',
      'mixed': 'Variable heat exposure, vehicle stress',
      'flat': 'Uniform heat exposure, mirages'
    },
    monsoon: {
      'hilly': 'Landslides, waterlogging, poor traction',
      'rural': 'Flooding, muddy roads, poor drainage',
      'urban': 'Traffic jams, waterlogging, reduced visibility',
      'mixed': 'Variable flooding and visibility issues',
      'flat': 'Standing water, hydroplaning risk'
    },
    autumn: {
      'hilly': 'Morning fog, temperature variations',
      'rural': 'Unpredictable weather, crop burning smoke',
      'urban': 'Air quality issues, fog',
      'mixed': 'Variable weather conditions',
      'flat': 'Fog formation, dew on roads'
    },
    winter: {
      'hilly': 'Frost, ice formation, cold starts',
      'rural': 'Dense fog, frost, cold exposure',
      'urban': 'Fog, pollution, cold starts',
      'mixed': 'Variable fog and frost conditions',
      'flat': 'Widespread fog, frost formation'
    }
  };
  
  return seasonChallenges[season]?.[terrain] || 'General seasonal challenges';
}

function getSeasonDriverCaution(season, weatherData) {
  if (weatherData) {
    return `Exercise caution due to ${weatherData.weatherCondition} - reduce speed and increase following distance`;
  }
  
  const cautions = {
    summer: 'Check cooling system, carry extra water, avoid midday travel',
    monsoon: 'Reduce speed by 50%, use headlights, avoid flooded areas',
    autumn: 'Monitor weather changes, carry rain gear, check tire condition',
    winter: 'Use fog lights, allow extra time, check battery condition'
  };
  
  return cautions[season] || 'Exercise appropriate seasonal caution';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function findNearestWeatherData(routePoint, weatherData) {
  if (!weatherData || weatherData.length === 0) return null;
  
  let nearest = weatherData[0];
  let minDistance = calculateDistance(
    routePoint.latitude, routePoint.longitude,
    nearest.latitude, nearest.longitude
  );
  
  for (const data of weatherData) {
    const distance = calculateDistance(
      routePoint.latitude, routePoint.longitude,
      data.latitude, data.longitude
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearest = data;
    }
  }
  
  return nearest;
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  // Haversine formula for distance calculation
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateEstimatedRisk(season, terrain) {
  const riskMatrix = {
    summer: { 'hilly': 7, 'rural': 6, 'urban': 5, 'mixed': 6, 'flat': 5 },
    monsoon: { 'hilly': 8, 'rural': 7, 'urban': 6, 'mixed': 7, 'flat': 6 },
    autumn: { 'hilly': 5, 'rural': 4, 'urban': 4, 'mixed': 4, 'flat': 3 },
    winter: { 'hilly': 6, 'rural': 5, 'urban': 4, 'mixed': 5, 'flat': 4 }
  };
  
  return riskMatrix[season]?.[terrain] || 4;
}

function getSeasonDisplayName(season) {
  const names = {
    summer: 'Summer (Apr-Jun)',
    monsoon: 'Monsoon (Jul-Sep)', 
    autumn: 'Post-Monsoon/Autumn (Oct-Nov)',
    winter: 'Winter (Dec-Mar)'
  };
  return names[season] || season;
}

function mapSeasonName(season) {
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
}

// Additional helper functions
function getDefaultClimateAnalysis() {
  return {
    primaryClimateZone: 'Central',
    avgLatitude: 20.0,
    avgLongitude: 77.0,
    estimatedElevation: 'Plain (0-300m)',
    coastalInfluence: 'Minimal',
    monsoonIntensity: 'High',
    temperatureRange: { summer: '35°C - 45°C', winter: '10°C - 25°C' },
    rainfallPattern: 'Monsoon-dominated',
    extremeWeatherRisk: 'Medium'
  };
}

function extractHighwaysFromRoute(route) {
  // Try to extract highway information from route name or description
  const routeText = `${route.routeName} ${route.fromName} ${route.toName}`.toUpperCase();
  const highways = [];
  
  // Look for highway patterns
  const nhPattern = /NH[- ]?(\d+)/g;
  const shPattern = /SH[- ]?(\d+)/g;
  
  let match;
  while ((match = nhPattern.exec(routeText)) !== null) {
    highways.push(`NH-${match[1]}`);
  }
  while ((match = shPattern.exec(routeText)) !== null) {
    highways.push(`SH-${match[1]}`);
  }
  
  return highways.length > 0 ? highways : ['Route highways not identified'];
}

function estimateElevationFromTerrain(terrain) {
  const elevations = {
    'flat': 'Plain (0-200m)',
    'hilly': 'Hilly (200-1000m)',
    'urban': 'Urban (50-300m)',
    'rural': 'Rural Plain (50-500m)',
    'mixed': 'Variable (50-800m)'
  };
  return elevations[terrain] || 'Variable elevation';
}

function calculateCoastalProximity(lat, lng) {
  // Simplified coastal proximity for Indian subcontinent
  if (lng < 72 || lng > 85 || lat < 8) return 'Coastal influence';
  return 'Inland';
}

function getRainfallPattern(lat, lng) {
  if (lng < 72) return 'Heavy Western Ghats monsoon';
  if (lat > 25 && lng > 85) return 'Heavy Northeast monsoon';
  if (lat < 15) return 'Dual monsoon (SW + NE)';
  return 'Southwest monsoon dominant';
}

function calculateExtremeWeatherRisk(climateZone, terrain) {
  if (climateZone === 'Himalayan') return 'High (snow, avalanche)';
  if (terrain === 'hilly' && climateZone === 'Western') return 'High (landslides)';
  if (climateZone === 'Northern Plains') return 'High (extreme heat/cold)';
  return 'Medium';
}

async function performRealWeatherAnalysis(route, weatherData) {
  // Analysis using real weather data
  const seasonalAnalysis = {};
  const seasons = ['summer', 'monsoon', 'autumn', 'winter'];
  
  for (const season of seasons) {
    const seasonData = weatherData.filter(w => w.season === season);
    if (seasonData.length > 0) {
      seasonalAnalysis[season] = {
        averageTemperature: seasonData.reduce((sum, w) => sum + (w.averageTemperature || 25), 0) / seasonData.length,
        averageRiskScore: seasonData.reduce((sum, w) => sum + w.riskScore, 0) / seasonData.length,
        dominantConditions: getDominantConditions(seasonData),
        riskAreas: seasonData.filter(w => w.riskScore >= 6).length,
        dataPoints: seasonData.length
      };
    }
  }
  
  return {
    seasonalAnalysis,
    overallRisk: calculateOverallWeatherRisk(weatherData),
    dataQuality: 'HIGH - Based on real weather measurements',
    totalDataPoints: weatherData.length
  };
}

async function performGeographicWeatherAnalysis(route) {
  const climateAnalysis = analyzeRouteClimate(route);
  
  return {
    seasonalAnalysis: {
      summer: {
        averageTemperature: 38,
        estimatedRisk: calculateEstimatedRisk('summer', route.terrain),
        climateZone: climateAnalysis.primaryClimateZone,
        characteristics: getSeasonChallenges('summer', null, route.terrain)
      },
      monsoon: {
        averageTemperature: 31,
        estimatedRisk: calculateEstimatedRisk('monsoon', route.terrain),
        climateZone: climateAnalysis.primaryClimateZone,
        characteristics: getSeasonChallenges('monsoon', null, route.terrain)
      },
      autumn: {
        averageTemperature: 28,
        estimatedRisk: calculateEstimatedRisk('autumn', route.terrain),
        climateZone: climateAnalysis.primaryClimateZone,
        characteristics: getSeasonChallenges('autumn', null, route.terrain)
      },
      winter: {
        averageTemperature: 15,
        estimatedRisk: calculateEstimatedRisk('winter', route.terrain),
        climateZone: climateAnalysis.primaryClimateZone,
        characteristics: getSeasonChallenges('winter', null, route.terrain)
      }
    },
    overallRisk: { level: 'Medium', description: 'Geographic climate model estimation' },
    dataQuality: 'MEDIUM - Based on geographic climate modeling',
    totalDataPoints: 0
  };
}

function getDominantConditions(seasonData) {
  const conditions = {};
  seasonData.forEach(data => {
    conditions[data.weatherCondition] = (conditions[data.weatherCondition] || 0) + 1;
  });
  return Object.keys(conditions).sort((a, b) => conditions[b] - conditions[a]);
}

function calculateOverallWeatherRisk(weatherData) {
  if (!weatherData || weatherData.length === 0) {
    return { level: 'Medium', score: 3, description: 'No specific weather data available' };
  }

  const avgRisk = weatherData.reduce((sum, data) => sum + data.riskScore, 0) / weatherData.length;
  
  if (avgRisk >= 7) {
    return { level: 'High', score: avgRisk, description: 'Significant weather-related risks identified' };
  } else if (avgRisk >= 5) {
    return { level: 'Medium', score: avgRisk, description: 'Moderate weather-related precautions required' };
  } else {
    return { level: 'Low', score: avgRisk, description: 'Standard weather precautions sufficient' };
  }
}

function determineRiskType(weatherCondition, riskScore) {
  const riskTypes = {
    'rainy': 'Flooding and slippery roads',
    'foggy': 'Poor visibility',
    'stormy': 'High winds and precipitation', 
    'icy': 'Ice formation and skidding',
    'clear': riskScore > 6 ? 'Extreme temperatures' : 'Standard conditions'
  };
  return riskTypes[weatherCondition] || 'Weather-related hazard';
}

function generateRiskSolution(weatherCondition, riskScore) {
  const solutions = {
    'rainy': 'Install better drainage, improve road surface, add warning signs',
    'foggy': 'Install fog lights, reflective markers, reduce speed limits',
    'stormy': 'Temporary route closure protocols, wind barriers, early warning systems',
    'icy': 'Apply salt/sand, install heating elements, use winter tires',
    'clear': riskScore > 6 ? 'Shade structures, cooling stations, temperature monitoring' : 'Standard maintenance'
  };
  return solutions[weatherCondition] || 'Implement weather-appropriate safety measures';
}

function generateEstimatedWeatherRisks(route) {
  const risks = [];
  
  // Generate risks based on route characteristics and location
  const climate = analyzeRouteClimate(route);
  
  if (climate.monsoonIntensity === 'Very High' || climate.monsoonIntensity === 'High') {
    risks.push({
      area: `${route.fromName} to ${route.toName} corridor`,
      weatherRisk: 'Heavy Monsoon',
      riskType: 'Flooding and waterlogging',
      severity: 7,
      season: 'monsoon',
      solution: 'Improve drainage systems, install flood warning systems',
      coordinates: {
        lat: (route.fromCoordinates.latitude + route.toCoordinates.latitude) / 2,
        lng: (route.fromCoordinates.longitude + route.toCoordinates.longitude) / 2
      }
    });
  }
  
  if (climate.primaryClimateZone === 'Northern Plains') {
    risks.push({
      area: `Route through ${climate.primaryClimateZone}`,
      weatherRisk: 'Extreme Heat',
      riskType: 'Vehicle overheating and tire blowouts',
      severity: 6,
      season: 'summer',
      solution: 'Cooling stations, shade structures, heat-resistant road surface',
      coordinates: {
        lat: (route.fromCoordinates.latitude + route.toCoordinates.latitude) / 2,
        lng: (route.fromCoordinates.longitude + route.toCoordinates.longitude) / 2
      }
    });
  }
  
  if (route.terrain === 'hilly') {
    risks.push({
      area: `Hilly sections of route`,
      weatherRisk: 'Fog and Landslides',
      riskType: 'Poor visibility and slope instability',
      severity: 6,
      season: 'monsoon',
      solution: 'Fog detection systems, slope stabilization, drainage',
      coordinates: {
        lat: (route.fromCoordinates.latitude + route.toCoordinates.latitude) / 2,
        lng: (route.fromCoordinates.longitude + route.toCoordinates.longitude) / 2
      }
    });
  }
  
  return risks;
}

function calculateSeasonSpecificRisks(season, climateAnalysis, terrain) {
  const risks = {
    overallRisk: 'Medium',
    challenges: [],
    specificFactors: []
  };
  
  // Calculate risk based on season, climate, and terrain
  let riskScore = 3; // Base risk
  
  // Season-specific risk factors
  if (season === 'summer') {
    if (climateAnalysis.primaryClimateZone === 'Northern Plains') {
      riskScore += 3;
      risks.challenges.push('Extreme heat (up to 45°C)');
    }
    if (terrain === 'hilly') {
      riskScore += 2;
      risks.challenges.push('Vehicle overheating on climbs');
    }
    risks.specificFactors.push('Heat stress', 'Tire degradation', 'Cooling system strain');
  }
  
  if (season === 'monsoon') {
    if (climateAnalysis.monsoonIntensity === 'Very High') {
      riskScore += 4;
      risks.challenges.push('Heavy rainfall and flooding');
    }
    if (terrain === 'hilly') {
      riskScore += 3;
      risks.challenges.push('Landslide risk');
    }
    risks.specificFactors.push('Waterlogging', 'Poor visibility', 'Slippery roads');
  }
  
  if (season === 'winter') {
    if (climateAnalysis.primaryClimateZone === 'Northern Plains' || climateAnalysis.primaryClimateZone === 'Himalayan') {
      riskScore += 2;
      risks.challenges.push('Fog and frost formation');
    }
    risks.specificFactors.push('Fog', 'Cold starts', 'Reduced visibility');
  }
  
  if (season === 'autumn') {
    riskScore += 1;
    risks.challenges.push('Unpredictable weather patterns');
    risks.specificFactors.push('Variable conditions', 'Post-monsoon flooding');
  }
  
  // Determine overall risk level
  if (riskScore >= 8) risks.overallRisk = 'Critical';
  else if (riskScore >= 6) risks.overallRisk = 'High';
  else if (riskScore >= 4) risks.overallRisk = 'Medium';
  else risks.overallRisk = 'Low';
  
  return risks;
}

function generateSeasonRecommendations(season, route, climateAnalysis, seasonRisks) {
  const recommendations = [];
  
  // Base season recommendations
  const baseRecommendations = {
    summer: [
      'Travel during early morning hours (5-9 AM)',
      'Carry extra coolant and water',
      'Check tire pressure and condition',
      'Avoid midday travel (11 AM - 4 PM)'
    ],
    monsoon: [
      'Monitor weather forecasts continuously',
      'Reduce speed by 50% in wet conditions',
      'Use headlights during rain',
      'Avoid flooded road sections',
      'Carry emergency supplies and food'
    ],
    autumn: [
      'Check tire tread depth for wet roads',
      'Carry rain gear and warm clothing',
      'Monitor changing weather conditions',
      'Allow extra time for unpredictable weather'
    ],
    winter: [
      'Avoid early morning travel due to fog',
      'Use fog lights and maintain low speed',
      'Check battery and antifreeze levels',
      'Carry warm clothing and blankets'
    ]
  };
  
  // Add base recommendations
  recommendations.push(...(baseRecommendations[season] || []));
  
  // Add climate-specific recommendations
  if (climateAnalysis.monsoonIntensity === 'Very High' && season === 'monsoon') {
    recommendations.push('Consider postponing travel during peak monsoon');
    recommendations.push('Use GPS tracking for emergency location');
  }
  
  if (climateAnalysis.primaryClimateZone === 'Northern Plains' && season === 'summer') {
    recommendations.push('Install sun shades and cooling aids');
    recommendations.push('Plan for potential heat-related delays');
  }
  
  // Add terrain-specific recommendations
  if (route.terrain === 'hilly') {
    if (season === 'monsoon') {
      recommendations.push('Avoid travel during heavy rain due to landslide risk');
    }
    if (season === 'summer') {
      recommendations.push('Check cooling system before hill climbs');
    }
  }
  
  // Add risk-specific recommendations
  if (seasonRisks.overallRisk === 'Critical' || seasonRisks.overallRisk === 'High') {
    recommendations.push('Consider alternative route during this season');
    recommendations.push('Implement convoy travel protocols');
    recommendations.push('Ensure emergency communication equipment');
  }
  
  return recommendations;
}

module.exports = seasonalConditionsController;