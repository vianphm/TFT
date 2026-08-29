'use strict';

const https = require('https');
const { app, shell } = require('electron');

const GITHUB_REPO = 'vianphm/TFT';
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const FALLBACK_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

/**
 * Bo kiem tra phien ban moi tu GitHub Releases:
 * - Khi co phien ban moi, tu dong phat su kien 'app:update-available'
 * - Giao dien se hien nut 'Cap nhat phien ban moi' cho nguoi dung bam 1 cham de tai ve
 */
class AppUpdater {
  constructor({ onUpdateAvailable } = {}) {
    this.onUpdateAvailable = onUpdateAvailable || (() => {});
    this.timer = null;
    this.lastCheckResult = null;
  }

  startAutoCheck(intervalMs = 6 * 60 * 60 * 1000) {
    // Kiem tra ngay sau 4 giay khi ung dung khoi dong xong
    setTimeout(() => this.checkForUpdates().catch(() => {}), 4000);

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.checkForUpdates().catch(() => {});
    }, intervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async checkForUpdates() {
    const currentVer = (app && app.getVersion) ? app.getVersion() : '1.0.0';
    try {
      const release = await this._fetchLatestRelease();
      if (!release || !release.tag_name) {
        this.lastCheckResult = { hasUpdate: false, currentVersion: currentVer, latestVersion: currentVer };
        return this.lastCheckResult;
      }

      const latestVer = release.tag_name.replace(/^v/, '');
      const isNewer = compareSemver(latestVer, currentVer) > 0;

      // Tim asset file cai dat Windows (.exe / .zip) hoac Android (.apk) neu co
      let downloadUrl = release.html_url || FALLBACK_RELEASES_URL;
      const assets = release.assets || [];
      const exeAsset = assets.find((a) => a.name && a.name.endsWith('.exe'));
      const apkAsset = assets.find((a) => a.name && a.name.endsWith('.apk'));
      const zipAsset = assets.find((a) => a.name && a.name.endsWith('.zip'));

      const result = {
        hasUpdate: isNewer,
        currentVersion: currentVer,
        latestVersion: latestVer,
        releaseName: release.name || `Phiên bản ${release.tag_name}`,
        releaseNotes: release.body || '',
        releaseUrl: release.html_url || FALLBACK_RELEASES_URL,
        downloadUrl: (exeAsset && exeAsset.browser_download_url) || (zipAsset && zipAsset.browser_download_url) || release.html_url || FALLBACK_RELEASES_URL,
        apkUrl: apkAsset ? apkAsset.browser_download_url : null,
        publishedAt: release.published_at
      };

      this.lastCheckResult = result;

      if (isNewer) {
        this.onUpdateAvailable(result);
      }

      return result;
    } catch (err) {
      this.lastCheckResult = {
        hasUpdate: false,
        currentVersion: currentVer,
        error: err.message
      };
      return this.lastCheckResult;
    }
  }

  _fetchLatestRelease() {
    return new Promise((resolve, reject) => {
      const req = https.get(LATEST_RELEASE_API, {
        headers: {
          'User-Agent': 'TFT-Companion-App'
        },
        timeout: 5000
      }, (res) => {
        if (res.statusCode === 404) return resolve(null);
        if (res.statusCode !== 200) return reject(new Error(`GitHub API HTTP ${res.statusCode}`));

        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('timeout'));
      });
    });
  }
}

function compareSemver(v1, v2) {
  const parts1 = String(v1).split('.').map(Number);
  const parts2 = String(v2).split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

module.exports = { AppUpdater, compareSemver };
