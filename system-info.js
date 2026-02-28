// simple-system-info.js
const os = require('os');
const { networkInterfaces } = require('os');

function getPlatformInfo() {
    const release = os.release();
    const versionParts = release.split('.');
    
    // Determine Windows version
    let osName = 'Windows';
    let osVersion = 'Unknown';
    
    if (os.platform() === 'win32') {
        const majorVersion = versionParts[0];
        const buildNumber = versionParts[2] || '0';
        
        if (majorVersion === '10.0') {
            osVersion = parseInt(buildNumber) >= 22000 ? '11' : '10';
        } else {
            osVersion = majorVersion;
        }
        osName = `Windows ${osVersion}`;
    }
    
    // Get MAC address
    let macAddress = '00-00-00-00-00-00';
    const interfaces = networkInterfaces();
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
                macAddress = iface.mac.replace(/:/g, '-');
                break;
            }
        }
        if (macAddress !== '00-00-00-00-00-00') break;
    }
    
    return {
        platform: {
            osName: osName,
            osVersion: osVersion,
            osBuild: `${versionParts[0] || '11'}.${versionParts[1] || '901'}.${versionParts[2] || '2'}`,
            macAddress: macAddress
        }
    };
}

module.exports = { getPlatformInfo };

// If running directly
if (require.main === module) {
    console.log(JSON.stringify(getPlatformInfo(), null, 2));
}