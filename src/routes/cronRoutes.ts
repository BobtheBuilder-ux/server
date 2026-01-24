import { Router } from 'express';
import { CronJobService } from '../services/cronJobService';

const router = Router();
const cronJobService = new CronJobService();

/**
 * Get status of all cron jobs
 */
router.get('/status', (req, res) => {
  try {
    const status = cronJobService.getJobsStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting cron job status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Manually trigger a specific cron job
 */
router.post('/trigger/:jobName', async (req, res) => {
  try {
    const { jobName } = req.params;
    
    await cronJobService.triggerJob(jobName);
    
    res.json({
      success: true,
      message: `Job ${jobName} triggered successfully`
    });
  } catch (error) {
    console.error(`Error triggering job ${req.params.jobName}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Start a specific cron job
 */
router.post('/start/:jobName', (req, res) => {
  try {
    const { jobName } = req.params;
    
    cronJobService.startJob(jobName);
    
    res.json({
      success: true,
      message: `Job ${jobName} started successfully`
    });
  } catch (error) {
    console.error(`Error starting job ${req.params.jobName}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Stop a specific cron job
 */
router.post('/stop/:jobName', (req, res) => {
  try {
    const { jobName } = req.params;
    
    cronJobService.stopJob(jobName);
    
    res.json({
      success: true,
      message: `Job ${jobName} stopped successfully`
    });
  } catch (error) {
    console.error(`Error stopping job ${req.params.jobName}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Stop all cron jobs
 */
router.post('/stop-all', (req, res) => {
  try {
    cronJobService.stopAllJobs();
    
    res.json({
      success: true,
      message: 'All cron jobs stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping all cron jobs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router;