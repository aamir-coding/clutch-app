import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const adminApp = admin;

import { monitorAllUsers } from './monitor';

export const monitorTasksScheduled = functions.pubsub.schedule('every 15 minutes').onRun(async (context) => {
  await monitorAllUsers();
  return null;
});

export const monitorTasksHttp = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  
  try {
    await monitorAllUsers();
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    functions.logger.error('Error in monitorTasksHttp', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export const onTaskCreated = functions.firestore.document('tasks/{taskId}').onCreate(async (snap) => {
  try {
    const data = snap.data();
    if (!data) return;

    const taskId = snap.id;
    const deadline = data.deadline?.toDate ? data.deadline.toDate() : new Date(data.deadline);
    const hoursLeft = (deadline.getTime() - Date.now()) / 3600000;

    const task = {
      id: taskId,
      title: data.title,
      deadline,
    };

    if (hoursLeft <= 4 && hoursLeft > 0) {
      await import('./alerts').then(m => m.sendCrisisAlert(data.userId, task));
    } else if (hoursLeft <= 24 && hoursLeft > 4) {
      await import('./alerts').then(m => m.sendUrgentAlert(data.userId, task));
    }

    const estimatedHours = data.estimatedHours || 2;
    const remainingWork = estimatedHours * (1 - (data.progressPercent || 0) / 100);
    const coverageRatio = Math.min(1, ((data.scheduledSessions?.length || 0) * 2) / remainingWork);
    const unCoveredScore = (1 - coverageRatio) * 30;
    
    const ratio = hoursLeft > 0 && remainingWork > 0 ? hoursLeft / remainingWork : 999;
    const urgencyScore = Math.max(0, Math.min(70, (1 - ratio / 2) * 70));

    let bonuses = 0;
    if (hoursLeft < 4) bonuses += 20;
    if (hoursLeft < 24 && (data.scheduledSessions?.length || 0) === 0) bonuses += 10;

    const riskScore = Math.min(100, Math.round(urgencyScore + unCoveredScore + bonuses));

    await snap.ref.update({ riskScore });
  } catch (error) {
    functions.logger.error('Error in onTaskCreated', error);
  }
});
