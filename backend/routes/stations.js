const express = require('express');
const router = express.Router();
const {
    createStation,
    getAllStations,
    getStationById,
    updateStation,
    deactivateStation,
} = require('../models/station');
const { testStation } = require('../printing/printService');

// GET /api/stations
router.get('/', (req, res) => {
    try {
        res.json(getAllStations());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stations/:id
router.get('/:id', (req, res) => {
    try {
        const station = getStationById(req.params.id);
        if (!station) return res.status(404).json({ error: 'Station not found' });
        res.json(station);
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

// PUT /api/stations/:id
router.put('/:id', (req, res) => {
    try {
        if (!getStationById(req.params.id)) {
            return res.status(404).json({ error: 'Station not found' });
        }
        updateStation(req.params.id, req.body);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/stations/:id  (soft delete — order_items reference stations by id)
router.delete('/:id', (req, res) => {
    try {
        deactivateStation(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/stations/:id/test-print
// Sends a small test ticket to this one station. This is the button that confirms a
// printer the moment it's plugged in, without ringing up a real order.
router.post('/:id/test-print', async (req, res) => {
    try {
        res.json(await testStation(req.params.id));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
