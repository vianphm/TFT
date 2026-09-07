'use strict';

const { exec } = require('child_process');

const TFT_GAME_PROCESSES = [
  'tftclient-win64-shipping.exe',
  'tftclient.exe',
  'league of legends.exe'
];

const RIOT_CLIENT_PROCESSES = [
  'leagueclient.exe',
  'leagueclientux.exe',
  'riot client.exe',
  'riotclientservices.exe'
];

class GameWatcher {
  constructor({ onChange, pollIntervalMs = 2500 } = {}) {
    this.onChange = onChange;
    this.pollIntervalMs = pollIntervalMs;
    this.timer = null;
    this.lastState = {
      gameRunning: false,
      clientRunning: false,
      matchedProcess: ''
    };
  }

  start() {
    this.check();
    this.timer = setInterval(() => this.check(), this.pollIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  check() {
    exec('tasklist /fo csv /nh', { windowsHide: true, timeout: 4000 }, (err, stdout) => {
      if (err || !stdout) return;
      const lower = stdout.toLowerCase();

      let matchedGame = '';
      for (const proc of TFT_GAME_PROCESSES) {
        if (lower.includes(proc)) {
          matchedGame = proc;
          break;
        }
      }

      let matchedClient = '';
      for (const proc of RIOT_CLIENT_PROCESSES) {
        if (lower.includes(proc)) {
          matchedClient = proc;
          break;
        }
      }

      const gameRunning = Boolean(matchedGame);
      const clientRunning = Boolean(matchedClient);
      const matched = matchedGame || matchedClient;

      if (
        gameRunning !== this.lastState.gameRunning ||
        clientRunning !== this.lastState.clientRunning
      ) {
        this.lastState = { gameRunning, clientRunning, matchedProcess: matched };
        if (typeof this.onChange === 'function') {
          this.onChange(this.lastState);
        }
      }
    });
  }

  getState() {
    return this.lastState;
  }
}

module.exports = { GameWatcher };
