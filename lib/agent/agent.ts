import { GoogleGenerativeAI, Content, Part } from '@google/generative-ai';
import { adminFirestoreService } from '../firebase/adminFirestore';
import { AgentMessage, AgentStreamEvent, WorkPlan } from '../types';
import { CLUTCH_TOOLS } from './tools';
import { buildSystemPrompt, PLANNING_PROMPT } from './prompts';
import { executeAgentTool } from './tool-executor';

class ClutchAgent {
  private genAI: GoogleGenerativeAI;
  private flashModel = 'gemini-2.0-flash';
  private proModel   = 'gemini-2.5-pro-preview-06-05';

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  /**
   * Builds contextual information for the system prompt.
   *
   * Each data source is fetched independently with its own try/catch so
   * a single failure (e.g. Admin SDK not configured) does not abort the
   * whole agent turn. The agent degrades gracefully to "no context" rather
   * than crashing with an unhandled error.
   */
  async buildContext(userId: string): Promise<{
    currentDatetime: string;
    workHours: string;
    atRiskSummary: string;
  }> {
    const currentDatetime = new Date().toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    let workHours = '09:00 to 18:00';
    try {
      const user = await adminFirestoreService.getUser(userId);
      if (user?.workHours) {
        workHours = `${user.workHours.start} to ${user.workHours.end}`;
      }
    } catch (err) {
      console.warn('[CLUTCH Agent] buildContext: could not fetch user (Admin SDK may not be configured):', (err as Error).message);
    }

    let atRiskSummary = 'None';
    try {
      const atRiskTasks = await adminFirestoreService.getAtRiskTasks(userId, 48);
      if (atRiskTasks.length > 0) {
        const hoursUntil = (d: Date) => (d.getTime() - Date.now()) / 3600000;
        atRiskSummary = atRiskTasks
          .map(t => `${t.title} (${hoursUntil(t.deadline).toFixed(1)}h remaining)`)
          .join(', ');
      }
    } catch (err) {
      console.warn('[CLUTCH Agent] buildContext: could not fetch at-risk tasks:', (err as Error).message);
    }

    return { currentDatetime, workHours, atRiskSummary };
  }

  formatHistory(messages: AgentMessage[]): Content[] {
    return messages.map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  }

  async *runStream(
    userId: string,
    userMessage: string,
    history: AgentMessage[]
  ): AsyncGenerator<AgentStreamEvent> {
    // Validate API key early so we yield a clear error instead of a cryptic one.
    if (!process.env.GEMINI_API_KEY) {
      yield {
        type:    'error',
        message: 'GEMINI_API_KEY is not configured. Add it to your .env.local file.',
      };
      return;
    }

    try {
      const context         = await this.buildContext(userId);
      const systemPromptStr = buildSystemPrompt(context);

      const model = this.genAI.getGenerativeModel({
        model:             this.flashModel,
        tools:             CLUTCH_TOOLS,
        systemInstruction: systemPromptStr,
      });

      const chat   = model.startChat({ history: this.formatHistory(history) });
      let   result = await chat.sendMessageStream(userMessage);

      // Agentic loop: keep going while Gemini wants to call tools.
      while (true) {
        let hasFunctionCall       = false;
        const functionResponseParts: Part[] = [];

        for await (const chunk of result.stream) {
          const parts = chunk.candidates?.[0]?.content?.parts ?? [];

          for (const part of parts) {
            if (part.functionCall) {
              hasFunctionCall = true;

              yield { type: 'tool_call', name: part.functionCall.name };

              const toolResult = await executeAgentTool(
                part.functionCall.name,
                (part.functionCall.args ?? {}) as Record<string, unknown>,
                userId
              );

              yield {
                type:    'tool_result',
                name:    part.functionCall.name,
                summary: toolResult.summary,
              };

              // Crisis mode: emit a dedicated event so the client-side store
              // can activate the overlay without the server touching Zustand.
              if (
                part.functionCall.name === 'activate_crisis_mode' &&
                toolResult.data?.taskId
              ) {
                yield {
                  type:   'crisis_activated',
                  taskId: toolResult.data.taskId as string,
                };
              }

              functionResponseParts.push({
                functionResponse: {
                  name:     part.functionCall.name,
                  response: {
                    name:    part.functionCall.name,
                    content: toolResult.data ?? {},
                  },
                },
              });
            }

            if (part.text && part.text.length > 0) {
              yield { type: 'text', content: part.text };
            }
          }
        }

        if (hasFunctionCall && functionResponseParts.length > 0) {
          // Send tool results back to Gemini and continue the loop.
          result = await chat.sendMessageStream(functionResponseParts);
        } else {
          break;
        }
      }
    } catch (err: any) {
      console.error('[CLUTCH Agent] runStream error:', err);
      yield {
        type:    'error',
        message: err.message || 'An unexpected error occurred in the agent.',
      };
    }
  }

  async generateBattlePlan(userId: string, horizonDays: number): Promise<WorkPlan> {
    const tasks   = await adminFirestoreService.getTasks(userId);
    const context = await this.buildContext(userId);

    const fullPrompt = PLANNING_PROMPT
      .replace(/\{PLANNING_DAYS\}/g,  horizonDays.toString())
      .replace(/\{TASKS_JSON\}/g,     JSON.stringify(tasks))
      .replace(/\{CALENDAR_JSON\}/g,  '[]')
      .replace(/\{WORK_HOURS\}/g,     context.workHours);

    const model    = this.genAI.getGenerativeModel({ model: this.proModel });
    const response = await model.generateContent(fullPrompt);
    const text     = response.response.text();

    // \n in a regex literal is the newline character — the backslash-n literal.
    const cleanText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    try {
      return JSON.parse(cleanText) as WorkPlan;
    } catch {
      console.error('[CLUTCH Agent] Battle plan JSON parse failed. Raw:', cleanText);
      throw new Error('Battle plan parse failed — model did not return valid JSON.');
    }
  }
}

export const clutchAgent = new ClutchAgent();