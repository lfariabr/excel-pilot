import 'dotenv/config';
import mongoose from 'mongoose';
import Message from '../models/Message';
import Conversation from '../models/Conversation';
import { createConnection, createCursor, parseCursor } from '../utils/pagination';

// npx ts-node src/tests/test-pagination.ts

async function testPagination() {
    console.log('🧪 Testing cursor-based pagination...\n');
    
    try {
        await mongoose.connect(process.env.MONGO_URI!);
        console.log('✅ Connected to MongoDB');

        // Find a conversation with messages (or create test data)
        const conversation = await Conversation.findOne();
        if (!conversation) {
            console.log('❌ No conversations found. Create some test data first.');
            process.exit(1);
        }

        console.log(`📝 Testing with conversation: ${conversation._id}`);

        // Test 1: First page (no cursor)
        console.log('\n--- Test 1: First page ---');
        const firstPage = await Message.find({ conversationId: conversation._id })
            .sort({ createdAt: -1 })
            .limit(3);

        console.log(`Found ${firstPage.length} messages`);
        const firstConnection = createConnection(firstPage, { first: 3 }, firstPage.length, true, false);
        
        console.log('PageInfo:', firstConnection.pageInfo);
        console.log('First message cursor:', firstConnection.edges[0]?.cursor);
        console.log('Last message cursor:', firstConnection.pageInfo.endCursor);

        // Test 2: Second page (with cursor)
        if (firstConnection.pageInfo.hasNextPage && firstConnection.pageInfo.endCursor) {
            console.log('\n--- Test 2: Second page ---');
            
            const afterId = parseCursor(firstConnection.pageInfo.endCursor);
            const secondPage = await Message.find({ 
                conversationId: conversation._id,
                _id: { $lt: afterId }
            })
                .sort({ createdAt: -1 })
                .limit(3);

            console.log(`Found ${secondPage.length} more messages`);
            const secondConnection = createConnection(secondPage, { 
                first: 3, 
                after: firstConnection.pageInfo.endCursor 
            }, secondPage.length, true, true);
            
            console.log('PageInfo:', secondConnection.pageInfo);
        }

        // Test 3: Cursor encoding/decoding
        console.log('\n--- Test 3: Cursor encoding ---');
        if (firstPage.length > 0) {
            const testMessage = firstPage[0] as any;
            const testId = testMessage._id.toString();
            const cursor = createCursor(testId);
            const decodedId = parseCursor(cursor);
            
            console.log('Original ID:', testId);
            console.log('Encoded cursor:', cursor);
            console.log('Decoded ID:', decodedId.toString());
            console.log('Match:', testId === decodedId.toString() ? '✅' : '❌');
        }

        console.log('\n🎉 Pagination tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

testPagination().catch(console.error);