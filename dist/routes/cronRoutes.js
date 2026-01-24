"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cronJobService_1 = require("../services/cronJobService");
const router = (0, express_1.Router)();
const cronJobService = new cronJobService_1.CronJobService();
router.get('/status', (req, res) => {
    try {
        const status = cronJobService.getJobsStatus();
        res.json({
            success: true,
            data: status
        });
    }
    catch (error) {
        console.error('Error getting cron job status:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});
router.post('/trigger/:jobName', async (req, res) => {
    try {
        const { jobName } = req.params;
        await cronJobService.triggerJob(jobName);
        res.json({
            success: true,
            message: `Job ${jobName} triggered successfully`
        });
    }
    catch (error) {
        console.error(`Error triggering job ${req.params.jobName}:`, error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});
router.post('/start/:jobName', (req, res) => {
    try {
        const { jobName } = req.params;
        cronJobService.startJob(jobName);
        res.json({
            success: true,
            message: `Job ${jobName} started successfully`
        });
    }
    catch (error) {
        console.error(`Error starting job ${req.params.jobName}:`, error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});
router.post('/stop/:jobName', (req, res) => {
    try {
        const { jobName } = req.params;
        cronJobService.stopJob(jobName);
        res.json({
            success: true,
            message: `Job ${jobName} stopped successfully`
        });
    }
    catch (error) {
        console.error(`Error stopping job ${req.params.jobName}:`, error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});
router.post('/stop-all', (req, res) => {
    try {
        cronJobService.stopAllJobs();
        res.json({
            success: true,
            message: 'All cron jobs stopped successfully'
        });
    }
    catch (error) {
        console.error('Error stopping all cron jobs:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});
exports.default = router;
