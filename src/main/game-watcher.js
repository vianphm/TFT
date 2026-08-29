'use strict';

const { exec } = require('child_process');

const PROCESS_NAMES = {
  win32: {
    game: [
      'League of Legends.exe',
      'LeagueClient.exe',
      'LeagueClientUx.exe',
      'RiotClientServices.exe',
      'TFT.exe',
      'HD-Player.exe', 'Bluestacks.exe', 'BlueStacksX.exe', // Bluestacks
      'dnplayer.exe', 'LdVBoxHeadless.exe', 'ldnews.exe', 'LDPlayer9.exe', // LDPlayer
      'Nox.exe', 'NoxVMHandle.exe', // Nox
      'MuMuPlayer.exe', 'MuMuNxPlayer.exe', 'NemuPlayer.exe', // MuMu Player
      'AndroidProcess.exe', 'WsaClient.exe', 'WsaService.exe', // Windows Subsystem for Android
      'MEmu.exe', 'MEmuHeadless.exe', // MEmu
      'AndroidEmulator.exe', 'AppMarket.exe', 'QQPCRTP.exe' // Gameloop
    ],
    client: [
      'LeagueClient.exe', 'LeagueClientUx.exe', 'RiotClientServices.exe',
      'HD-Player.exe', 'dnplayer.exe', 'Nox.exe', 'MuMuPlayer.exe', 'MEmu.exe'
    ]
  },
  darwin: {
    game: ['League of Legends', 'LeagueClient', 'Riot Client'],
    client: ['LeagueClient', 'Riot Client']
  },
  linux: {
    game: ['League of Legends.exe', 'LeagueClient.exe', 'wine'],
    client: ['LeagueClient.exe']
  }
};

/**
 * Theo doi tien trinh game de tu bat/tat overlay.
 * Ho tro ca Lien Minh PC, Riot Client va cac trinh gia lap Android (TFT Mobile).
 */
class GameWatcher {
  constructor({ intervalMs = 3000, onChange } = {}) {
    this.intervalMs = intervalMs;
    this.onChange = onChange || (() => {});
    this.timer = null;
    this.state = { gameRunning: false, clientRunning: false };
  }

  start() {
    if (this.timer) return;
    this.check();
    this.timer = setInterval(() => this.check(), this.intervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get snapshot() {
    return { ...this.state };
  }

  async check() {
    try {
      const list = await listProcesses();
      const cfg = PROCESS_NAMES[process.platform] || PROCESS_NAMES.win32;
      const gameRunning = matchAny(list, cfg.game);
      const clientRunning = matchAny(list, cfg.client);
      if (gameRunning !== this.state.gameRunning || clientRunning !== this.state.clientRunning) {
        this.state = { gameRunning, clientRunning };
        this.onChange(this.snapshot);
      }
    } catch (err) {
      // Khong co quyen doc tien trinh: khong lam phien nguoi dung
    }
  }
}

function matchAny(processList, targets) {
  const arr = Array.isArray(targets) ? targets : [targets];
  return arr.some((name) => processList.includes(name.toLowerCase()));
}

function listProcesses() {
  const cmd = process.platform === 'win32'
    ? 'tasklist /fo csv /nh'
    : 'ps -Ao comm=';
  return new Promise((resolve, reject) => {
    exec(cmd, { windowsHide: true, maxBuffer: 6 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve((stdout || '').toLowerCase());
    });
  });
}

module.exports = { GameWatcher };

