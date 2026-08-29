'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const RIOT_LIVE_URL = 'https://127.0.0.1:2999/liveclientdata/allgamedata';
const RIOT_STATS_URL = 'https://127.0.0.1:2999/liveclientdata/gamestats';

const agent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Bo ket noi truc tiep voi Riot Live Client Data API (cong 2999).
 * Day la cong API chinh thuc do Riot Games cung cap trong tran dau de cac app
 * nhu Blitz, Porofessor, MetaTFT doc thong tin tran ma khong can can thiep vao bo nho game.
 */
class LiveClientService {
  constructor({ intervalMs = 1500, onData, onStatus } = {}) {
    this.intervalMs = intervalMs;
    this.onData = onData || (() => {});
    this.onStatus = onStatus || (() => {});
    this.timer = null;
    this.inGame = false;
    this.lastGameTime = 0;
    this.lastRound = '2-1';
  }

  start() {
    if (this.timer) return;
    this.poll();
    this.timer = setInterval(() => this.poll(), this.intervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async poll() {
    try {
      const data = await this._fetchJson(RIOT_LIVE_URL, 1200);
      if (data && data.gameData) {
        if (!this.inGame) {
          this.inGame = true;
          this.onStatus({ inGame: true, liveApiActive: true });
        }
        this._processGameData(data);
      } else {
        if (this.inGame) {
          this.inGame = false;
          this.onStatus({ inGame: false, liveApiActive: false });
        }
      }
    } catch (err) {
      // Khi game chua bat hoac chua vao tran, cong 2999 se dong -> coi nhu chua vao tran
      if (this.inGame) {
        this.inGame = false;
        this.onStatus({ inGame: false, liveApiActive: false });
      }
    }
  }

  _processGameData(raw) {
    const gameData = raw.gameData || {};
    const activePlayer = raw.activePlayer || {};
    const allPlayers = raw.allPlayers || [];

    const gameTime = Number(gameData.gameTime || 0);
    const gameMode = String(gameData.gameMode || 'TFT');

    // Tinh toan uoc luong Stage va Round dua tren thoi gian tran dau (gameTime seconds)
    const round = this._estimateRound(gameTime);
    this.lastGameTime = gameTime;
    this.lastRound = round;

    // Lay level cua nguoi choi tu activePlayer
    const level = activePlayer.level ? Number(activePlayer.level) : null;
    const currentGold = activePlayer.currentGold !== undefined ? Number(activePlayer.currentGold) : null;
    const summonerName = activePlayer.summonerName || '';

    // Tim thong tin chi tiet cua nguoi choi trong allPlayers
    const myPlayer = allPlayers.find((p) => p.summonerName === summonerName) || {};
    const isDead = myPlayer.isDead || false;

    const payload = {
      liveApiActive: true,
      inGame: true,
      gameTime: Math.round(gameTime),
      gameMode: gameMode,
      round: round,
      level: level,
      gold: currentGold,
      summonerName: summonerName,
      isDead: isDead,
      playerCount: allPlayers.length
    };

    this.onData(payload);
  }

  /**
   * Uoc luong Vong dau (Round) tu thoi gian tran dau cua Riot Live Client:
   * Stage 1 (PVE): 0s - 90s (1-1, 1-2, 1-3, 1-4)
   * Stage 2: 90s - 330s (2-1 -> 2-7)
   * Stage 3: 330s - 570s (3-1 -> 3-7)
   * Stage 4: 570s - 810s (4-1 -> 4-7)
   * Stage 5: 810s - 1050s (5-1 -> 5-7)
   * Stage 6: 1050s - 1290s (6-1 -> 6-7)
   * Stage 7+: 1290s+
   */
  _estimateRound(gameTime) {
    if (gameTime <= 25) return '1-1';
    if (gameTime <= 50) return '1-2';
    if (gameTime <= 75) return '1-3';
    if (gameTime <= 95) return '1-4';

    const t = gameTime - 95;
    const stageDuration = 240; // ~4 phut moi stage (6 round x 40s)
    const stageIndex = Math.floor(t / stageDuration) + 2;
    const stageTimeLeft = t % stageDuration;
    const roundIndex = Math.min(7, Math.max(1, Math.floor(stageTimeLeft / 35) + 1));

    return `${stageIndex}-${roundIndex}`;
  }

  _fetchJson(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { agent, timeout: timeoutMs }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
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

module.exports = { LiveClientService };
