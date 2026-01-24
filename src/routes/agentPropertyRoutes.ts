import express from 'express';
import {
  assignPropertyToAgentEndpoint,
  getAgentProperties,
  getPropertyAgent
} from '../controllers/agentPropertyMatchingController';

const router = express.Router();

// POST /agent-properties/assign - Manually assign a property to an agent
router.post('/assign', assignPropertyToAgentEndpoint);

// GET /agent-properties/agent/:agentId - Get all properties assigned to a specific agent
router.get('/agent/:agentId', getAgentProperties);

// GET /agent-properties/property/:propertyId - Get the agent assigned to a specific property
router.get('/property/:propertyId', getPropertyAgent);

export default router;