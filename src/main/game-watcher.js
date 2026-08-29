'use strict';

const { exec } = require('child_process');

const PROCESS_NAMES = {
  win32: { game: 'League of Legends.exe', client: 'LeagueClient.exe' },
  darwin: { game: 'League of Legends', client: 'LeagueClient' },
  linux: { game: 'League of Legends.exe', client: 'LeagueClient.exe' }
};

/**
 * Theo doi tien trinh game de tu bat/tat overlay.
 * Chi doc danh sach tien trinh (tasklist / pgrep), khong dong vao game.
 */
class GameWatcher {
  constructor({ intervalMs = 5000, onChange } = {}) {
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
      const names = PROCESS_NAMES[process.platform] || PROCESS_NAMES.win32;
      const gameRunning = list.includes(names.game.toLowerCase());
      const clientRunning = list.includes(names.client.toLowerCase());
      if (gameRunning !== this.state.gameRunning || clientRunning !== this.state.clientRunning) {
        this.state = { gameRunning, clientRunning };
        this.onChange(this.snapshot);
      }
    } catch (err) {
      // Khong co quyen doc tien trinh: coi nhu khong phat hien duoc, khong lam phien nguoi dung.
    }
  }
}

function listProcesses() {
  const cmd = process.platform === 'win32'
    ? 'tasklist /fo csv /nh'
    : 'ps -Ao comm=';
  return new Promise((resolve, reject) => {
    exec(cmd, { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.toLowerCase());
    });
  });
}

module.exports = { GameWatcher };
