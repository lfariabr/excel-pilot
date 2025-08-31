import { userTypes } from "./types/userTypes";
import { conversationTypes } from "./types/conversationTypes";

export const typeDefs = `#graphql
    ${userTypes}
    ${conversationTypes}
`;