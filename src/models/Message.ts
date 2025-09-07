import { Schema, model, Types, Document } from "mongoose";
// Info: a single turn inside thread (user or assistant!)
export interface IChatMessage extends Document {
    conversationId: Types.ObjectId;
    userId: Types.ObjectId;
    role: "user" | "assistant" | "system";
    content: string;
    aiModel?: string; // optional: user messages won't have a aiModel
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
    createdAt: Date;
    updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>({
    conversationId: {
        type: Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
        index: true 
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    aiModel: { 
        type: String, 
        required: function (this: any) {
            return this.role === "assistant";
        } },
    usage: {
        prompt_tokens: { type: Number },
        completion_tokens: { type: Number },
        total_tokens: { type: Number }
    },
},
    { timestamps: true }
);

ChatMessageSchema.index({ conversationId: 1, createdAt: 1 });

const Message = model<IChatMessage>("Message", ChatMessageSchema);
export default Message;
