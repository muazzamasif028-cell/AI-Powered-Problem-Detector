const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');

const BASE_URL = 'http://127.0.0.1:5000';

let server;

before(async () => {
    server = spawn(process.execPath, ['server.js'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe']
    });

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Server did not start within 5 seconds'));
        }, 5000);

        server.stdout.on('data', (data) => {
            const output = data.toString();
            process.stdout.write(output);

            if (output.includes('SUPREME Platform v14.0.0 RUNNING')) {
                clearTimeout(timeout);
                resolve();
            }
        });

        server.stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        server.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });

        server.once('exit', (code) => {
            if (code !== null && code !== 0) {
                clearTimeout(timeout);
                reject(new Error(`Server exited with code ${code}`));
            }
        });
    });
});

after(() => {
    if (server && !server.killed) {
        server.kill();
    }
});

test('GET / returns SUPREME Platform', async () => {
    const response = await fetch(`${BASE_URL}/`);

    assert.strictEqual(response.status, 200);

    const data = await response.json();

    assert.strictEqual(data.name, 'SUPREME Platform');
    assert.strictEqual(data.version, '14.0.0');
    assert.strictEqual(data.status, 'RUNNING');
});

test('GET /api/health returns HEALTHY', async () => {
    const response = await fetch(`${BASE_URL}/api/health`);

    assert.strictEqual(response.status, 200);

    const data = await response.json();

    assert.strictEqual(data.status, 'HEALTHY');
    assert.strictEqual(typeof data.uptime, 'number');
    assert.strictEqual(typeof data.timestamp, 'string');
});

test('GET /api/dashboard returns operational dashboard', async () => {
    const response = await fetch(`${BASE_URL}/api/dashboard`);

    assert.strictEqual(response.status, 200);

    const data = await response.json();

    assert.strictEqual(data.dashboard, 'SUPREME PLATFORM');
    assert.strictEqual(data.version, '14.0.0');
    assert.strictEqual(data.status, 'OPERATIONAL');
    assert.ok(Array.isArray(data.modules));
});

test('GET unknown endpoint returns 404 JSON', async () => {
    const response = await fetch(`${BASE_URL}/api/does-not-exist`);

    assert.strictEqual(response.status, 404);

    const data = await response.json();

    assert.strictEqual(data.error, 'ENDPOINT_NOT_FOUND');
});


test('POST /api/detect detects database problems', async () => {
    const response = await fetch(`${BASE_URL}/api/detect`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            input: 'Database connection is failing intermittently'
        })
    });

    assert.strictEqual(response.status, 200);

    const data = await response.json();

    assert.strictEqual(data.detected, true);
    assert.strictEqual(data.category, 'DATABASE');
    assert.strictEqual(data.type, 'database-problem');
    assert.strictEqual(data.severity, 'HIGH');
});

test('POST /api/detect returns false for unknown healthy input', async () => {
    const response = await fetch(`${BASE_URL}/api/detect`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            input: 'The application is running normally and all services are healthy'
        })
    });

    assert.strictEqual(response.status, 200);

    const data = await response.json();

    assert.strictEqual(data.detected, false);
    assert.strictEqual(data.type, 'unknown-problem');
});

test('POST /api/detect rejects missing input', async () => {
    const response = await fetch(`${BASE_URL}/api/detect`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: 'Database connection is failing'
        })
    });

    assert.strictEqual(response.status, 400);

    const data = await response.json();

    assert.strictEqual(data.error, 'BAD_REQUEST');
});
