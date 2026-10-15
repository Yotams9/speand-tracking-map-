// Preload in every test process; only injected in-memory mock Responses are allowed.
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
const blocked=()=>{throw Error('offline-network-forbidden');};
globalThis.fetch=blocked;
net.Socket.prototype.connect=blocked;
tls.connect=blocked;
http.request=http.get=https.request=https.get=blocked;
