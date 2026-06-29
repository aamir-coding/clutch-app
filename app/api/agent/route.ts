import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (obj: any) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        };

        const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

        // 1. Simulating initial tool calls
        if (message.toLowerCase().includes('battle plan')) {
          sendEvent({ type: 'tool_call', name: 'scan_calendar' });
          await sleep(1000);
          sendEvent({ type: 'tool_result', name: 'scan_calendar', summary: 'Scanned 5 calendar events' });

          sendEvent({ type: 'tool_call', name: 'find_free_slots' });
          await sleep(800);
          sendEvent({ type: 'tool_result', name: 'find_free_slots', summary: 'Found 4 open focus slots' });

          sendEvent({ type: 'tool_call', name: 'generate_battle_plan' });
          await sleep(1200);
          sendEvent({ type: 'tool_result', name: 'generate_battle_plan', summary: 'Constructed optimal 6h block calendar roadmap' });

          sendEvent({ type: 'text', text: 'I have successfully analyzed your schedule and built your **Battle Plan** for this week!\n\n' });
          await sleep(400);
          sendEvent({ type: 'text', text: 'Here is what I accomplished:\n' });
          await sleep(300);
          sendEvent({ type: 'text', text: '- **Identified Focus Windows**: Slotted sessions during your peak energy hours.\n' });
          await sleep(300);
          sendEvent({ type: 'text', text: '- **Handled Collisions**: No overlap with existing work meetings.\n' });
          await sleep(300);
          sendEvent({ type: 'text', text: '- **Crisis Prevention**: Highlighted tasks at risk and added 1.5h buffer.\n\n' });
          await sleep(400);
          sendEvent({ type: 'text', text: 'You can review the full visual breakdown under the **Battle Plan** tab and click "Add All to Calendar" to sync them instantly!' });

        } else if (message.toLowerCase().includes('gmail') || message.toLowerCase().includes('email')) {
          sendEvent({ type: 'tool_call', name: 'scan_gmail_for_deadlines' });
          await sleep(1500);
          sendEvent({ type: 'tool_result', name: 'scan_gmail_for_deadlines', summary: 'Flagged 2 high-priority commitments' });

          sendEvent({ type: 'text', text: 'I completed a deep scan of your priority Gmail inbox.\n\n' });
          await sleep(450);
          sendEvent({ type: 'text', text: 'I detected **two critical commitments** that require immediate tracking:\n\n' });
          await sleep(350);
          sendEvent({ type: 'text', text: '1. **Server Migration Cutover** (Due Monday at 9:00 AM)\n' });
          await sleep(300);
          sendEvent({ type: 'text', text: '2. **Review User Feedback Docs** (Due Tuesday at 5:00 PM)\n\n' });
          await sleep(400);
          sendEvent({ type: 'text', text: 'I can import these directly into your active dashboard objectives or draft appropriate extension negotiation templates. Which would you prefer?' });

        } else if (message.toLowerCase().includes('risk') || message.toLowerCase().includes('most at risk')) {
          sendEvent({ type: 'tool_call', name: 'analyze_deadline_risk' });
          await sleep(1200);
          sendEvent({ type: 'tool_result', name: 'analyze_deadline_risk', summary: 'Risk index escalated for Q3 analysis' });

          sendEvent({ type: 'text', text: 'Here is your current deadline threat assessment:\n\n' });
          await sleep(400);
          sendEvent({ type: 'text', text: '⚠️ **Analyze Quarter 3 Deadline Risks** is highly at risk. You only have **8 hours** remaining until its deadline, with an estimated **3.5 hours** of focused work left to do.\n\n' });
          await sleep(450);
          sendEvent({ type: 'text', text: 'I strongly recommend generating a custom Battle Plan right now to secure a slot on your calendar and complete this objective on time.' });

        } else {
          // Standard generic help assistant reply
          sendEvent({ type: 'tool_call', name: 'get_all_tasks' });
          await sleep(800);
          sendEvent({ type: 'tool_result', name: 'get_all_tasks', summary: 'Found 3 active objectives' });

          sendEvent({ type: 'text', text: 'Hello! I am **CLUTCH**, your high-stakes workspace risk controller.\n\n' });
          await sleep(400);
          sendEvent({ type: 'text', text: 'I am fully integrated with your calendar and email. Here is what I can do:\n\n' });
          await sleep(300);
          sendEvent({ type: 'text', text: '- **Automated Scheduling**: Book focus sessions on Google Calendar.\n' });
          await sleep(300);
          sendEvent({ type: 'text', text: '- **Inbox Risk Scanning**: Find hidden deadlines inside your emails.\n' });
          await sleep(300);
          sendEvent({ type: 'text', text: '- **Defensive Planning**: Help you manage high-stakes deadlines and prevent overflows.\n\n' });
          await sleep(450);
          sendEvent({ type: 'text', text: 'Let me know how we can keep your workspace on track today!' });
        }

        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Conversation-Id': crypto.randomUUID(),
      },
    });
  } catch (e: any) {
    console.error('Failed in agent chat API:', e);
    return new Response(JSON.stringify({ error: e.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
