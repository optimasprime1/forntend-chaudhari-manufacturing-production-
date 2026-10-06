// Frontend API configuration.
// Local development uses the Node/Express backend on port 5000.
// Set the production value when the frontend and API are hosted separately.
// A runtime override is supported for hosts that can inject a global before this file loads.
// Enquiry location autocomplete optionally reads window.CHAUDHARI_GOOGLE_MAPS_API_KEY.
// Restrict any browser key to this site's referrers and the Places API in Google Cloud.
const configuredApiBase = window.CHAUDHARI_API_BASE_URL || '';
const isLocal = window.location.protocol === 'file:'
  || window.location.hostname === 'localhost'
  || window.location.hostname === '127.0.0.1';
const productionApiBase = 'https://chaudhari-manufacturing-backend.onrender.com/api';
const sameOriginApiBase = `${window.location.origin}/api`;
const API_BASE = (configuredApiBase || (
  isLocal
    ? 'http://localhost:5000/api'
    : productionApiBase.includes('YOUR-BACKEND-DOMAIN')
      ? sameOriginApiBase
      : productionApiBase
)).replace(/\/+$/, '');
