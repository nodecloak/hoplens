// /api/ip2location — geolocation source handler backed by api.ip2location.io.
// Uses official keyless access or an optional API key and normalizes the geo shape.

import { makeGeoHandler } from '../common/geo-handler.js';

const buildUrl = (req) => {
    const ipAddress = req.query.ip;

    const keys = (process.env.IP2LOCATION_API_KEY || '').split(',').map(value=>value.trim()).filter(Boolean);
    const key = keys[Math.floor(Math.random() * keys.length)];
    return `https://api.ip2location.io/?ip=${encodeURIComponent(ipAddress)}${key ? '&key='+encodeURIComponent(key) : ''}`;
};

const modifyJsonForIPAPI = (json) => {
    const { ip, country_code, country_name, region_name, city_name, latitude, longitude, as, asn } = json || {};

    return {
        ip: ip,
        city: city_name || 'N/A',
        region: region_name || 'N/A',
        country: country_code || 'N/A',
        country_name: country_name || 'N/A',
        country_code: country_code || 'N/A',
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        asn: /^\d+$/.test(String(asn)) ? 'AS' + asn : null,
        org: as || 'N/A',
    };
};

export default makeGeoHandler({ name: 'ip2location-io', buildUrl, normalize: modifyJsonForIPAPI });
