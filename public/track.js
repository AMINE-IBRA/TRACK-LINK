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
  } else if (/Mac OS X/i.test(ua)) {
    info.os = 'macOS';
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
  };
}

async function collectDeviceInfo() {
  const ua = navigator.userAgent;
  const parsed = parseUserAgent(ua);
  const battery = await getBatteryInfo();
  const connection = await getConnectionInfo();

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
    referrer: document.referrer || null,
    battery,
    connection,
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
