import { Schema, model, Types, Document } from "mongoose";
// Info: Conversation is the container/thread - one chat per session
export interface IConversation extends Document {
    userId: Types.ObjectId;
    title?: string;
    systemPrompt: string;
    lastMessageAt: Date;
    summary?: string;
    createdAt: Date;
    updatedAt: Date;
    // Extra options
    // settings?: { model, temperature }
    // archived?: boolean
    // deletedAt?: Date
}

const ConversationSchema = new Schema<IConversation>({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String },
    systemPrompt: { type: String },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    summary: { type: String },
},
    { timestamps: true }
);

const Conversation = model<IConversation>("Conversation", ConversationSchema);
export default Conversation;