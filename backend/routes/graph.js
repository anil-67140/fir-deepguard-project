const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authMiddleware } = require('./auth');
const { Transaction, FinancialEntity } = require('../models/Transaction');

// GET /api/graph/:upload_id — full network graph for Cytoscape.js
router.get('/:upload_id', authMiddleware, async (req, res) => {
  try {
    const { upload_id } = req.params;
    const { flagged_only = 'true', max_nodes = 200 } = req.query;

    const filter = { upload_id };
    if (flagged_only === 'true') filter.is_flagged = true;

    // Get transactions
    const transactions = await Transaction.find(filter)
      .sort({ risk_score: -1 })
      .limit(parseInt(max_nodes))
      .select('from_account to_account from_bank to_bank amount_paid risk_score risk_level is_flagged fraud_category');

    // Build Cytoscape.js compatible graph
    const nodesMap = new Map();
    const edges = [];

    for (const tx of transactions) {
      const fromId = tx.from_account || 'unknown_src';
      const toId = tx.to_account || 'unknown_dst';

      // Add source node
      if (!nodesMap.has(fromId)) {
        nodesMap.set(fromId, {
          data: {
            id: fromId,
            label: fromId.substring(0, 10),
            bank: tx.from_bank || '',
            type: 'account',
            risk_score: tx.risk_score,
            is_flagged: tx.is_flagged
          }
        });
      } else {
        // Update max risk
        const existing = nodesMap.get(fromId);
        if (tx.risk_score > existing.data.risk_score) {
          existing.data.risk_score = tx.risk_score;
          existing.data.is_flagged = tx.is_flagged;
        }
      }

      // Add destination node
      if (!nodesMap.has(toId)) {
        nodesMap.set(toId, {
          data: {
            id: toId,
            label: toId.substring(0, 10),
            bank: tx.to_bank || '',
            type: 'account',
            risk_score: 0,
            is_flagged: false
          }
        });
      }

      // Add edge
      edges.push({
        data: {
          id: `${fromId}-${toId}-${tx._id}`,
          source: fromId,
          target: toId,
          amount: tx.amount_paid,
          risk_score: tx.risk_score,
          risk_level: tx.risk_level,
          is_flagged: tx.is_flagged,
          fraud_category: tx.fraud_category,
          transaction_id: tx._id.toString()
        }
      });
    }

    const nodes = Array.from(nodesMap.values());

    res.json({
      nodes,
      edges,
      stats: {
        total_nodes: nodes.length,
        total_edges: edges.length,
        flagged_nodes: nodes.filter(n => n.data.is_flagged).length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/graph/:upload_id/trace/:account_id — deep trace with $graphLookup
router.get('/:upload_id/trace/:account_id', authMiddleware, async (req, res) => {
  try {
    const { upload_id } = req.params;
    const { account_id } = req.params;
    const { depth = 5 } = req.query;

    // MongoDB $graphLookup — trace money trail up to N levels deep
    const result = await FinancialEntity.aggregate([
      // Start from the target account
      {
        $match: {
          account_id: account_id,
          upload_id: mongoose.Types.ObjectId(upload_id)
        }
      },
      // Recursive graph traversal
      {
        $graphLookup: {
          from: 'financialentities',
          startWith: '$connections',
          connectFromField: 'connections',
          connectToField: 'account_id',
          as: 'network',
          maxDepth: parseInt(depth),
          restrictSearchWithMatch: { upload_id: mongoose.Types.ObjectId(upload_id) },
          depthField: 'depth_level'
        }
      }
    ]);

    if (!result || result.length === 0) {
      return res.json({ nodes: [], edges: [], message: 'Account not found in graph' });
    }

    const root = result[0];
    const network = root.network || [];

    // Build Cytoscape nodes and edges
    const nodes = [
      {
        data: {
          id: root.account_id,
          label: root.account_id.substring(0, 10),
          bank: root.bank_id,
          is_root: true,
          flagged_count: root.flagged_count,
          max_risk_score: root.max_risk_score,
          depth: 0
        }
      },
      ...network.map(entity => ({
        data: {
          id: entity.account_id,
          label: entity.account_id.substring(0, 10),
          bank: entity.bank_id,
          is_root: false,
          flagged_count: entity.flagged_count,
          max_risk_score: entity.max_risk_score,
          depth: entity.depth_level
        }
      }))
    ];

    // Get transactions between these accounts for edge data
    const allAccounts = [root.account_id, ...network.map(e => e.account_id)];
    const txEdges = await Transaction.find({
      upload_id,
      from_account: { $in: allAccounts },
      to_account: { $in: allAccounts }
    }).select('from_account to_account amount_paid risk_score risk_level is_flagged');

    const edges = txEdges.map(tx => ({
      data: {
        id: `${tx.from_account}-${tx.to_account}-${tx._id}`,
        source: tx.from_account,
        target: tx.to_account,
        amount: tx.amount_paid,
        risk_score: tx.risk_score,
        is_flagged: tx.is_flagged
      }
    }));

    res.json({
      root_account: root.account_id,
      depth_traced: parseInt(depth),
      nodes,
      edges,
      stats: {
        total_accounts: nodes.length,
        total_connections: edges.length,
        suspicious_accounts: nodes.filter(n => n.data.max_risk_score > 50).length
      }
    });
  } catch (error) {
    console.error('Graph trace error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
