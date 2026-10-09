import express from 'express';
import { Customer, Shipment, Message } from '../db/models.js';
import { sendEmail } from '../services/emailService.js';
import { requireUser, requireAdmin, attachUser, signToken, safeEqual, getAdminCode, getAdminEmail, loginLimiter, lookupLimiter } from '../services/auth.js';

const router = express.Router();

// WebSocket broadcast helper register (mounted from server.js)
let wssInstance = null;
export function setWssInstance(wss) {
  wssInstance = wss;
}

/** Remove fields customers must never see (internal notes). */
export function sanitizeShipment(shipment, isAdmin) {
  const obj = typeof shipment.toObject === 'function' ? shipment.toObject() : { ...shipment };
  if (!isAdmin) delete obj.internalNotes;
  // The photo itself is served by GET /shipments/:id/image; lists only carry its address.
  delete obj.packageImage;
  obj.packageImage = obj.imageVersion > 0 ? `/shipments/${obj.id}/image?v=${obj.imageVersion}` : '';
  return obj;
}

/** Accepts '' (remove) or a small PNG/JPEG/WEBP/GIF data URL. Returns null when invalid. */
function cleanImage(value) {
  if (value === '' || value === null) return '';
  if (typeof value !== 'string' || value.length > 4_000_000) return null;
  return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : null;
}

/**
 * Schedule when a shipment starts moving. Progress stays at 0 until that moment, then runs
 * automatically until the estimated delivery date.
 */
function scheduleStart(shipment, startAt) {
  const startMs = new Date(startAt).getTime();
  if (!Number.isFinite(startMs)) return false;
  const sim = shipment.simulation || {};
  const eta = String(shipment.eta || '');
  const endMs = /^\d{4}-\d{2}-\d{2}$/.test(eta) ? Date.parse(`${eta}T17:00:00Z`) : Date.parse(eta);
  let hours = Number.isFinite(endMs) ? (endMs - startMs) / 3600000 : NaN;
  if (!Number.isFinite(hours) || hours < 1) hours = sim.durationHours || 72;
  sim.active = true;
  sim.startedAt = startMs;
  sim.startProgress = 0;
  sim.currentProgress = 0;
  sim.durationHours = Math.round(hours * 10) / 10;
  sim.logs = `Shipment scheduled to start on ${new Date(startMs).toUTCString()}.`;
  shipment.simulation = sim;
  if (startMs > Date.now()) {
    shipment.status = 'Registered';
    shipment.currentLocationName = `Scheduled for departure at ${shipment.origin}`;
  }
  return true;
}

/**
 * Send a live event only to administrators and to the customer who owns the data.
 * Sockets that did not present a valid session token never receive anything.
 */
function emitScoped(type, payload, ownerEmail, customerPayload) {
  if (!wssInstance) return;
  const owner = (ownerEmail || '').trim().toLowerCase();
  const adminMsg = JSON.stringify({ type, payload });
  const customerMsg = customerPayload === undefined ? adminMsg : JSON.stringify({ type, payload: customerPayload });
  wssInstance.clients.forEach(client => {
    if (client.readyState !== 1 || !client.user) return; // 1 = OPEN
    if (client.user.role === 'admin') client.send(adminMsg);
    else if (owner && client.user.email && client.user.email.toLowerCase() === owner) client.send(customerMsg);
  });
}

export function broadcastShipmentUpdate(shipment) {
  emitScoped('SHIPMENT_UPDATE', sanitizeShipment(shipment, true), shipment.customerEmail, sanitizeShipment(shipment, false));
}
/**
 * Autonomous Time-Based Progress Engine
 * Advances shipment simulation based on elapsed real-world time.
 * Operates 24/7 autonomously up to 7 days (168 hours) or custom duration.
 */
export function updateShipmentAutoProgress(shipment) {
  if (!shipment || !shipment.simulation || !shipment.simulation.active) {
    return false;
  }

  const sim = shipment.simulation;
  const startedAt = Number(sim.startedAt) || 0;
  const durationHours = Math.max(0.1, Number(sim.durationHours) || 72);
  const durationMs = durationHours * 3600 * 1000;
  const startProgress = Math.max(0, Math.min(100, Number(sim.startProgress) || 0));

  if (!startedAt || durationMs <= 0) return false;

  const now = Date.now();
  const elapsed = Math.max(0, now - startedAt);
  const fraction = Math.min(1, elapsed / durationMs);

  let calculatedProg = startProgress + fraction * (100 - startProgress);
  calculatedProg = Math.min(100, Math.max(0, Math.round(calculatedProg * 100) / 100));

  let changed = false;
  if (Math.abs((sim.currentProgress || 0) - calculatedProg) >= 0.05) {
    sim.currentProgress = calculatedProg;
    changed = true;
  }

  const waypoints = sim.waypoints && sim.waypoints.length > 0 ? sim.waypoints : [shipment.originCode || 'ORG', shipment.destCode || 'DST'];
  const numWp = waypoints.length;

  if (calculatedProg >= 100) {
    if (shipment.status !== 'Delivered') {
      shipment.status = 'Delivered';
      shipment.currentLocationName = `Delivered at destination (${shipment.destination})`;
      sim.logs = 'Package successfully delivered. Signed and verified at destination.';
      sim.active = false; // Autonomous run completed
      changed = true;
    }
  } else if (calculatedProg >= 85) {
    if (shipment.status !== 'Out for Delivery') {
      shipment.status = 'Out for Delivery';
      shipment.currentLocationName = `Local Delivery Terminal near ${shipment.destination}`;
      sim.logs = `Out for final courier delivery in ${shipment.destination}.`;
      changed = true;
    }
  } else if (calculatedProg >= 20) {
    if (shipment.status !== 'In Transit') {
      shipment.status = 'In Transit';
      changed = true;
    }
    const wpIdx = Math.min(numWp - 1, Math.floor((calculatedProg / 100) * numWp));
    const currentWp = waypoints[wpIdx] || shipment.destination;
    const expectedLoc = `In transit near ${currentWp} via ${shipment.vessel || 'Freight'}`;
    if (shipment.currentLocationName !== expectedLoc) {
      shipment.currentLocationName = expectedLoc;
      sim.logs = `Autonomous transit active: Passing logistics hub ${currentWp}.`;
      changed = true;
    }
  } else if (calculatedProg > 0) {
    if (shipment.status !== 'Warehouse') {
      shipment.status = 'Warehouse';
      shipment.currentLocationName = `Departing origin sort facility: ${shipment.origin}`;
      sim.logs = `Cargo cleared security and departed origin facility ${shipment.origin}.`;
      changed = true;
    }
  }

  return changed;
}

// 1. Authentication Router API
//    Customers sign in with the tracking number on their shipment.
//    The administrator signs in with ADMIN_TRACKING_CODE (set in the server environment).
router.post('/auth/login', loginLimiter, async (req, res) => {
  const { trackingNumber, accessCode, email } = req.body || {};
  const inputCode = String(trackingNumber || accessCode || email || '').trim();

  if (!inputCode) {
    return res.status(400).json({ error: 'Please enter your tracking number or admin access key.' });
  }

  const cleanInput = inputCode.toUpperCase();
  const adminCode = getAdminCode();

  try {
    // 1. Administrator
    if (adminCode && safeEqual(cleanInput, adminCode)) {
      req.clearFailedLogins();
      const adminEmail = getAdminEmail();
      return res.json({
        email: adminEmail,
        name: 'AGL System Administrator',
        role: 'admin',
        trackingNumber: '',
        token: signToken({ role: 'admin', email: adminEmail })
      });
    }

    // 2. Customer: look up the shipment by its tracking number
    const shipment = await Shipment.findOne({ id: cleanInput });
    if (shipment) {
      req.clearFailedLogins();
      const customerEmail = shipment.customerEmail.toLowerCase();
      const customer = await Customer.findOne({ email: customerEmail });
      return res.json({
        email: customerEmail,
        name: shipment.customerName || customer?.name || 'Valued Customer',
        role: 'customer',
        trackingNumber: shipment.id,
        token: signToken({ role: 'customer', email: customerEmail, trackingNumber: shipment.id })
      });
    }

    req.recordFailedLogin();
    return res.status(401).json({ error: 'Tracking number not recognized. Please check your tracking number and try again.' });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Server authentication crash.' });
  }
});
// 2. Fetch Customer Shipments / Admin Directories
router.get('/shipments', requireUser, async (req, res) => {
  const isAdmin = req.user.role === 'admin';

  try {
    let query = {};
    if (isAdmin) {
      const { email, trackingNumber } = req.query;
      if (trackingNumber) {
        query.id = String(trackingNumber).trim().toUpperCase();
      } else if (email && String(email).trim().toLowerCase() !== getAdminEmail()) {
        query.customerEmail = String(email).trim().toLowerCase();
      }
    } else {
      // A customer can only ever list their own shipments, whatever the query says.
      query.customerEmail = req.user.email;
    }

    const shipments = await Shipment.find(query).sort({ createdAt: -1 });
    for (const s of shipments) {
      if (updateShipmentAutoProgress(s)) {
        await s.save();
      }
    }
    res.json(shipments.map(s => sanitizeShipment(s, isAdmin)));
  } catch (error) {
    console.error('Error retrieving shipments:', error);
    res.status(500).json({ error: 'Database read failure.' });
  }
});
// 3. Retrieve Single Shipment Details
router.get('/shipments/:id', attachUser, lookupLimiter, async (req, res) => {
  const { id } = req.params;
  try {
    const shipment = await Shipment.findOne({ id: id.toUpperCase() });
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment ID not registered.' });
    }
    if (updateShipmentAutoProgress(shipment)) {
      await shipment.save();
    }
    res.json(sanitizeShipment(shipment, req.user?.role === 'admin'));
  } catch (error) {
    console.error('Error searching shipment details:', error);
    res.status(500).json({ error: 'Database search fault.' });
  }
});

// 3b. Package photo, streamed as an image so <img> tags can load it (and browsers can cache it)
router.get('/shipments/:id/image', async (req, res) => {
  try {
    const shipment = await Shipment.findOne({ id: String(req.params.id).toUpperCase() }).select('+packageImage');
    const data = shipment && shipment.packageImage;
    const m = data && data.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/);
    if (!m) return res.status(404).send('No package photo for this shipment.');
    res.setHeader('Content-Type', m[1]);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(m[2], 'base64'));
  } catch (error) {
    console.error('Error serving package photo:', error);
    res.status(500).send('Could not load the package photo.');
  }
});

// 4. Admin Dispatch Appointment (Insert Cargo Row)
router.post('/shipments', requireAdmin, async (req, res) => {
  const sData = req.body;

  try {
    if (!sData || !sData.customerEmail || !sData.customerName || !sData.id) {
      return res.status(400).json({ error: 'Missing required shipment parameters.' });
    }

    // Check if tracking number already in database
    const existing = await Shipment.findOne({ id: sData.id.toUpperCase() });
    if (existing) {
      return res.status(400).json({ error: 'Tracking number code duplicate.' });
    }

    const newShipment = new Shipment({
      id: sData.id,
      senderName: sData.senderName || '',
      senderPhone: sData.senderPhone || '',
      senderEmail: sData.senderEmail || '',
      senderAddress: sData.senderAddress || '',
      customerName: sData.customerName,
      customerEmail: sData.customerEmail,
      customerPhone: sData.customerPhone,
      address: sData.address,
      weight: sData.weight,
      desc: sData.desc,
      vessel: sData.vessel,
      origin: sData.origin,
      destination: sData.destination,
      originCode: sData.originCode || 'CHI',
      destCode: sData.destCode || 'SEA',
      eta: sData.eta,
      internalNotes: sData.internalNotes || '',
      packageImage: cleanImage(sData.packageImage) || '',
      imageVersion: cleanImage(sData.packageImage) ? Date.now() : 0,
      amount: Number(sData.amount) > 0 ? Number(sData.amount) : 0,
      paymentStatus: 'Unpaid',
      status: 'Registered',
      currentLocationName: `Scheduled for departure at ${sData.origin}`,
      simulation: {
        active: false,
        currentProgress: 0,
        waypoints: sData.waypoints || ['CHI', 'KC', 'DEN', 'SEA'],
        speedMultiplier: 1,
        logs: 'Shipping appointment created in database.'
      }
    });

    if (sData.packageImage && cleanImage(sData.packageImage) === null) {
      return res.status(400).json({ error: 'That picture could not be used. Please upload a PNG, JPG or WEBP image.' });
    }
    if (sData.startAt) scheduleStart(newShipment, sData.startAt);

    await newShipment.save();

    // Check or update customer record without password requirement
    const custEmail = sData.customerEmail.trim().toLowerCase();
    
    await Customer.findOneAndUpdate(
      { email: custEmail },
      { 
        $inc: { volume: 1 }, 
        name: sData.customerName
      },
      { upsert: true, new: true }
    );

    // Response: shipment (photo as a small URL) + the tracking details for the admin to share.
    // No email is sent automatically; use the Email Center to message the customer yourself.
    const responsePayload = sanitizeShipment(newShipment, true);
    responsePayload.credentials = {
      email: custEmail,
      trackingId: newShipment.id
    };
    broadcastShipmentUpdate(newShipment);
    res.status(201).json(responsePayload);
  } catch (error) {
    console.error('Error registering cargo shipment:', error);
    res.status(500).json({ error: 'Database write error. Check parameter formats.' });
  }
});

// 4b. Admin Edit Shipment Details (customer, cargo, route, status, ETA, notes)
router.put('/shipments/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const u = req.body || {};

  try {
    const shipment = await Shipment.findOne({ id: id.toUpperCase() });
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found.' });
    }

    if (u.vessel !== undefined && !['Truck', 'Plane', 'Ship'].includes(u.vessel)) {
      return res.status(400).json({ error: 'Invalid vessel type.' });
    }
    if (u.weight !== undefined && (u.weight === '' || isNaN(Number(u.weight)))) {
      return res.status(400).json({ error: 'Weight must be a number.' });
    }

    const oldEmail = (shipment.customerEmail || '').trim().toLowerCase();
    const newEmail = u.customerEmail !== undefined ? String(u.customerEmail).trim().toLowerCase() : oldEmail;
    if (!newEmail) {
      return res.status(400).json({ error: 'Customer email is required.' });
    }

    const textFields = ['customerName', 'customerPhone', 'address', 'desc', 'vessel', 'origin', 'destination',
      'originCode', 'destCode', 'eta', 'internalNotes', 'status', 'currentLocationName'];
    for (const f of textFields) {
      if (u[f] !== undefined) shipment[f] = u[f];
    }
    if (u.weight !== undefined) shipment.weight = Number(u.weight);
    if (u.amount !== undefined) {
      const amt = Number(u.amount);
      if (isNaN(amt) || amt < 0) return res.status(400).json({ error: 'Amount must be a positive number.' });
      shipment.amount = amt;
    }
    if (u.paymentStatus !== undefined) {
      if (!['Paid', 'Unpaid'].includes(u.paymentStatus)) return res.status(400).json({ error: 'Invalid payment status.' });
      shipment.paymentStatus = u.paymentStatus;
    }
    shipment.customerEmail = newEmail;

    if (u.packageImage !== undefined) {
      const img = cleanImage(u.packageImage);
      if (img === null) return res.status(400).json({ error: 'That picture could not be used. Please upload a PNG, JPG or WEBP image.' });
      shipment.packageImage = img;
      shipment.imageVersion = img ? Date.now() : 0;
    }
    if (u.startAt) {
      if (!scheduleStart(shipment, u.startAt)) return res.status(400).json({ error: 'Start time is not a valid date.' });
    }

    if (Array.isArray(u.waypoints) && u.waypoints.length >= 2) {
      shipment.simulation.waypoints = u.waypoints;
    }

    await shipment.save();

    // Keep customer records consistent when the shipment is reassigned
    if (newEmail !== oldEmail) {
      await Customer.findOneAndUpdate({ email: oldEmail }, { $inc: { volume: -1 } });
      const oldCust = await Customer.findOne({ email: oldEmail });
      if (oldCust && oldCust.volume <= 0) await Customer.deleteOne({ email: oldEmail });

      const newCust = await Customer.findOne({ email: newEmail });
      await Customer.findOneAndUpdate(
        { email: newEmail },
        { $inc: { volume: 1 }, name: shipment.customerName },
        { upsert: true, new: true }
      );
    } else if (u.customerName !== undefined) {
      await Customer.findOneAndUpdate({ email: newEmail }, { name: shipment.customerName });
    }

    broadcastShipmentUpdate(shipment);
    res.json(sanitizeShipment(shipment, true));
  } catch (error) {
    console.error('Error editing shipment:', error);
    res.status(500).json({ error: 'Shipment update failed.' });
  }
});

// 5. Update Live Simulation Controls (Play, Pause, Stop, Waypoints, Logs, Status, Duration)
router.put('/shipments/:id/simulation', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const shipment = await Shipment.findOne({ id: id.toUpperCase() });
    if (!shipment) {
      return res.status(404).json({ error: 'Target shipment not registered.' });
    }

    // Apply updates
    if (updates.status !== undefined) shipment.status = updates.status;
    if (updates.currentLocationName !== undefined) shipment.currentLocationName = updates.currentLocationName;
    if (updates.vessel !== undefined) shipment.vessel = updates.vessel;
    
    if (updates.simulation) {
      const sim = shipment.simulation || {};
      
      if (updates.simulation.active !== undefined) {
        sim.active = Boolean(updates.simulation.active);
        if (sim.active) {
          const durHours = updates.simulation.durationHours !== undefined 
            ? Number(updates.simulation.durationHours) 
            : (sim.durationHours || 72);
          sim.durationHours = durHours;
          sim.startedAt = updates.simulation.startedAt || Date.now();
          sim.startProgress = updates.simulation.currentProgress !== undefined 
            ? Number(updates.simulation.currentProgress) 
            : (sim.currentProgress || 0);

          // Calculate estimated delivery date based on autonomous duration
          const etaDate = new Date(sim.startedAt + durHours * 3600 * 1000);
          shipment.eta = etaDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          if (shipment.status === 'Registered') {
            shipment.status = 'In Transit';
          }
        }
      }

      if (updates.simulation.durationHours !== undefined) {
        sim.durationHours = Number(updates.simulation.durationHours);
        if (sim.active) {
          sim.startedAt = Date.now();
          sim.startProgress = sim.currentProgress || 0;
          const etaDate = new Date(sim.startedAt + sim.durationHours * 3600 * 1000);
          shipment.eta = etaDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
      }

      if (updates.simulation.currentProgress !== undefined) {
        sim.currentProgress = Number(updates.simulation.currentProgress);
        sim.startProgress = sim.currentProgress;
        if (sim.active) {
          sim.startedAt = Date.now();
        }
      }

      if (updates.simulation.waypoints !== undefined) sim.waypoints = updates.simulation.waypoints;
      if (updates.simulation.speedMultiplier !== undefined) sim.speedMultiplier = updates.simulation.speedMultiplier;
      if (updates.simulation.logs !== undefined) sim.logs = updates.simulation.logs;

      shipment.simulation = sim;
    }

    updateShipmentAutoProgress(shipment);
    await shipment.save();

    // Broadcast live update to Socket channels!
    broadcastShipmentUpdate(shipment);

    res.json(sanitizeShipment(shipment, true));
  } catch (error) {
    console.error('Simulation write error:', error);
    res.status(500).json({ error: 'Simulation save failed.' });
  }
});

// 6. Fetch Admin Statistics
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const totalShipments = await Shipment.countDocuments();
    const inTransit = await Shipment.countDocuments({ status: 'In Transit' });
    const delivered = await Shipment.countDocuments({ status: 'Delivered' });

    // Fetch lists
    const recentShipments = await Shipment.find().sort({ createdAt: -1 }).limit(10);
    const customers = await Customer.find().sort({ volume: -1 });

    res.json({
      metrics: {
        customers: totalCustomers,
        shipments: totalShipments,
        transit: inTransit,
        delivered: delivered
      },
      recentShipments: recentShipments.map(s => sanitizeShipment(s, true)),
      customers
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Stats computation crash.' });
  }
});

// 7. Delete Shipment (Admin Only)
router.delete('/shipments/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Shipment.findOneAndDelete({ id: id.toUpperCase() });
    if (!deleted) {
      return res.status(404).json({ error: 'Shipment not found.' });
    }
    
    // Decrease customer volume count
    const custEmail = deleted.customerEmail.trim().toLowerCase();
    await Customer.findOneAndUpdate(
      { email: custEmail },
      { $inc: { volume: -1 } }
    );
    
    // Delete customer if volume reaches 0
    const checkCust = await Customer.findOne({ email: custEmail });
    if (checkCust && checkCust.volume <= 0) {
      await Customer.deleteOne({ email: custEmail });
    }
    
    emitScoped('SHIPMENT_DELETED', { id: id.toUpperCase() }, deleted.customerEmail);

    res.json({ success: true, message: 'Shipment deleted successfully.' });
  } catch (error) {
    console.error('Error deleting shipment:', error);
    res.status(500).json({ error: 'Database delete failure.' });
  }
});

// 8. Admin Direct Email Dispatch Endpoint
router.post('/admin/send-email', requireAdmin, async (req, res) => {
  const { toEmail, recipientName, subject, messageBody, templateType, shipmentId, buttonUrl } = req.body;

  if (!toEmail || !toEmail.trim()) {
    return res.status(400).json({ error: 'Recipient email address is required.' });
  }
  if (!messageBody || !messageBody.trim()) {
    return res.status(400).json({ error: 'Message body cannot be empty.' });
  }

  try {
    let shipmentData = null;
    if (shipmentId) {
      shipmentData = await Shipment.findOne({ id: shipmentId.toUpperCase() });
    }

    const targetEmail = toEmail.trim().toLowerCase();
    const customerUser = await Customer.findOne({ email: targetEmail });
    const customerPass = customerUser?.password || '';

    const result = await sendEmail({
      to: targetEmail,
      recipientName: recipientName,
      senderName: shipmentData?.senderName || req.body.senderName || '',
      senderPhone: shipmentData?.senderPhone || req.body.senderPhone || '',
      subject: subject,
      messageBody: messageBody,
      templateType: templateType,
      shipment: shipmentData,
      credentials: {
        email: targetEmail,
        password: customerPass
      }
    });

    res.json({
      success: true,
      message: result.simulated ? 'Email simulated in backend console.' : 'Email sent successfully via Resend API.',
      id: result.id
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: error.message || 'Failed to dispatch email.' });
  }
});

// --- INBOUND & MESSAGING SYSTEM ENDPOINTS ---

// Helper: Strip quoted email reply lines
function stripQuotedReplyText(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const cleanLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^On\s+.*wrote:\s*$/i.test(trimmed) ||
        /^On\s+.*<.*>:\s*$/i.test(trimmed) ||
        /^-+Original Message-+/i.test(trimmed) ||
        /^>/.test(trimmed)) {
      break;
    }
    cleanLines.push(line);
  }
  const result = cleanLines.join('\n').trim();
  return result || text.trim();
}

// 9. Inbound Webhook Endpoint (Resend / SendGrid / Mailgun / Cloudflare Worker Parse)
router.post('/inbound-email', async (req, res) => {
  // Security Verification (if secret is configured in env)
  const webhookSecret = process.env.INBOUND_WEBHOOK_SECRET;
  if (webhookSecret) {
    const reqSecret = req.headers['x-webhook-secret'] || req.query.secret || req.body.secret || req.headers['authorization']?.replace('Bearer ', '');
    if (reqSecret !== webhookSecret) {
      console.warn('[INBOUND WEBHOOK] Unauthorized request received.');
      return res.status(401).json({ error: 'Unauthorized webhook secret.' });
    }
  }

  try {
    const rawReqBody = req.body || {};
    console.log('[INBOUND WEBHOOK RECEIVED]:', JSON.stringify(rawReqBody, null, 2));

    const payload = rawReqBody.data || rawReqBody.payload || rawReqBody;
    
    // Extract Sender Email
    let rawFrom = payload.from || payload.sender || payload.envelope?.from || payload.fromEmail || payload['stripped-prefix'] || '';
    if (typeof rawFrom === 'object' && rawFrom !== null) {
      rawFrom = rawFrom.email || rawFrom.address || '';
    }
    const emailMatch = String(rawFrom).match(/<([^>]+)>/);
    let senderEmail = emailMatch ? emailMatch[1] : String(rawFrom);
    senderEmail = senderEmail.trim().toLowerCase();

    if (!senderEmail || !senderEmail.includes('@')) {
      console.warn('[INBOUND WEBHOOK] Could not parse sender email address:', payload);
      return res.status(200).json({ success: true, warning: 'Unrecognized sender format.' });
    }

    // Extract Sender Name
    let fromName = payload.fromName || payload.senderName || payload.from?.name || '';
    if (!fromName && String(rawFrom).includes('<')) {
      fromName = String(rawFrom).split('<')[0].replace(/"/g, '').trim();
    }

    // Extract Subject & Body
    const subject = payload.subject || payload.headers?.Subject || payload.headers?.subject || 'Customer Inquiry';
    let rawBody = payload.text || payload['stripped-text'] || payload.body || payload.html || '';
    if (typeof rawBody !== 'string') rawBody = String(rawBody);

    // Strip HTML tags if body contains HTML
    if (rawBody.includes('<') && rawBody.includes('>')) {
      rawBody = rawBody.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                       .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                       .replace(/<br\s*[\/]?>/gi, '\n')
                       .replace(/<\/p>/gi, '\n')
                       .replace(/<[^>]+>/g, '');
    }

    const cleanBody = stripQuotedReplyText(rawBody) || 'Empty message body.';

    // Extract Message-ID & In-Reply-To
    const messageId = payload['message-id'] || payload.messageId || payload.headers?.['message-id'] || payload.id || `<msg-inbound-${Date.now()}@aglgloballogistics.com>`;
    const inReplyTo = payload['in-reply-to'] || payload.inReplyTo || payload.headers?.['in-reply-to'] || '';

    // Customer Lookup
    const existingCustomer = await Customer.findOne({ email: senderEmail });
    const customerName = existingCustomer?.name || fromName || senderEmail.split('@')[0];

    // Save Message
    const newMessage = new Message({
      customerEmail: senderEmail,
      customerName: customerName,
      subject: subject,
      body: cleanBody,
      sender: 'customer',
      read: false,
      messageId: messageId,
      inReplyTo: inReplyTo
    });

    await newMessage.save();

    // Broadcast over WebSocket
    emitScoped('NEW_MESSAGE', typeof newMessage.toObject === 'function' ? newMessage.toObject() : newMessage, newMessage.customerEmail);

    console.log(`[INBOUND EMAIL PROCESSED] Received message from ${senderEmail}`);
    return res.status(200).json({ success: true, id: newMessage._id });
  } catch (error) {
    console.error('[INBOUND EMAIL ERROR]:', error);
    // Return 200 to prevent provider retry floods
    return res.status(200).json({ success: false, error: error.message });
  }
});

// 10. Get Admin / Customer Messages
router.get('/messages', requireUser, async (req, res) => {
  // customers only ever see their own conversation; admins may filter by customer
  const email = req.user.role === 'admin' ? req.query.email : req.user.email;
  try {
    let query = {};
    if (email) {
      query.customerEmail = email.trim().toLowerCase();
    }
    const sortOrder = email ? { createdAt: 1 } : { createdAt: -1 };
    const messages = await Message.find(query).sort(sortOrder);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to retrieve messages.' });
  }
});

// 11. Admin Reply to Customer Message
router.post('/admin/messages/reply', requireAdmin, async (req, res) => {
  const { customerEmail, customerName, subject, body, inReplyTo } = req.body;

  if (!customerEmail || !customerEmail.trim()) {
    return res.status(400).json({ error: 'Customer email is required.' });
  }
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Message body cannot be empty.' });
  }

  const cleanEmail = customerEmail.trim().toLowerCase();

  try {
    const formattedSubject = subject ? (subject.startsWith('Re:') ? subject : `Re: ${subject}`) : 'Re: Customer Inquiry';

    // 1. Save Admin Message to Database
    const adminMsg = new Message({
      customerEmail: cleanEmail,
      customerName: customerName || cleanEmail.split('@')[0],
      subject: formattedSubject,
      body: body.trim(),
      sender: 'admin',
      read: true,
      messageId: `<msg-admin-${Date.now()}@aglgloballogistics.com>`,
      inReplyTo: inReplyTo || ''
    });

    await adminMsg.save();

    // 2. Dispatch Email via Resend
    let emailSent = false;
    let emailError = null;
    try {
      await sendEmail({
        to: cleanEmail,
        recipientName: customerName,
        subject: formattedSubject,
        messageBody: body.trim(),
        inReplyTo: inReplyTo
      });
      emailSent = true;
    } catch (mailErr) {
      console.error('[ADMIN REPLY EMAIL FAILED]:', mailErr);
      emailError = mailErr.message;
    }

    // 3. Broadcast WebSocket event
    emitScoped('NEW_MESSAGE', typeof adminMsg.toObject === 'function' ? adminMsg.toObject() : adminMsg, adminMsg.customerEmail);

    res.json({
      success: true,
      message: adminMsg,
      emailSent: emailSent,
      emailError: emailError
    });
  } catch (error) {
    console.error('Error recording admin reply:', error);
    res.status(500).json({ error: error.message || 'Failed to dispatch reply.' });
  }
});

// 12. Mark Messages as Read
router.put('/messages/read', requireUser, async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const customerEmail = isAdmin ? (req.body || {}).customerEmail : req.user.email;
  const readerRole = isAdmin ? 'admin' : 'customer';
  if (!customerEmail) {
    return res.status(400).json({ error: 'Customer email required.' });
  }

  try {
    const cleanEmail = customerEmail.trim().toLowerCase();
    const senderToMark = readerRole === 'customer' ? 'admin' : 'customer';
    await Message.updateMany(
      { customerEmail: cleanEmail, sender: senderToMark, read: false },
      { $set: { read: true } }
    );

    res.json({ success: true, message: `Marked messages from ${senderToMark} as read for ${cleanEmail}.` });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to update message read status.' });
  }
});

// 13. Customer Send Message to Support
router.post('/messages', requireUser, async (req, res) => {
  const { customerName, subject, body } = req.body || {};
  const customerEmail = req.user.role === 'admin' ? (req.body || {}).customerEmail : req.user.email;

  if (!customerEmail || !customerEmail.trim()) {
    return res.status(400).json({ error: 'Customer email is required.' });
  }
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Message body cannot be empty.' });
  }

  const cleanEmail = customerEmail.trim().toLowerCase();

  try {
    const newMsg = new Message({
      customerEmail: cleanEmail,
      customerName: customerName || cleanEmail.split('@')[0],
      subject: subject || 'Support Request / Shipment Inquiry',
      body: body.trim(),
      sender: 'customer',
      read: false,
      messageId: `<msg-cust-${Date.now()}@aglgloballogistics.com>`
    });

    await newMsg.save();

    // Broadcast WebSocket event so Admin immediately sees the new message and badge counter!
    emitScoped('NEW_MESSAGE', typeof newMsg.toObject === 'function' ? newMsg.toObject() : newMsg, newMsg.customerEmail);

    res.json({ success: true, message: newMsg });
  } catch (error) {
    console.error('Error recording customer message:', error);
    res.status(500).json({ error: 'Failed to record customer message.' });
  }
});

export default router;

