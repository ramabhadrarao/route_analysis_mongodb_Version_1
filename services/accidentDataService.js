// File: services/accidentDataService.js
// Purpose: Real accident-prone area data collection using multiple APIs

const axios = require('axios');
const AccidentProneArea = require('../models/AccidentProneArea');

class AccidentDataService {
  constructor() {
    this.tomtomApiKey = process.env.TOMTOM_API_KEY;
    this.hereApiKey = process.env.HERE_API_KEY;
    this.mapquestApiKey = process.env.MAPQUEST_API_KEY;
  }

  // MAIN: Collect real accident-prone areas using multiple APIs
  async collectRealAccidentProneAreas(route) {
    try {
      console.log('🚨 Collecting REAL accident-prone area data...');
      
      const accidentAreas = [];
      const routeSegments = this.createRouteSegments(route.routePoints, 10);
      
      for (const segment of routeSegments) {
        try {
          // Collect from multiple sources for better coverage
          const [tomtomIncidents, hereIncidents, historicalData] = await Promise.allSettled([
            this.getTomTomIncidents(segment),
            this.getHereIncidents(segment),
            this.getHistoricalAccidentData(segment) // Custom historical database
          ]);

          // Process TomTom incidents
          if (tomtomIncidents.status === 'fulfilled' && tomtomIncidents.value) {
            for (const incident of tomtomIncidents.value) {
              if (this.isAccidentRelated(incident)) {
                const accidentArea = await this.createAccidentProneArea(
                  incident, route._id, 'tomtom'
                );
                if (accidentArea) accidentAreas.push(accidentArea);
              }
            }
          }

          // Process HERE incidents
          if (hereIncidents.status === 'fulfilled' && hereIncidents.value) {
            for (const incident of hereIncidents.value) {
              if (this.isAccidentRelated(incident)) {
                const accidentArea = await this.createAccidentProneArea(
                  incident, route._id, 'here'
                );
                if (accidentArea) accidentAreas.push(accidentArea);
              }
            }
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (segmentError) {
          console.warn(`Failed to get incidents for segment:`, segmentError.message);
        }
      }

      console.log(`✅ Found ${accidentAreas.length} real accident-prone areas`);
      return {
        total: accidentAreas.length,
        bySource: this.groupBySource(accidentAreas),
        highRiskAreas: accidentAreas.filter(a => a.riskScore > 7).length,
        averageRisk: this.calculateAverageRisk(accidentAreas)
      };

    } catch (error) {
      console.error('Real accident data collection failed:', error);
      return this.fallbackToMockData(route);
    }
  }

  // 1. TomTom Traffic Incidents API
  async getTomTomIncidents(segment) {
    try {
      if (!this.tomtomApiKey) {
        console.warn('TomTom API key not configured');
        return [];
      }

      const radius = 5000; // 5km radius
      const url = `https://api.tomtom.com/traffic/services/5/incidentDetails` +
        `?key=${this.tomtomApiKey}` +
        `&bbox=${segment.latitude - 0.05},${segment.longitude - 0.05},` +
        `${segment.latitude + 0.05},${segment.longitude + 0.05}` +
        `&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code,iconCategory}}}}` +
        `&language=en-GB`;

      const response = await axios.get(url, { timeout: 10000 });

      if (response.data && response.data.incidents) {
        return response.data.incidents.map(incident => ({
          id: incident.id,
          type: 'tomtom',
          coordinates: this.extractCoordinates(incident.geometry),
          severity: this.mapTomTomSeverity(incident.properties.magnitudeOfDelay),
          description: incident.properties.events?.[0]?.description || 'Traffic incident',
          category: incident.properties.iconCategory,
          source: 'TomTom Traffic API',
          timestamp: new Date()
        }));
      }

      return [];

    } catch (error) {
      console.error('TomTom API error:', error.message);
      return [];
    }
  }

  // 2. HERE Traffic Incidents API
  async getHereIncidents(segment) {
    try {
      if (!this.hereApiKey) {
        console.warn('HERE API key not configured');
        return [];
      }

      const bbox = `${segment.latitude - 0.05},${segment.longitude - 0.05};` +
                  `${segment.latitude + 0.05},${segment.longitude + 0.05}`;
      
      const url = `https://data.traffic.hereapi.com/v7/incidents` +
        `?apikey=${this.hereApiKey}` +
        `&in=bbox:${bbox}` +
        `&locationReferencing=shape`;

      const response = await axios.get(url, { timeout: 10000 });

      if (response.data && response.data.results) {
        return response.data.results.map(incident => ({
          id: incident.incidentDetails?.id || Date.now(),
          type: 'here',
          coordinates: this.extractHereCoordinates(incident.location),
          severity: this.mapHereSeverity(incident.incidentDetails?.criticality),
          description: incident.incidentDetails?.description?.value || 'Traffic incident',
          category: incident.incidentDetails?.type,
          source: 'HERE Traffic API',
          timestamp: new Date()
        }));
      }

      return [];

    } catch (error) {
      console.error('HERE API error:', error.message);
      return [];
    }
  }

  // 3. Create AccidentProneArea from incident data
  async createAccidentProneArea(incident, routeId, source) {
    try {
      // Calculate enhanced risk factors
      const riskAnalysis = this.analyzeIncidentRisk(incident);
      
      const accidentArea = new AccidentProneArea({
        routeId,
        latitude: incident.coordinates.latitude,
        longitude: incident.coordinates.longitude,
        distanceFromStartKm: 0, // Calculate based on route
        
        // Accident Statistics
        accidentFrequencyYearly: riskAnalysis.estimatedFrequency,
        accidentSeverity: this.mapSeverityToEnum(incident.severity),
        
        // Accident Analysis
        commonAccidentTypes: riskAnalysis.accidentTypes,
        contributingFactors: riskAnalysis.contributingFactors,
        
        // Enhanced Risk Analysis
        timeOfDayRisk: riskAnalysis.timeRisks,
        weatherRelatedRisk: riskAnalysis.weatherRisk,
        infrastructureRisk: riskAnalysis.infrastructureRisk,
        trafficVolumeRisk: riskAnalysis.trafficRisk,
        
        // Overall Risk
        riskScore: riskAnalysis.overallRisk,
        
        // Historical Data
        lastAccidentDate: incident.timestamp,
        accidentTrend: 'stable',
        
        // Safety Measures
        safetyMeasuresPresent: this.identifySafetyMeasures(incident),
        recommendedImprovements: this.generateImprovementRecommendations(riskAnalysis),
        
        // Data Source
        dataSource: `${source.toUpperCase()}_API`,
        dataQuality: 'high'
      });

      return await accidentArea.save();

    } catch (error) {
      console.error('Failed to create accident area:', error);
      return null;
    }
  }

  // 4. Enhanced risk analysis for incidents
  analyzeIncidentRisk(incident) {
    let overallRisk = 3; // Base risk
    
    // Severity-based risk
    const severityRisk = {
      'critical': 4,
      'major': 3,
      'moderate': 2,
      'minor': 1,
      'low': 1
    };
    overallRisk += severityRisk[incident.severity] || 2;

    // Type-based risk
    const typeRisk = this.getTypeBasedRisk(incident.category, incident.description);
    overallRisk += typeRisk;

    // Time-based risk patterns
    const timeRisks = this.calculateTimeBasedRisks(incident);
    
    return {
      overallRisk: Math.max(1, Math.min(10, overallRisk)),
      estimatedFrequency: this.estimateAccidentFrequency(incident),
      accidentTypes: this.identifyAccidentTypes(incident),
      contributingFactors: this.identifyContributingFactors(incident),
      timeRisks,
      weatherRisk: this.assessWeatherRisk(incident),
      infrastructureRisk: this.assessInfrastructureRisk(incident),
      trafficRisk: this.assessTrafficVolumeRisk(incident)
    };
  }

  // 5. Helper methods for data processing
  
  isAccidentRelated(incident) {
    const accidentKeywords = [
      'accident', 'collision', 'crash', 'incident', 'emergency',
      'vehicle', 'disabled', 'breakdown', 'hazard'
    ];
    
    const description = (incident.description || '').toLowerCase();
    const category = (incident.category || '').toLowerCase();
    
    return accidentKeywords.some(keyword => 
      description.includes(keyword) || category.includes(keyword)
    );
  }

  mapSeverityToEnum(severity) {
    const severityMap = {
      'critical': 'fatal',
      'major': 'major',
      'moderate': 'major',
      'minor': 'minor',
      'low': 'minor'
    };
    return severityMap[severity] || 'minor';
  }

  extractCoordinates(geometry) {
    try {
      if (geometry.type === 'Point') {
        return {
          latitude: geometry.coordinates[1],
          longitude: geometry.coordinates[0]
        };
      } else if (geometry.type === 'LineString') {
        // Use first coordinate for line incidents
        return {
          latitude: geometry.coordinates[0][1],
          longitude: geometry.coordinates[0][0]
        };
      }
      return { latitude: 0, longitude: 0 };
    } catch (error) {
      return { latitude: 0, longitude: 0 };
    }
  }

  extractHereCoordinates(location) {
    try {
      if (location.shape && location.shape.links && location.shape.links[0]) {
        const firstPoint = location.shape.links[0].points[0];
        return {
          latitude: firstPoint.lat,
          longitude: firstPoint.lng
        };
      }
      return { latitude: 0, longitude: 0 };
    } catch (error) {
      return { latitude: 0, longitude: 0 };
    }
  }

  // 6. Fallback to enhanced mock data if APIs fail
  fallbackToMockData(route) {
    console.log('📝 Using enhanced mock accident data as fallback');
    
    return {
      total: Math.floor(route.totalDistance / 50), // 1 per 50km average
      bySource: { mock: Math.floor(route.totalDistance / 50) },
      highRiskAreas: Math.floor(route.totalDistance / 100),
      averageRisk: 4.5,
      note: 'Using enhanced mock data - configure TomTom/HERE APIs for real data'
    };
  }

  createRouteSegments(routePoints, numberOfSegments) {
    const segments = [];
    const step = Math.max(1, Math.floor(routePoints.length / numberOfSegments));
    
    for (let i = 0; i < routePoints.length; i += step) {
      segments.push(routePoints[i]);
    }
    
    return segments;
  }

  // Additional helper methods...
  calculateTimeBasedRisks(incident) {
    return {
      night: 7,    // Higher risk at night
      day: 4,      // Lower risk during day
      peak: 6      // Medium-high risk during peak hours
    };
  }

  estimateAccidentFrequency(incident) {
    // Based on severity and type
    const severityMultiplier = {
      'critical': 8,
      'major': 5,
      'moderate': 3,
      'minor': 1
    };
    return severityMultiplier[incident.severity] || 3;
  }

  identifyAccidentTypes(incident) {
    const types = ['collision'];
    if (incident.description) {
      if (incident.description.includes('overtaking')) types.push('overtaking');
      if (incident.description.includes('rear')) types.push('rear-end');
      if (incident.description.includes('side')) types.push('side-impact');
    }
    return types;
  }

  identifyContributingFactors(incident) {
    const factors = ['traffic_density'];
    if (incident.description) {
      if (incident.description.includes('weather')) factors.push('weather_conditions');
      if (incident.description.includes('construction')) factors.push('construction_zone');
      if (incident.description.includes('visibility')) factors.push('poor_visibility');
    }
    return factors;
  }

  assessWeatherRisk(incident) {
    return incident.description?.includes('weather') ? 8 : 5;
  }

  assessInfrastructureRisk(incident) {
    return incident.description?.includes('construction') ? 7 : 5;
  }

  assessTrafficVolumeRisk(incident) {
    return incident.category?.includes('congestion') ? 8 : 6;
  }

  groupBySource(accidentAreas) {
    return accidentAreas.reduce((acc, area) => {
      const source = area.dataSource.toLowerCase();
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});
  }

  calculateAverageRisk(accidentAreas) {
    if (accidentAreas.length === 0) return 0;
    return accidentAreas.reduce((sum, area) => sum + area.riskScore, 0) / accidentAreas.length;
  }
}

module.exports = new AccidentDataService();