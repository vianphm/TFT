'use strict';

const https = require('https');

const RIOT_API_URL = 'https://127.0.0.1:2999/liveclientdata/allgamedata';
const agent = new https.Agent({ rejectUnauthorized: false });

class RiotLiveClient {
  constructor({ onData, onStatus, pollIntervalMs = 2000 } = {}) {
    this.onData = onData;
    this.onStatus = onStatus;
    this.pollIntervalMs = pollIntervalMs;
    this.timer = null;
    this.connected = false;
  }

  start() {
    this.poll();
    this.timer = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  poll() {
    const req = https.get(RIOT_API_URL, { agent, timeout: 1500 }, (res) => {
      if (res.statusCode !== 200) {
        this._setConnected(false);
        return;
      }
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          this._setConnected(true);
          if (typeof this.onData === 'function') {
            this.onData(this._parse(data));
          }
        } catch (e) {
          this._setConnected(false);
        }
      });
    });

    req.on('error', () => {
      this._setConnected(false);
    });
  }

  _setConnected(status) {
    if (this.connected !== status) {
      this.connected = status;
      if (typeof this.onStatus === 'function') {
        this.onStatus({ liveApiActive: status });
      }
    }
  }

  _parse(data) {
    const activePlayer = data.activePlayer || {};
    const gameData = data.gameData || {};
    const allPlayers = data.allPlayers || [];

    const name = activePlayer.summonerName || '';
    const myPlayer = allPlayers.find((p) => p.summonerName === name) || {};

    let round = '';
    let stage = 1;
    const gameTime = Math.floor(gameData.gameTime || 0);
    if (gameTime > 0) {
      const minutes = Math.floor(gameTime / 60);
      stage = Math.min(7, Math.floor(minutes / 3) + 1);
      const r = Math.floor((gameTime % 180) / 30) + 1;
      round = `${stage}-${Math.min(7, r)}`;
    }

    return {
      round: round || '2-1',
      stage,
      gameTime,
      level: activePlayer.level || myPlayer.level || 6,
      gold: activePlayer.currentGold != null ? Math.round(activePlayer.currentGold) : null,
      health: myPlayer.health != null ? Math.round(myPlayer.health) : 100,
      summonerName: name,
      playersCount: allPlayers.length
    };
  }
}

module.exports = { RiotLiveClient };
