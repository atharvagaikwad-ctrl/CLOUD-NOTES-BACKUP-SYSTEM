const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');

describe('Cloud Notes Backup System - Test Suite', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  test('1. Health check endpoint (/health) returns status ok and commit SHA', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(typeof body.commit === 'string');
    assert.ok(typeof body.uptimeSeconds === 'number');
    assert.ok(body.timestamp);
  });

  test('2. Web UI Dashboard (GET /) renders HTML containing commit footer and stats', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();

    assert.match(html, /Cloud Notes Backup System/);
    assert.match(html, /Create Cloud Note/);
    assert.match(html, /Cloud Backup Snapshots History/);
    assert.match(html, /commit/);
  });

  test('3. Form submission (POST /notes) creates note and redirects (302)', async () => {
    const params = new URLSearchParams({
      title: 'Terraform State Locking with DynamoDB',
      category: 'DevOps',
      priority: 'High',
      tags: 'terraform, aws, state',
      content: 'Configured DynamoDB backend lock table to prevent concurrent state corruption.',
    });

    const res = await fetch(`${baseUrl}/notes`, {
      method: 'POST',
      body: params,
      redirect: 'manual',
    });

    assert.equal(res.status, 302);

    // Verify note is now present in the API
    const apiRes = await fetch(`${baseUrl}/api/notes?query=Terraform`);
    const data = await apiRes.json();
    assert.ok(data.notes.some((n) => n.title.includes('Terraform State Locking')));
  });

  test('4. Form submission (POST /notes) with missing title/content rejected with 400', async () => {
    const badParams = new URLSearchParams({
      title: '',
      content: '',
    });

    const res = await fetch(`${baseUrl}/notes`, {
      method: 'POST',
      body: badParams,
    });

    assert.equal(res.status, 400);
    const html = await res.text();
    assert.match(html, /Note title and content are required fields/);
  });

  test('5. JSON API (POST /api/notes & GET /api/notes) creates and filters notes', async () => {
    const postRes = await fetch(`${baseUrl}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Kubernetes Ingress Controller Setup',
        category: 'Architecture',
        priority: 'Medium',
        tags: ['k8s', 'ingress', 'nginx'],
        content: 'Configured NGINX Ingress Controller with Let\'s Encrypt TLS cert-manager.',
      }),
    });

    assert.equal(postRes.status, 201);
    const postData = await postRes.json();
    assert.equal(postData.message, 'Note created successfully');
    assert.equal(postData.note.title, 'Kubernetes Ingress Controller Setup');

    // Filter by category
    const filterRes = await fetch(`${baseUrl}/api/notes?category=Architecture`);
    const filterData = await filterRes.json();
    assert.ok(filterData.count >= 1);
    assert.ok(filterData.notes.every((n) => n.category.toLowerCase() === 'architecture'));
  });

  test('6. Cloud Backup Snapshot API (POST & GET /api/backups) generates checksum', async () => {
    const backupRes = await fetch(`${baseUrl}/api/backups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshotName: 'Integration Test Snapshot' }),
    });

    assert.equal(backupRes.status, 201);
    const backupData = await backupRes.json();
    assert.ok(backupData.snapshot.id.startsWith('snap-'));
    assert.ok(backupData.snapshot.hashChecksum.length >= 8);
    assert.equal(backupData.snapshot.snapshotName, 'Integration Test Snapshot');

    // Download snapshot
    const downloadRes = await fetch(`${baseUrl}/api/backups/${backupData.snapshot.id}/download`);
    assert.equal(downloadRes.status, 200);
    const downloadedSnapshot = await downloadRes.json();
    assert.equal(downloadedSnapshot.id, backupData.snapshot.id);
    assert.ok(Array.isArray(downloadedSnapshot.notesSnapshot));
  });

  test('7. System Stats API (GET /api/stats) returns accurate metrics', async () => {
    const statsRes = await fetch(`${baseUrl}/api/stats`);
    assert.equal(statsRes.status, 200);
    const stats = await statsRes.json();

    assert.ok(typeof stats.totalNotes === 'number');
    assert.ok(stats.totalNotes > 0);
    assert.ok(typeof stats.totalBackups === 'number');
    assert.ok(typeof stats.storageSizeBytes === 'number');
    assert.ok(stats.categoriesCount);
  });
});
