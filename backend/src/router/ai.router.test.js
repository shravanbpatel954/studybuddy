const express = require('express');
const router = express.Router();

router.post('/solve-doubt', function(req, res) {
    res.json({ message: 'Test response' });
});

module.exports = router;