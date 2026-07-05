import { NextRequest } from 'next/server';
import { clutchAgent } from '@/lib/agent/agent';
import { adminDb }     from '@/lib/firebase/admin';
import { AgentMessage } from '@/lib/types';
import { FieldValue }  from 'firebase-admin/firestore';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { message, userId, conversationId: existingConvId } = await req.json();

    if (!message || !userId) {
      return new Response(JSON.stringify({ error: 'Missing message or userId' }), {
        status:  400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Conversation persistence (Admin SDK bypasses security rules) ──────────

    let convId: string = existingConvId || '';

    if (adminDb) {
      try {
        if (!convId) {
          const convRef = adminDb.collection('conversations').doc();
          await convRef.set({ userId, messages: [], createdAt: new Date() });
          convId = convRef.id;
        }

        await adminDb.collection('conversations').doc(convId).update({
          messages: FieldValue.arrayUnion({
            role:      'user',
            content:   message,
            timestamp: new Date(),
          }),
        });
      } catch (dbErr) {
        console.warn('Conversation persistence failed (non-fatal):', dbErr);
        convId = convId || crypto.randomUUID();
      }
    } else {
      convId = convId || crypto.randomUUID();
    }

    // ── Load conversation history ─────────────────────────────────────────────

    let history: AgentMessage[] = [];
    if (adminDb && convId) {
      try {
        const convSnap = await adminDb.collection('conversations').doc(convId).get();
        const raw      = convSnap.data()?.messages || [];

        // Exclude the user message we just appended — it is passed separately.
        history = raw
          .slice(0, -1)
          .map((m: any) => ({
            role:      m.role,
            content:   m.content,
            timestamp: m.timestamp?.toDate
              ? m.timestamp.toDate()
              : new Date(m.timestamp || Date.now()),
          }))
          .slice(-20); // cap context window at last 20 messages
      } catch (historyErr) {
        console.warn('History load failed (non-fatal):', historyErr);
      }
    }

    // ── Stream ────────────────────────────────────────────────────────────────

    const encoder        = new TextEncoder();
    let   assistantContent = '';

    const stream = new ReadableStream({
      async start(controller) {

        /**
         * Safely encode and enqueue a JSON-line event.
         * Guards against writing to a closed controller (client disconnected).
         */
        const sendEvent = (obj: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
          } catch {
            // Client already disconnected — swallow the error silently.
          }
        };

        try {
          for await (const event of clutchAgent.runStream(userId, message, history)) {
            switch (event.type) {

              case 'text':
                assistantContent += event.content;
                // The client reads `event.text` (not `event.content`) to
                // match the shape expected by lib/hooks/useAgent.ts.
                sendEvent({ type: 'text', text: event.content });
                break;

              case 'tool_call':
                sendEvent({ type: 'tool_call', name: event.name });
                break;

              case 'tool_result':
                sendEvent({ type: 'tool_result', name: event.name, summary: event.summary });
                break;

              /**
               * Crisis activation: forward taskId to the browser so
               * useAgent can call useUiStore.getState().activateCrisisMode().
               * The server never touches the Zustand store directly.
               */
              case 'crisis_activated':
                sendEvent({ type: 'crisis_activated', taskId: event.taskId });
                break;

              case 'error':
                sendEvent({ type: 'error', message: event.message });
                break;
            }
          }
        } catch (streamErr: any) {
          console.error('Agent stream error:', streamErr);
          sendEvent({ type: 'error', message: streamErr.message || 'Agent stream failed' });
        } finally {
          // Persist the completed assistant turn regardless of how the loop ended.
          if (assistantContent.trim() && adminDb && convId) {
            try {
              await adminDb.collection('conversations').doc(convId).update({
                messages: FieldValue.arrayUnion({
                  role:      'assistant',
                  content:   assistantContent,
                  timestamp: new Date(),
                }),
              });
            } catch (saveErr) {
              console.warn('Failed to persist assistant message (non-fatal):', saveErr);
            }
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type':    'text/event-stream',
        'Cache-Control':   'no-cache',
        'Connection':      'keep-alive',
        'X-Conversation-Id': convId,
      },
    });

  } catch (e: any) {
    console.error('Agent route error:', e);
    return new Response(JSON.stringify({ error: e.message || 'Internal error' }), {
      status:  500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}