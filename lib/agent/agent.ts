import { GoogleGenerativeAI, Content, Part } from '@google/generative-ai';
import { adminFirestoreService }             from '../firebase/adminFirestore';
import { AgentMessage, AgentStreamEvent, WorkPlan, Task } from '../types';
import { CLUTCH_TOOLS }    from './tools';
import { buildSystemPrompt, PLANNING_PROMPT } from './prompts';
import { executeAgentTool } from './tool-executor';

class ClutchAgent {
  private genAI:      GoogleGenerativeAI;
  private flashModel: string = 'gemini-2.0-flash';
  private proModel:   string = 'gemini-2.5-pro-preview-06-05';

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async buildContext(
    userId: string
  ): Promise<{ currentDatetime: string; workHours: string; atRiskSummary: string }> {
    // Must use Admin SDK — this method runs server-side inside the API route.
    const user         = await adminFirestoreService.getUser(userId);
    const atRiskTasks  = await adminFirestoreService.getAtRiskTasks(userId, 48);

    const currentDatetime = new Date().toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const workHours = user?.workHours
      ? `${user.workHours.start} to ${user.workHours.end}`
      : '09:00 to 18:00';

    const hoursUntil = (deadline: Date | string) =>
      (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);

    const atRiskSummary =
      atRiskTasks.length === 0
        ? 'None'
        : atRiskTasks
            .map(t => `${t.title} (due ${hoursUntil(t.deadline).toFixed(1)}h)`)
            .join(', ');

    return { currentDatetime, workHours, atRiskSummary };
  }

  formatHistory(messages: AgentMessage[]): Content[] {
    return messages.map(message => ({
      role:  message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
  }

  async *runStream(
    userId: string,
    userMessage: string,
    history: AgentMessage[]
  ): AsyncGenerator<AgentStreamEvent> {
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

      while (true) {
        let hasFunctionCall      = false;
        let functionResponseParts: Part[] = [];

        for await (const chunk of result.stream) {
          const parts = chunk.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {

            if (part.functionCall) {
              hasFunctionCall = true;

              yield { type: 'tool_call', name: part.functionCall.name };

              const toolResult = await executeAgentTool(
                part.functionCall.name,
                part.functionCall.args as Record<string, unknown>,
                userId
              );

              yield { type: 'tool_result', name: part.functionCall.name, summary: toolResult.summary };

              // Crisis mode: emit a dedicated stream event so the browser-side
              // useAgent hook can update the UI store directly.
              if (
                part.functionCall.name === 'activate_crisis_mode' &&
                toolResult.data?.taskId
              ) {
                yield { type: 'crisis_activated', taskId: toolResult.data.taskId as string };
              }

              functionResponseParts.push({
                functionResponse: {
                  name:     part.functionCall.name,
                  response: { name: part.functionCall.name, content: toolResult.data },
                },
              });
            }

            if (part.text && part.text.length > 0) {
              yield { type: 'text', content: part.text };
            }
          }
        }

        if (hasFunctionCall) {
          result = await chat.sendMessageStream(functionResponseParts);
          continue;
        } else {
          break;
        }
      }
    } catch (err) {
      yield { type: 'error', message: (err as Error).message };
    }
  }

  async generateBattlePlan(userId: string, horizonDays: number): Promise<WorkPlan> {
    // Must use Admin SDK — runs server-side.
    const tasks   = await adminFirestoreService.getTasks(userId);
    const context = await this.buildContext(userId);

    const calendarJson = '[]'; // Placeholder — real calendar data fetched by tools.
    const tasksJson    = JSON.stringify(tasks);

    const fullPrompt = PLANNING_PROMPT
      .replace('{PLANNING_DAYS}', horizonDays.toString())
      .replace('{TASKS_JSON}',    tasksJson)
      .replace('{CALENDAR_JSON}', calendarJson)
      .replace('{WORK_HOURS}',    context.workHours)
      .replace(/\{PLANNING_DAYS\}/g, horizonDays.toString());

    const model    = this.genAI.getGenerativeModel({ model: this.proModel });
    const response = await model.generateContent(fullPrompt);
    const text     = response.response.text();

    // Fix: use \n (newline char) not \\n (literal backslash-n) in the regex.
    const cleanText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    try {
      return JSON.parse(cleanText) as WorkPlan;
    } catch (err) {
      console.error('Battle plan JSON parse failed. Raw text:', cleanText);
      throw new Error('Battle plan parse failed — model did not return valid JSON.');
    }
  }
}

export const clutchAgent = new ClutchAgent();