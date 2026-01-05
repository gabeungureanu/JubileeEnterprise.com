/**
 * Server Detection Utility
 *
 * Detects if the application is running on the production server
 * based on IP address and hostname.
 */

const os = require('os');
const logger = require('./logger');

/**
 * Production server identifiers
 */
const PRODUCTION_IDENTIFIERS = {
  hostname: 'solarwinding',
  ipAddress: '10.0.0.4',
  subnet: '10.0.0.0/24'
};

/**
 * Get all network interfaces and their IP addresses
 * @returns {Array} Array of network interface objects
 */
function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const [name, iface] of Object.entries(interfaces)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        addresses.push({
          interface: name,
          address: addr.address,
          netmask: addr.netmask,
          mac: addr.mac
        });
      }
    }
  }

  return addresses;
}

/**
 * Check if an IP address is in a specific subnet
 * @param {string} ip - IP address to check
 * @param {string} subnet - Subnet in CIDR notation (e.g., "10.0.0.0/24")
 * @returns {boolean}
 */
function isInSubnet(ip, subnet) {
  const [subnetIP, bits] = subnet.split('/');
  const mask = -1 << (32 - parseInt(bits));

  const ipLong = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  const subnetLong = subnetIP.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;

  return (ipLong & mask) === (subnetLong & mask);
}

/**
 * Detect if running on production server
 * @returns {Object} Detection result with details
 */
function detectProductionServer() {
  const hostname = os.hostname();
  const interfaces = getNetworkInterfaces();

  // Check hostname match
  const hostnameMatch = hostname.toLowerCase() === PRODUCTION_IDENTIFIERS.hostname.toLowerCase();

  // Check IP address match
  const ipMatch = interfaces.some(iface => iface.address === PRODUCTION_IDENTIFIERS.ipAddress);

  // Check subnet match
  const subnetMatch = interfaces.some(iface =>
    isInSubnet(iface.address, PRODUCTION_IDENTIFIERS.subnet)
  );

  const isProduction = hostnameMatch || ipMatch;

  const result = {
    isProduction,
    hostname,
    hostnameMatch,
    ipMatch,
    subnetMatch,
    interfaces,
    productionIP: PRODUCTION_IDENTIFIERS.ipAddress,
    productionHostname: PRODUCTION_IDENTIFIERS.hostname
  };

  // Log detection result
  if (isProduction) {
    logger.info('Production server detected', {
      hostname,
      ip: interfaces[0]?.address,
      method: hostnameMatch ? 'hostname' : 'ip'
    });
  } else {
    logger.info('Development/Local environment detected', {
      hostname,
      ip: interfaces[0]?.address
    });
  }

  return result;
}

/**
 * Get the primary external IP address
 * @returns {string|null}
 */
function getPrimaryIP() {
  const interfaces = getNetworkInterfaces();
  return interfaces.length > 0 ? interfaces[0].address : null;
}

/**
 * Get server environment information
 * @returns {Object}
 */
function getServerInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
    freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + ' GB',
    uptime: Math.round(os.uptime() / 3600) + ' hours',
    networkInterfaces: getNetworkInterfaces(),
    primaryIP: getPrimaryIP()
  };
}

/**
 * Simple check - returns boolean
 * @returns {boolean}
 */
function isProductionServer() {
  return detectProductionServer().isProduction;
}

module.exports = {
  detectProductionServer,
  isProductionServer,
  getPrimaryIP,
  getServerInfo,
  getNetworkInterfaces,
  PRODUCTION_IDENTIFIERS
};
