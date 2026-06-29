import { googleFetch, buildGoogleUrl } from './auth-client';

export class GoogleTasksService {
  async getDefaultListId(userId: string): Promise<string> {
    const response = await googleFetch(userId, 'https://www.googleapis.com/tasks/v1/users/@me/lists');
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Tasks getDefaultListId failed: ${response.status} ${errText}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      throw new Error('No Google Tasks lists found for the user.');
    }

    return data.items[0].id;
  }

  async getTasks(userId: string): Promise<Array<{ id: string; title: string; notes: string; due: string | null; status: string }>> {
    const listId = await this.getDefaultListId(userId);
    const url = buildGoogleUrl(`https://www.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
      showCompleted: 'false',
      showHidden: 'false',
    });

    const response = await googleFetch(userId, url);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Tasks getTasks failed: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const items = data.items || [];

    return items.map((item: any) => ({
      id: item.id,
      title: item.title || '',
      notes: item.notes || '',
      due: item.due || null,
      status: item.status || '',
    }));
  }

  async createTask(userId: string, title: string, notes?: string, dueISO?: string): Promise<{ id: string }> {
    const listId = await this.getDefaultListId(userId);
    const url = `https://www.googleapis.com/tasks/v1/lists/${listId}/tasks`;

    const response = await googleFetch(userId, url, {
      method: 'POST',
      body: JSON.stringify({
        title,
        notes: notes || '',
        due: dueISO ? new Date(dueISO).toISOString() : undefined,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Tasks createTask failed: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return { id: data.id };
  }

  async completeTask(userId: string, googleTaskId: string): Promise<void> {
    const listId = await this.getDefaultListId(userId);
    const url = `https://www.googleapis.com/tasks/v1/lists/${listId}/tasks/${googleTaskId}`;

    const response = await googleFetch(userId, url, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'completed',
        completed: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Tasks completeTask failed: ${response.status} ${errText}`);
    }
  }
}

export const googleTasksService = new GoogleTasksService();
