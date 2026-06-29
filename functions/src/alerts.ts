import { adminApp as admin } from './index';
import { FieldValue } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function sendCrisisAlert(userId: string, task: { id: string; title: string; deadline: Date }): Promise<void> {
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const fcmTokens = userDoc.data()?.fcmTokens || [];

  const hoursLeft = (task.deadline.getTime() - Date.now()) / 3600000;

  for (const token of fcmTokens) {
    try {
      await admin.messaging().send({
        notification: {
          title: '🚨 CRISIS: ' + task.title,
          body: task.title + ' is due in ' + hoursLeft.toFixed(1) + ' hours. CLUTCH is activating Crisis Mode.',
        },
        data: {
          taskId: task.id,
          type: 'crisis',
          click_action: '/crisis/' + task.id,
        },
        token,
      });
    } catch (err) {
      console.error(`Failed to send crisis alert to token ${token}`, err);
    }
  }

  // Log the alert in Firestore
  await admin.firestore().doc('monitoring/' + userId).set({
    alertLog: FieldValue.arrayUnion({
      taskId: task.id,
      alertType: 'crisis',
      sentAt: FieldValue.serverTimestamp(),
    }),
  }, { merge: true });

  // Update Firestore task: mark crisisAlerted:true to prevent duplicate alerts
  await admin.firestore().doc('tasks/' + task.id).update({
    crisisAlerted: true,
  });
}

export async function sendUrgentAlert(userId: string, task: { id: string; title: string; deadline: Date }): Promise<void> {
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const fcmTokens = userDoc.data()?.fcmTokens || [];
  const hoursLeft = (task.deadline.getTime() - Date.now()) / 3600000;

  for (const token of fcmTokens) {
    try {
      await admin.messaging().send({
        notification: {
          title: '⚠️ Due Soon: ' + task.title,
          body: 'Due in under 24 hours. CLUTCH has scheduled a work session.',
        },
        data: {
          taskId: task.id,
          type: 'urgent',
          click_action: '/tasks/' + task.id,
        },
        token,
      });
    } catch (err) {
      console.error(`Failed to send urgent alert to token ${token}`, err);
    }
  }

  // Log the alert
  await admin.firestore().doc('monitoring/' + userId).set({
    alertLog: FieldValue.arrayUnion({
      taskId: task.id,
      alertType: 'urgent',
      sentAt: FieldValue.serverTimestamp(),
    }),
  }, { merge: true });

  // Update task
  await admin.firestore().doc('tasks/' + task.id).update({
    urgentAlerted: true,
  });

  // Auto-find and schedule a session using Google Calendar API
  const accessToken = userDoc.data()?.googleAccessToken;
  if (accessToken) {
    try {
      const start = new Date();
      start.setHours(start.getHours() + 1);
      const end = new Date(start.getTime() + 2 * 3600000); // 2 hours

      await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: `🔒 CLUTCH: ${task.title}`,
          description: `Auto-scheduled urgent session for task: ${task.title}`,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
          colorId: '1',
        }),
      });
    } catch (err) {
      console.error('Failed to schedule urgent session', err);
    }
  }
}

export async function sendMorningBriefing(userId: string, todayTasks: Array<{ title: string; deadline: Date }>, atRiskTasks: Array<{ title: string }>): Promise<void> {
  const currentHourUTC = new Date().getUTCHours();
  if (currentHourUTC !== 8) {
    return;
  }

  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const fcmTokens = userDoc.data()?.fcmTokens || [];

  if (fcmTokens.length === 0) return;

  let briefingText = `You have ${todayTasks.length} tasks due today and ${atRiskTasks.length} tasks at risk.`;

  try {
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const prompt = `Generate a concise morning briefing for a user.
Today's tasks: ${todayTasks.map(t => t.title).join(', ')}
At risk tasks: ${atRiskTasks.map(t => t.title).join(', ')}
Be brief, motivating, and action-oriented. No more than 3 sentences.`;

    const response = await model.generateContent(prompt);
    briefingText = response.response.text() || briefingText;
  } catch (err) {
    console.error('Failed to generate morning briefing', err);
  }

  for (const token of fcmTokens) {
    try {
      await admin.messaging().send({
        notification: {
          title: 'CLUTCH Morning Briefing',
          body: briefingText,
        },
        token,
      });
    } catch (err) {
      console.error(`Failed to send morning briefing to token ${token}`, err);
    }
  }
}
