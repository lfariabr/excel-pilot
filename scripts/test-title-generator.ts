// npx ts-node scripts/test-title-generator.ts

import 'dotenv/config';
import { generateConversationTitle, updateConversationTitle } from '../src/services/titleGenerator';

async function testTitleGenerator() {
    console.log('🧪 Testing Title Generator...\n');
    
    const testCases = [
        {
            name: "Simple Excel Question",
            userMessage: "How do I create a pivot table in Excel?",
            aiResponse: "To create a pivot table in Excel, select your data range, go to Insert > PivotTable, choose your data source and location, then drag fields to the appropriate areas in the PivotTable Fields pane.",
            expectedKeywords: ["pivot", "table", "excel"]
        },
        {
            name: "Sydney Opera House Question", 
            userMessage: "What shows are playing this weekend?",
            aiResponse: "I can help you find current performances at the Sydney Opera House. This weekend features several shows including opera, ballet, and concerts. For specific showtimes and tickets, I recommend checking our official website or calling the box office.",
            expectedKeywords: ["shows", "weekend", "opera"]
        },
        {
            name: "General Greeting",
            userMessage: "Hello, what can you help me with?",
            aiResponse: "I'm here to assist you with information about the Sydney Opera House, including venues, performances, ticket bookings, tours, and more. How can I help you today?",
            expectedKeywords: ["help", "assistance", "opera"]
        }
    ];

    for (const testCase of testCases) {
        console.log(`--- Test: ${testCase.name} ---`);
        
        try {
            const title = await generateConversationTitle(
                testCase.userMessage, 
                testCase.aiResponse
            );
            
            console.log(`✅ Generated title: "${title}"`);
            console.log(`📝 User message: "${testCase.userMessage}"`);
            console.log(`🤖 AI response: "${testCase.aiResponse.substring(0, 100)}..."`);
            
            // Check if title contains expected keywords
            const titleLower = title.toLowerCase();
            const matchedKeywords = testCase.expectedKeywords.filter(keyword => 
                titleLower.includes(keyword.toLowerCase())
            );
            
            console.log(`🎯 Matched keywords: ${matchedKeywords.join(', ')}`);
            console.log(`📊 Title length: ${title.length} characters`);
            
            // Validate title quality
            if (title.length > 50) {
                console.log('⚠️  Warning: Title might be too long');
            }
            if (title.length < 10) {
                console.log('⚠️  Warning: Title might be too short');
            }
            
        } catch (error) {
            console.error(`❌ Error: ${error}`);
        }
        
        console.log(''); // Empty line for readability
    }
    
    console.log('🎉 Title generator tests completed!');
    process.exit(0);
}

testTitleGenerator().catch(console.error);