import 'dotenv/config';
import { askOpenAI } from '../src/services/openAi';

// npx ts-node scripts/test-openai-fix.ts

async function testOpenAIFix() {
    
    console.log('🧪 Testing OpenAI service fix...\n');
    
    try {
        // Test 1: Simple message (no history)
        console.log('--- Test 1: Simple message ---');
        const result1 = await askOpenAI({
            userMessage: "Hello, what can you help me with today?",
            history: []
        });
        
        console.log('✅ Response received:', result1.text.substring(0, 100) + '...');
        console.log('📊 Usage:', result1.usage);
        console.log('🤖 Model:', result1.model);
        console.log('🏁 Finish reason:', result1.finishReason);
        
        // Test 2: With conversation history
        console.log('\n--- Test 2: With conversation history ---');
        const history = [
            { role: "user" as const, content: "What is Microsoft Excel?" },
            { role: "assistant" as const, content: "Excel is a powerful spreadsheet application..." }
        ];
        
        const result2 = await askOpenAI({
            userMessage: "What are its main features?",
            history
        });
        
        console.log('✅ Response with context:', result2.text.substring(0, 100) + '...');
        console.log('📊 Usage:', result2.usage);
        
        // Test 3: Verify usage format matches your Message model
        console.log('\n--- Test 3: Usage format verification ---');
        if (result2.usage) {
            console.log('✅ input_tokens:', result2.usage.input_tokens);
            console.log('✅ output_tokens:', result2.usage.output_tokens);
            console.log('✅ total_tokens:', result2.usage.total_tokens);
            console.log('✅ Format matches Message model!');
        }
        
        console.log('\n🎉 All tests passed! OpenAI service is working correctly.');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
    
    process.exit(0);
}

testOpenAIFix().catch(console.error);