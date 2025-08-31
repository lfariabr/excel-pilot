import { Schema, model, Types, Document } from "mongoose";

export interface IChatMessage extends Document {
    conversationId: Types.ObjectId;
    userId: Types.ObjectId;
    role: "user" | "assistant" | "system";
    content: string;
    aiModel?: string; // optional: user messages won't have a aiModel
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
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
    aiModel: { type: String, required: true },
    usage: {
        input_tokens: { type: Number },
        output_tokens: { type: Number },
        total_tokens: { type: Number }
    },
},
    { timestamps: true }
);

ChatMessageSchema.index({ conversationId: 1, createdAt: 1 });

const MessageModel = model<IChatMessage>("Message", ChatMessageSchema);
export default MessageModel;
