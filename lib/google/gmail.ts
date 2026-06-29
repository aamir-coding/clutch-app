import { googleFetch, buildGoogleUrl } from './auth-client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GMAIL_PARSER_PROMPT } from '../agent/prompts';
import { GmailDeadline } from '../types';

export class GmailService {
  async searchThreads(userId: string, query: string, maxResults = 10): Promise<Array<{ id: string; snippet: string }>> {
    const url = buildGoogleUrl('https://www.googleapis.com/gmail/v1/users/me/threads', {
      q: query,
      maxResults,
    });

    const response = await googleFetch(userId, url);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gmail searchThreads failed: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return data.threads?.map((t: any) => ({ id: t.id, snippet: t.snippet })) || [];
  }

  private decodeBase64Url(data: string): string {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(normalized, 'base64').toString('utf-8');
  }

  private getPartsText(parts: any[]): string {
    let text = '';
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text += this.decodeBase64Url(part.body.data);
      } else if (part.parts) {
        text += this.getPartsText(part.parts);
      }
    }
    return text;
  }

  async getThreadText(userId: string, threadId: string): Promise<string> {
    const response = await googleFetch(userId, `https://www.googleapis.com/gmail/v1/users/me/threads/${threadId}`);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gmail getThreadText failed: ${response.status} ${errText}`);
    }

    const thread = await response.json();
    let threadText = '';
    const messages = thread.messages || [];

    for (const msg of messages) {
      if (msg.payload?.body?.data) {
        threadText += this.decodeBase64Url(msg.payload.body.data) + '\n';
      }
      if (msg.payload?.parts) {
        threadText += this.getPartsText(msg.payload.parts) + '\n';
      }
    }

    return threadText.slice(0, 2000);
  }

  async scanForDeadlines(userId: string, lookBackDays = 7): Promise<GmailDeadline[]> {
    const query = `(deadline OR "due date" OR "due by" OR "by EOD" OR "by end of" OR "please submit" OR "required by" OR "must be completed") newer_than:${lookBackDays}d -from:me`;
    const threads = await this.searchThreads(userId, query, 15);

    const results: GmailDeadline[] = [];
    const chunks: any[][] = [];
    for (let i = 0; i < threads.length; i += 3) {
      chunks.push(threads.slice(i, i + 3));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (thread) => {
          try {
            const text = await this.getThreadText(userId, thread.id);
            if (!text.trim()) return [];

            const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
            const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });

            const prompt = `${GMAIL_PARSER_PROMPT}\n\nEmail content:\n${text}`;
            const response = await model.generateContent(prompt);
            const resText = response.response.text();

            const cleanText = resText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleanText);

            if (parsed.hasDeadline && Array.isArray(parsed.tasks)) {
              return parsed.tasks.map((task: any) => ({
                title: task.title,
                deadline: task.deadline,
                deadlineConfidence: task.deadlineConfidence || 'low',
                sender: task.sender || 'Unknown',
                context: task.context || '',
                threadId: thread.id,
                emailSnippet: thread.snippet,
              }));
            }
          } catch (err) {
            console.error(`Failed to parse thread ${thread.id}:`, err);
          }
          return [];
        })
      );
      results.push(...chunkResults.flat());
    }

    // Filter duplicates by title similarity
    const unique: GmailDeadline[] = [];
    for (const deadline of results) {
      const isDuplicate = unique.some(
        (u) => u.title.toLowerCase().trim() === deadline.title.toLowerCase().trim()
      );
      if (!isDuplicate) {
        unique.push(deadline);
      }
    }

    return unique;
  }

  private encodeRFC2822(to: string, subject: string, body: string): string {
    const rawMessage = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
    return Buffer.from(rawMessage, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async createDraft(userId: string, to: string, subject: string, body: string): Promise<{ draftId: string }> {
    const encoded = this.encodeRFC2822(to, subject, body);
    const response = await googleFetch(userId, 'https://www.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      body: JSON.stringify({
        message: {
          raw: encoded,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gmail createDraft failed: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return { draftId: data.id };
  }

  async sendEmail(userId: string, to: string, subject: string, body: string): Promise<void> {
    const encoded = this.encodeRFC2822(to, subject, body);
    const response = await googleFetch(userId, 'https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        raw: encoded,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gmail sendEmail failed: ${response.status} ${errText}`);
    }
  }
}

export const gmailService = new GmailService();
