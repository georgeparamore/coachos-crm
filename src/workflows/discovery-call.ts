import {
  beginDiscoveryCallProcessing,
  completeDiscoveryCallProcessing,
  failDiscoveryCallProcessing,
  transcribeDiscoveryCallSegment,
} from "@/lib/discovery-call-processing";
import { workflowErrorMessage } from "@/lib/discovery-call-workflow-utils";

async function begin(callId: string) {
  "use step";
  return beginDiscoveryCallProcessing(callId);
}

async function transcribeSegment(callId: string, segmentIndex: number) {
  "use step";
  return transcribeDiscoveryCallSegment(callId, segmentIndex);
}
transcribeSegment.maxRetries = 2;

async function complete(callId: string, segments: { plainText: string; structuredText: string }[]) {
  "use step";
  await completeDiscoveryCallProcessing(callId, segments);
}

async function fail(callId: string, message: string) {
  "use step";
  await failDiscoveryCallProcessing(callId, message);
}

export async function processDiscoveryCallWorkflow(callId: string) {
  "use workflow";
  try {
    const plan = await begin(callId);
    if (plan.completed) return { status: "already-completed" };
    const segments: { plainText: string; structuredText: string }[] = [];
    for (let index = 0; index < plan.segmentCount; index += 1) {
      segments.push(await transcribeSegment(callId, index));
    }
    await complete(callId, segments);
    return { status: "completed", segments: segments.length };
  } catch (error) {
    const message = workflowErrorMessage(error);
    await fail(callId, message);
    throw error;
  }
}
