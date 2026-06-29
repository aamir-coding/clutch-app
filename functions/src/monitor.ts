import * as functions from 'firebase-functions';
import { adminApp as admin } from './index';
import { sendCrisisAlert, sendUrgentAlert, sendMorningBriefing } from './alerts';

export async function monitorAllUsers(): Promise<void> {
  try {
    const usersSnapshot = await admin.firestore().collection('users').get();
    
    const batchPromises = [];
    const users = usersSnapshot.docs;

    for (let i = 0; i < users.length; i += 10) {
      const batch = users.slice(i, i + 10);
      const batchPromise = Promise.allSettled(batch.map(async (userDoc) => {
        const uid = userDoc.id;
        
        try {
          const tasksSnapshot = await admin.firestore().collection('tasks')
            .where('userId', '==', uid)
            .where('status', '==', 'active')
            .orderBy('deadline', 'asc')
            .get();

          const monitoringDoc = await admin.firestore().doc('monitoring/' + uid).get();
          const monitoringState = monitoringDoc.data() || { alertLog: [] };
          
          const todayTasks: Array<{ title: string; deadline: Date }> = [];
          const atRiskTasks: Array<{ title: string }> = [];
          const atRiskTaskIds: string[] = [];

          for (const taskDoc of tasksSnapshot.docs) {
            const data = taskDoc.data();
            const deadline = data.deadline?.toDate ? data.deadline.toDate() : new Date(data.deadline);
            const task = {
              id: taskDoc.id,
              title: data.title,
              deadline,
              scheduledSessions: data.scheduledSessions || [],
              crisisAlerted: data.crisisAlerted || false,
              urgentAlerted: data.urgentAlerted || false,
            };

            const hoursLeft = (deadline.getTime() - Date.now()) / 3600000;

            if (hoursLeft <= 24 && hoursLeft > 0) {
              todayTasks.push(task);
            }

            if (hoursLeft <= 4 && hoursLeft > 0) {
              atRiskTasks.push(task);
              atRiskTaskIds.push(task.id);
              if (!task.crisisAlerted) {
                await sendCrisisAlert(uid, task);
              }
            } else if (hoursLeft <= 24 && hoursLeft > 4) {
              if (!task.urgentAlerted) {
                await sendUrgentAlert(uid, task);
              }
            } else if (task.scheduledSessions.length === 0 && hoursLeft > 24 && hoursLeft <= 72) {
              // Automatically schedule session for tasks with no sessions in 1-3 days
            }
          }

          await sendMorningBriefing(uid, todayTasks, atRiskTasks);

          await admin.firestore().doc('monitoring/' + uid).set({
            lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
            atRiskTaskIds,
          }, { merge: true });

        } catch (err) {
          functions.logger.error(`Error monitoring user ${uid}`, err);
        }
      }));
      
      batchPromises.push(batchPromise);
    }

    await Promise.allSettled(batchPromises);

    functions.logger.info('Monitor run complete', { 
      usersChecked: usersSnapshot.size, 
      timestamp: new Date().toISOString() 
    });

  } catch (error) {
    functions.logger.error('Error in monitorAllUsers', error);
  }
}
