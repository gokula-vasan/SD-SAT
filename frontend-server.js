const express = require('express');
const path = require('path');

const app = express();
const FRONTEND_PORT = process.env.FRONTEND_PORT || 3000;

// Serve public static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(FRONTEND_PORT, () => {
  console.log(`====================================================`);
  console.log(`🌐 FRONTEND SERVER RUNNING`);
  console.log(`🚀 Access UI in Browser: http://localhost:${FRONTEND_PORT}`);
  console.log(`🔗 Connected to Backend API: http://localhost:5000/api`);
  console.log(`====================================================`);
});
