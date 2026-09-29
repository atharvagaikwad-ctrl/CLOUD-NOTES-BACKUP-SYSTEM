const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Cloud Notes Backup System running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
});
