const { generateChecksum } = require('./utils');

// In-memory data structures
let notes = [
  {
    id: 1,
    title: 'AWS S3 Replication & Lifecycle Architecture',
    category: 'Architecture',
    priority: 'High',
    tags: ['aws', 's3', 'replication'],
    content: 'Cross-Region Replication (CRR) configured with automated GLACIER tiering after 30 days for disaster recovery.',
    createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
  },
  {
    id: 2,
    title: 'CI/CD Automated Deployment Gate Rules',
    category: 'DevOps',
    priority: 'High',
    tags: ['github-actions', 'render', 'docker'],
    content: 'All commits to main branch must pass linting, 100% unit tests, and Docker container smoke tests before triggering Render hook.',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 3,
    title: 'Cloud Security IAM Zero Trust Checklist',
    category: 'Cloud',
    priority: 'Medium',
    tags: ['security', 'iam', 'least-privilege'],
    content: 'Enforce MFA for all root and administrative accounts. Rotate service credentials every 90 days with audit logging.',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
];

let nextNoteId = 4;
let nextBackupId = 1;

let backupSnapshots = [
  {
    id: 'snap-001',
    snapshotName: 'Initial Cloud Baseline Snapshot',
    noteCount: 3,
    hashChecksum: generateChecksum(notes),
    sizeBytes: JSON.stringify(notes).length,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    notesSnapshot: JSON.parse(JSON.stringify(notes)),
  },
];

const store = {
  getNotes(filter = {}) {
    let result = [...notes];
    if (filter.category && filter.category !== 'All') {
      result = result.filter((n) => n.category.toLowerCase() === filter.category.toLowerCase());
    }
    if (filter.priority && filter.priority !== 'All') {
      result = result.filter((n) => n.priority.toLowerCase() === filter.priority.toLowerCase());
    }
    if (filter.query) {
      const q = filter.query.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  },

  getAllNotesRaw() {
    return [...notes];
  },

  getNoteById(id) {
    const numId = Number(id);
    return notes.find((n) => n.id === numId);
  },

  addNote({ title, category = 'General', priority = 'Medium', content, tags = [] }) {
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new Error('Note title is required and cannot be empty.');
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      throw new Error('Note content is required and cannot be empty.');
    }

    const validCategories = ['DevOps', 'Cloud', 'Architecture', 'Security', 'General'];
    const selectedCategory = validCategories.includes(category) ? category : 'General';

    const validPriorities = ['Low', 'Medium', 'High'];
    const selectedPriority = validPriorities.includes(priority) ? priority : 'Medium';

    const processedTags = Array.isArray(tags)
      ? tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
      : typeof tags === 'string'
        ? tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
        : [];

    const newNote = {
      id: nextNoteId++,
      title: title.trim(),
      category: selectedCategory,
      priority: selectedPriority,
      tags: processedTags,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    notes.unshift(newNote);
    return newNote;
  },

  deleteNote(id) {
    const numId = Number(id);
    const index = notes.findIndex((n) => n.id === numId);
    if (index === -1) {
      return false;
    }
    notes.splice(index, 1);
    return true;
  },

  createBackupSnapshot(snapshotName) {
    const name = snapshotName && typeof snapshotName === 'string' && snapshotName.trim()
      ? snapshotName.trim()
      : `Backup Snapshot #${nextBackupId}`;

    const notesCopy = JSON.parse(JSON.stringify(notes));
    const rawJson = JSON.stringify(notesCopy);
    const checksum = generateChecksum(rawJson);

    const snapshot = {
      id: `snap-${String(nextBackupId++).padStart(3, '0')}`,
      snapshotName: name,
      noteCount: notesCopy.length,
      hashChecksum: checksum,
      sizeBytes: Buffer.byteLength(rawJson, 'utf8'),
      createdAt: new Date().toISOString(),
      notesSnapshot: notesCopy,
    };

    backupSnapshots.unshift(snapshot);
    return snapshot;
  },

  getBackupSnapshots() {
    return backupSnapshots.map((snap) => ({
      id: snap.id,
      snapshotName: snap.snapshotName,
      noteCount: snap.noteCount,
      hashChecksum: snap.hashChecksum,
      sizeBytes: snap.sizeBytes,
      createdAt: snap.createdAt,
    }));
  },

  getBackupById(id) {
    return backupSnapshots.find((s) => s.id === id);
  },

  restoreBackup(id) {
    const snapshot = backupSnapshots.find((s) => s.id === id);
    if (!snapshot) {
      throw new Error(`Backup snapshot ${id} not found.`);
    }
    notes = JSON.parse(JSON.stringify(snapshot.notesSnapshot));
    return notes;
  },

  getStats() {
    const totalNotes = notes.length;
    const totalBackups = backupSnapshots.length;
    const totalSizeBytes = Buffer.byteLength(JSON.stringify(notes), 'utf8');
    const categoriesCount = notes.reduce((acc, note) => {
      acc[note.category] = (acc[note.category] || 0) + 1;
      return acc;
    }, {});

    return {
      totalNotes,
      totalBackups,
      storageSizeBytes: totalSizeBytes,
      categoriesCount,
      lastBackupAt: backupSnapshots.length > 0 ? backupSnapshots[0].createdAt : null,
    };
  },

  resetStore() {
    notes = [];
    backupSnapshots = [];
    nextNoteId = 1;
    nextBackupId = 1;
  },
};

module.exports = store;
