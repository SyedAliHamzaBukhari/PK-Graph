const express = require('express');
const router = express.Router();

// Placeholder routes for links
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Links endpoints - Coming soon',
    requestId: req.id
  });
});

module.exports = router;