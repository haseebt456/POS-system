const express = require('express');
const router = express.Router();
const { createStation, getAllStations } = require('../models/station');

// GET /api/stations
router.get('/', (req, res) => {
    try {
        res.json(getAllStations());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/stations
router.post('/', (req, res) => {
    try {
        const id = createStation(req.body);
        res.status(201).json({ id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
