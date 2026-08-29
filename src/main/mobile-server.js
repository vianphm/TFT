'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const url = require('url');

const ROOT = path.join(__dirname, '..', 'mobile');
const SHARED = path.join(__dirname, '..', 'renderer', 'shared');
const ASSETS = path.join(__dirname, '..', '..', 'assets');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

/**
 * May chu nho trong app PC de dien thoai cung wifi mo duoc ban mobile
 * va lay doi hinh / du lieu set dang dung.
 *
 * Chi chay khi nguoi dung tu bat. Khong co dang nhap: chi bat khi o mang nha,
 * va du lieu duy nhat no cho xem la doi hinh TFT.
 */
class MobileServer {
  constructor({ store, dataService, onChange } = {}) {
    this.store = store;
    this.dataService = dataService;
    this.onChange = onChange || (() => {});
    this.server = null;
    this.port = null;
  }

  get running() {
    return Boolean(this.server && this.server.listening);
  }

  /** Dia chi cho nguoi dung go vao dien thoai. */
  get addresses() {
    if (!this.running) return [];
    const out = [];
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family !== 'IPv4' && net.family !== 4) continue;
        if (net.internal) continue;
        out.push(`http://${net.address}:${this.port}`);
      }
    }
    return out.length ? out : [`http://localhost:${this.port}`];
  }

  status() {
    return { running: this.running, port: this.port, addresses: this.addresses };
  }

  start(port) {
    if (this.running) return this.status();
    const wanted = Number(port) || 7333;

    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => this._handle(req, res));
      server.on('error', (err) => {
        this.server = null;
        reject(new Error(err.code === 'EADDRINUSE'
          ? `Cong ${wanted} dang bi ung dung khac dung. Doi cong khac trong cai dat.`
          : err.message));
      });
      server.listen(wanted, '0.0.0.0', () => {
        this.server = server;
        this.port = wanted;
        this.onChange(this.status());
        resolve(this.status());
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.server) return resolve(this.status());
      this.server.close(() => {
        this.server = null;
        this.port = null;
        this.onChange(this.status());
        resolve(this.status());
      });
    });
  }

  _handle(req, res) {
    const parsed = url.parse(req.url);
    const pathname = decodeURIComponent(parsed.pathname || '/');

    // Cho phep goi tu trang mobile da cai san tren dien thoai (origin khac)
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST' });
      return res.end();
    }

    if (pathname === '/api/state') return this._sendState(res);
    if (pathname === '/api/tft-data') return this._sendData(res);
    if (pathname === '/api/comps' && req.method === 'POST') return this._saveComps(req, res);

    return this._sendFile(pathname, res);
  }

  _sendState(res) {
    const data = this.dataService.load();
    send(res, 200, TYPES['.json'], JSON.stringify({
      app: 'tft-companion',
      comps: this.store.get('comps', []),
      data: {
        setName: data.setName,
        setNumber: data.setNumber,
        champions: data.champions || [],
        traits: data.traits || []
      },
      state: this.store.get('state', {})
    }));
  }

  /** Cung duong dan voi ham tren Vercel, de ban mobile dung chung mot cach goi. */
  _sendData(res) {
    const data = this.dataService.load();
    send(res, 200, TYPES['.json'], JSON.stringify({
      source: data.source,
      syncedAt: data.syncedAt,
      setNumber: data.setNumber,
      setName: data.setName,
      champions: data.champions || [],
      traits: data.traits || [],
      items: data.items || [],
      components: data.components || []
    }));
  }

  _saveComps(req, res) {
    let body = '';
    let tooBig = false;
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) { tooBig = true; req.destroy(); }
    });
    req.on('end', () => {
      if (tooBig) return send(res, 413, TYPES['.json'], '{"ok":false,"error":"du lieu qua lon"}');
      try {
        const comps = JSON.parse(body);
        if (!Array.isArray(comps)) throw new Error('can mot mang doi hinh');
        this.store.set('comps', comps);
        this.onChange(this.status(), comps);
        send(res, 200, TYPES['.json'], JSON.stringify({ ok: true, count: comps.length }));
      } catch (err) {
        send(res, 400, TYPES['.json'], JSON.stringify({ ok: false, error: err.message }));
      }
    });
  }

  _sendFile(pathname, res) {
    let file;
    if (pathname === '/' || pathname === '/index.html') file = path.join(ROOT, 'index.html');
    else if (pathname.startsWith('/shared/')) file = path.join(SHARED, path.basename(pathname));
    else if (/^\/icon(-\d+)?\.png$/.test(pathname)) file = path.join(ASSETS, path.basename(pathname));
    else file = path.join(ROOT, path.basename(pathname));

    // Chan di ra ngoai cac thu muc duoc phep
    const allowed = [ROOT, SHARED, ASSETS].some((dir) => file.startsWith(dir + path.sep));
    if (!allowed) return send(res, 403, 'text/plain', 'khong duoc phep');

    fs.readFile(file, (err, content) => {
      if (err) return send(res, 404, 'text/plain', 'khong tim thay');
      send(res, 200, TYPES[path.extname(file)] || 'application/octet-stream', content);
    });
  }
}

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

module.exports = { MobileServer };
