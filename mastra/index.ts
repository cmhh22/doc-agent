import { Mastra } from "@mastra/core";
import { docChatAgent } from "./agents";
import { analyzeDocumentWorkflow } from "./workflows/analyzeDocument";

export const mastra = new Mastra({
	agents: { docChatAgent },
	workflows: { analyzeDocumentWorkflow },
});
