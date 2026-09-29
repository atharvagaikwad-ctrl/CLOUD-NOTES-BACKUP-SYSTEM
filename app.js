const express = require('express');
const store = require('./src/store');
const { escapeHtml } = require('./src/utils');

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const rawCommit = process.env.GIT_SHA || process.env.RENDER_GIT_COMMIT || 'local';
const commit = rawCommit.slice(0, 7);

// HTML Dashboard Generator
function renderDashboard({ notes, snapshots, stats, filter = {}, error = null, success = null }) {
  const queryVal = escapeHtml(filter.query || '');
  const catVal = filter.category || 'All';
  const prioVal = filter.priority || 'All';

  const notesHtml = notes.length === 0
    ? '<div class="empty-state">No cloud notes found matching your criteria. Create your first note above!</div>'
    : notes.map((note) => {
      const priorityClass = `badge-${note.priority.toLowerCase()}`;
      const tagsHtml = (note.tags || [])
        .map((t) => `<span class="tag">#${escapeHtml(t)}</span>`)
        .join(' ');

      return `
        <div class="note-card">
          <div class="note-header">
            <h3 class="note-title">${escapeHtml(note.title)}</h3>
            <span class="badge ${priorityClass}">${escapeHtml(note.priority)}</span>
          </div>
          <div class="note-meta">
            <span class="category-chip">${escapeHtml(note.category)}</span>
            <span class="date">${new Date(note.createdAt).toLocaleString()}</span>
          </div>
          <p class="note-content">${escapeHtml(note.content)}</p>
          <div class="note-tags">${tagsHtml}</div>
          <div class="note-actions">
            <form method="POST" action="/notes/delete/${note.id}" onsubmit="return confirm('Delete this note?');">
              <button type="submit" class="btn btn-danger btn-sm">Delete Note</button>
            </form>
          </div>
        </div>
      `;
    }).join('');

  const snapshotsHtml = snapshots.length === 0
    ? '<tr><td colspan="6" class="text-center">No backup snapshots created yet.</td></tr>'
    : snapshots.map((snap) => `
        <tr>
          <td><code>${escapeHtml(snap.id)}</code></td>
          <td><strong>${escapeHtml(snap.snapshotName)}</strong></td>
          <td>${snap.noteCount} notes</td>
          <td><span class="hash-tag">${escapeHtml(snap.hashChecksum)}</span></td>
          <td>${new Date(snap.createdAt).toLocaleTimeString()}</td>
          <td class="action-cell">
            <a href="/api/backups/${snap.id}/download" class="btn btn-secondary btn-sm" download>Download JSON</a>
            <form method="POST" action="/backups/restore/${snap.id}" style="display:inline;" onsubmit="return confirm('Restore this snapshot? Current unsaved notes will be replaced.');">
              <button type="submit" class="btn btn-warning btn-sm">Restore</button>
            </form>
          </td>
        </tr>
      `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cloud Notes Backup System</title>
  <style>
    :root {
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --secondary: #475569;
      --success: #16a34a;
      --warning: #d97706;
      --danger: #dc2626;
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 24px; min-height: 100vh; }
    .container { max-width: 1100px; margin: 0 auto; }
    
    header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--border); margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .brand h1 { font-size: 1.6rem; color: #60a5fa; display: flex; align-items: center; gap: 8px; }
    .brand p { color: var(--text-muted); font-size: 0.9rem; margin-top: 4px; }
    .status-pill { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid #22c55e; padding: 6px 14px; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 6px; }
    .status-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; }

    /* Alert Banners */
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 0.9rem; }
    .alert-error { background: rgba(220, 38, 38, 0.15); border: 1px solid var(--danger); color: #fca5a5; }
    .alert-success { background: rgba(22, 163, 74, 0.15); border: 1px solid var(--success); color: #86efac; }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: var(--card-bg); border: 1px solid var(--border); padding: 16px; border-radius: 10px; }
    .stat-label { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 1.6rem; font-weight: 700; color: #fff; margin-top: 6px; }

    /* Main Grid */
    .dashboard-layout { display: grid; grid-template-columns: 1fr 1.6fr; gap: 24px; }
    @media (max-width: 860px) { .dashboard-layout { grid-template-columns: 1fr; } }

    .panel { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .panel-title { font-size: 1.15rem; color: #e2e8f0; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }

    /* Forms */
    .form-group { margin-bottom: 14px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    label { display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 4px; }
    input, select, textarea { width: 100%; padding: 10px 12px; background: #0b1120; border: 1px solid var(--border); border-radius: 6px; color: #fff; font-size: 0.9rem; }
    input:focus, select:focus, textarea:focus { outline: none; border-color: var(--primary); }
    textarea { resize: vertical; min-height: 80px; }

    /* Buttons */
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; border-radius: 6px; font-weight: 600; font-size: 0.9rem; border: none; cursor: pointer; text-decoration: none; transition: 0.15s ease-in-out; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-success { background: var(--success); color: #fff; }
    .btn-secondary { background: var(--secondary); color: #fff; }
    .btn-warning { background: var(--warning); color: #fff; }
    .btn-danger { background: var(--danger); color: #fff; }
    .btn-sm { padding: 5px 10px; font-size: 0.78rem; }
    .btn-block { width: 100%; }

    /* Notes Cards */
    .notes-container { display: flex; flex-direction: column; gap: 12px; max-height: 520px; overflow-y: auto; padding-right: 4px; }
    .note-card { background: #0f172a; border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
    .note-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .note-title { font-size: 1rem; color: #f1f5f9; }
    .note-meta { display: flex; align-items: center; gap: 10px; margin: 6px 0; font-size: 0.8rem; color: var(--text-muted); }
    .category-chip { background: #1e293b; color: #93c5fd; padding: 2px 8px; border-radius: 4px; font-weight: 500; }
    .note-content { color: #cbd5e1; font-size: 0.9rem; line-height: 1.4; margin: 8px 0; white-space: pre-wrap; }
    .note-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .tag { font-size: 0.75rem; color: #a78bfa; }
    .note-actions { display: flex; justify-content: flex-end; }

    /* Badges */
    .badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 9999px; font-weight: 600; text-transform: uppercase; }
    .badge-high { background: rgba(220, 38, 38, 0.2); color: #f87171; border: 1px solid rgba(220, 38, 38, 0.4); }
    .badge-medium { background: rgba(217, 119, 6, 0.2); color: #fbbf24; border: 1px solid rgba(217, 119, 6, 0.4); }
    .badge-low { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); }

    /* Table */
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.85rem; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--border); }
    th { color: var(--text-muted); font-weight: 600; }
    .hash-tag { font-family: monospace; background: #0f172a; padding: 2px 6px; border-radius: 4px; color: #38bdf8; }
    .action-cell { display: flex; gap: 6px; }
    .empty-state { text-align: center; color: var(--text-muted); padding: 32px; background: #0f172a; border-radius: 8px; }

    /* Footer */
    footer { margin-top: 36px; padding: 18px 0; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; color: var(--text-muted); font-size: 0.85rem; flex-wrap: wrap; gap: 12px; }
    .commit-badge { background: #334155; color: #38bdf8; font-family: monospace; padding: 3px 8px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <h1><span>☁️</span> Cloud Notes Backup System</h1>
        <p>Dynamic Server-Rendered Platform with Git CI/CD & Cloud Snapshots</p>
      </div>
      <div class="status-pill">
        <span class="status-dot"></span> System Live & Healthy
      </div>
    </header>

    ${error ? `<div class="alert alert-error"><strong>Error:</strong> ${escapeHtml(error)}</div>` : ''}
    ${success ? `<div class="alert alert-success">${escapeHtml(success)}</div>` : ''}

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Notes</div>
        <div class="stat-value">${stats.totalNotes}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Backup Snapshots</div>
        <div class="stat-value">${stats.totalBackups}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cloud Storage Used</div>
        <div class="stat-value">${stats.storageSizeBytes} B</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Environment</div>
        <div class="stat-value" style="font-size: 1.2rem; color: #38bdf8;">Production</div>
      </div>
    </div>

    <div class="dashboard-layout">
      <!-- Left Column: Forms -->
      <div>
        <div class="panel">
          <h2 class="panel-title">➕ Create Cloud Note</h2>
          <form method="POST" action="/notes">
            <div class="form-group">
              <label for="title">Note Title *</label>
              <input type="text" id="title" name="title" placeholder="e.g. Kubernetes Cluster Autoscaling" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="category">Category</label>
                <select id="category" name="category">
                  <option value="DevOps">DevOps</option>
                  <option value="Cloud">Cloud</option>
                  <option value="Architecture">Architecture</option>
                  <option value="Security">Security</option>
                  <option value="General">General</option>
                </select>
              </div>
              <div class="form-group">
                <label for="priority">Priority</label>
                <select id="priority" name="priority">
                  <option value="High">High</option>
                  <option value="Medium" selected>Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="tags">Tags (comma-separated)</label>
              <input type="text" id="tags" name="tags" placeholder="e.g. k8s, autoscaler, aws">
            </div>
            <div class="form-group">
              <label for="content">Note Content *</label>
              <textarea id="content" name="content" placeholder="Enter detailed note markdown or text content..." required></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Save to Cloud Notes</button>
          </form>
        </div>

        <div class="panel">
          <h2 class="panel-title">💾 Create Cloud Snapshot</h2>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">
            Trigger an immutable, versioned backup snapshot with SHA-256 integrity verification.
          </p>
          <form method="POST" action="/backups">
            <div class="form-group">
              <label for="snapshotName">Snapshot Name / Label</label>
              <input type="text" id="snapshotName" name="snapshotName" placeholder="e.g. Pre-Deployment Snapshot">
            </div>
            <button type="submit" class="btn btn-success btn-block">Take Instant Backup Snapshot</button>
          </form>
        </div>
      </div>

      <!-- Right Column: Notes List & Filter -->
      <div>
        <div class="panel">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h2 class="panel-title" style="margin-bottom: 0; border: none; padding: 0;">📋 Cloud Notes</h2>
            <a href="/" class="btn btn-secondary btn-sm">Reset Filter</a>
          </div>

          <form method="GET" action="/" style="margin-bottom: 16px;">
            <div class="form-row" style="grid-template-columns: 2fr 1fr 1fr auto;">
              <input type="text" name="query" value="${queryVal}" placeholder="Search notes...">
              <select name="category">
                <option value="All" ${catVal === 'All' ? 'selected' : ''}>All Categories</option>
                <option value="DevOps" ${catVal === 'DevOps' ? 'selected' : ''}>DevOps</option>
                <option value="Cloud" ${catVal === 'Cloud' ? 'selected' : ''}>Cloud</option>
                <option value="Architecture" ${catVal === 'Architecture' ? 'selected' : ''}>Architecture</option>
                <option value="Security" ${catVal === 'Security' ? 'selected' : ''}>Security</option>
                <option value="General" ${catVal === 'General' ? 'selected' : ''}>General</option>
              </select>
              <select name="priority">
                <option value="All" ${prioVal === 'All' ? 'selected' : ''}>All Priority</option>
                <option value="High" ${prioVal === 'High' ? 'selected' : ''}>High</option>
                <option value="Medium" ${prioVal === 'Medium' ? 'selected' : ''}>Medium</option>
                <option value="Low" ${prioVal === 'Low' ? 'selected' : ''}>Low</option>
              </select>
              <button type="submit" class="btn btn-primary btn-sm">Filter</button>
            </div>
          </form>

          <div class="notes-container">
            ${notesHtml}
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Panel: Backup History Table -->
    <div class="panel">
      <h2 class="panel-title">🛡️ Cloud Backup Snapshots History</h2>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>Snapshot ID</th>
              <th>Name / Label</th>
              <th>Items</th>
              <th>SHA-256 Checksum</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${snapshotsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <footer>
      <div>
        <strong>MIT-WPU CCA 2</strong> &bull; Cloud Computing & DevOps (CSE30040)
      </div>
      <div>
        <span>Commit: </span><span class="commit-badge">commit ${commit}</span>
        <span style="margin-left: 12px;">Uptime: <strong>${Math.floor(process.uptime())}s</strong></span>
      </div>
    </footer>
  </div>
</body>
</html>`;
}

// Routes

// Home Dashboard
app.get('/', (req, res) => {
  const { query, category, priority, error, success } = req.query;
  const filter = { query, category, priority };
  const notes = store.getNotes(filter);
  const snapshots = store.getBackupSnapshots();
  const stats = store.getStats();

  res.send(renderDashboard({ notes, snapshots, stats, filter, error, success }));
});

// Form: Add Note
app.post('/notes', (req, res) => {
  const { title, category, priority, tags, content } = req.body;
  if (!title || !title.trim() || !content || !content.trim()) {
    return res.status(400).send(renderDashboard({
      notes: store.getNotes(),
      snapshots: store.getBackupSnapshots(),
      stats: store.getStats(),
      error: 'Note title and content are required fields.',
    }));
  }

  try {
    store.addNote({ title, category, priority, tags, content });
    res.redirect('/?success=Note+created+successfully');
  } catch (err) {
    res.status(400).send(renderDashboard({
      notes: store.getNotes(),
      snapshots: store.getBackupSnapshots(),
      stats: store.getStats(),
      error: err.message,
    }));
  }
});

// Form: Delete Note
app.post('/notes/delete/:id', (req, res) => {
  const { id } = req.params;
  store.deleteNote(id);
  res.redirect('/?success=Note+deleted+successfully');
});

// Form: Create Snapshot
app.post('/backups', (req, res) => {
  const { snapshotName } = req.body;
  store.createBackupSnapshot(snapshotName);
  res.redirect('/?success=Backup+snapshot+created+successfully');
});

// Form: Restore Snapshot
app.post('/backups/restore/:id', (req, res) => {
  try {
    store.restoreBackup(req.params.id);
    res.redirect('/?success=Notes+restored+from+snapshot+successfully');
  } catch (err) {
    res.redirect(`/?error=${encodeURIComponent(err.message)}`);
  }
});

// JSON API: Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    commit,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// JSON API: Notes list and filter
app.get('/api/notes', (req, res) => {
  const { query, category, priority } = req.query;
  const notes = store.getNotes({ query, category, priority });
  res.json({
    count: notes.length,
    notes,
  });
});

// JSON API: Create note
app.post('/api/notes', (req, res) => {
  const { title, category, priority, tags, content } = req.body;
  if (!title || !title.trim() || !content || !content.trim()) {
    return res.status(400).json({
      error: 'Title and content are required fields',
    });
  }

  try {
    const note = store.addNote({ title, category, priority, tags, content });
    res.status(201).json({
      message: 'Note created successfully',
      note,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// JSON API: Delete note
app.delete('/api/notes/:id', (req, res) => {
  const success = store.deleteNote(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Note not found' });
  }
  res.json({ message: 'Note deleted successfully' });
});

// JSON API: Backup Snapshots list
app.get('/api/backups', (req, res) => {
  res.json({
    count: store.getBackupSnapshots().length,
    snapshots: store.getBackupSnapshots(),
  });
});

// JSON API: Create Backup Snapshot
app.post('/api/backups', (req, res) => {
  const { snapshotName } = req.body;
  const snapshot = store.createBackupSnapshot(snapshotName);
  res.status(201).json({
    message: 'Backup snapshot created successfully',
    snapshot,
  });
});

// JSON API: Download Backup Snapshot JSON
app.get('/api/backups/:id/download', (req, res) => {
  const snapshot = store.getBackupById(req.params.id);
  if (!snapshot) {
    return res.status(404).json({ error: 'Backup snapshot not found' });
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${snapshot.id}-backup.json"`);
  res.send(JSON.stringify(snapshot, null, 2));
});

// JSON API: System Stats
app.get('/api/stats', (req, res) => {
  res.json(store.getStats());
});

module.exports = app;
