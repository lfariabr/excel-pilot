// npx ts-node src/tests/test-summary-generator.ts

import 'dotenv/config';
import { generateConversationSummary } from '../services/summaryGenerator';

type Turn = { userMessage: string; aiResponse: string };

async function testSummaryGenerator() {
    console.log('🧪 Testing Summary Generator...\n');
    
    // Build multiple realistic conversations to test
    const conversations: Turn[][] = [
        [
        {
            userMessage: 'Hello, what can you help me with?',
            aiResponse:
            "I'm here to assist you with information about the Sydney Opera House, including venues, performances, ticket bookings, tours, and more. How can I help you today?",
        },
        {
            userMessage: 'What shows are playing this weekend?',
            aiResponse:
            'This weekend includes contemporary music, family events, and classical performances. You can browse the program online and filter by date and genre.',
        },
        {
            userMessage: 'Is there a techno event? Maybe Boris Brejcha?',
            aiResponse:
            'There is an electronic music night scheduled next month. For specific artists like Boris Brejcha, check announcements or subscribe to alerts.',
        },
        ],
        [
        {
            userMessage: 'How can I create a pivot table in Excel?',
            aiResponse:
            'Select your data range, then Insert > PivotTable. Place fields into Rows/Columns/Values and apply filters as needed.',
        },
        {
            userMessage: 'How do I group by month?',
            aiResponse:
            'Right-click a date field in Rows or Columns, choose Group, then select Months (and Years if needed).',
        },
        ],
    ];

    for (let i = 0; i < conversations.length; i++) {
        const convo = conversations[i];
        
        // Converting to { role, content } messages for the summary generator
        const messages = convo.flatMap((t) => [
            { role: 'user', content: t.userMessage },
            { role: 'assistant', content: t.aiResponse },
        ])

        console.log(`\n--- Conversation ${i + 1} ---`);
        console.log(
        'Preview:',
        messages
            .map((m) => `${m.role.toUpperCase()}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
            .join('\n')
            .slice(0, 300) + '...'
        );
        
        try {
            const summary = await generateConversationSummary(messages);
            console.log('\n✅ Generated summary:\n', summary);
            
            // Light validation (len + a few keyword checks)
            if (summary.length < 30) {
                console.warn('⚠️ Summary seems too short');
            }
            if (summary.length > 500) {
                console.warn('⚠️ Summary seems too long');
            }

            // Optional: check presence of key words from the conversation (very loose)
            const bag = (txt: string) =>
                txt
                    .toLowerCase()
                    .replace(/[^a-z0-9\s]/g, '')
                    .split(/\s+/)
                    .filter(Boolean);
            const convoBag = bag(messages.map((m) => m.content).join(' '));
            const summaryBag = bag(summary);
            const signalWords = ['opera', 'excel', 'shows', 'weekend', 'pivot', 'table', 'electronic'];
            const hits = signalWords.filter((w) => convoBag.includes(w) && summaryBag.includes(w));

            console.log('🔎 Signal word hits:', hits.join(', ') || '(none)');
        } catch (err) {
            console.error('❌ Error generating summary:', err);
        }
    }

  console.log('\n🎉 Summary generator tests completed!');
  process.exit(0);
}

testSummaryGenerator().catch(console.error);