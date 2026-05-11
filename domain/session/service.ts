import { sessionStateGraph } from "./flow.js";
import type { SessionFlowAction, SessionFlowState, SessionStateNode } from "./types.js";

const sessionStateNodeByState = new Map(sessionStateGraph.map((node) => [node.state, node]));

function sessionStateNode(state: SessionFlowState): SessionStateNode {
  const node = sessionStateNodeByState.get(state);
  if (!node) {
    throw new Error(`Unknown session flow state: ${state}`);
  }
  return node;
}

export function availableSessionFlowActions(state: SessionFlowState): SessionFlowAction[] {
  return sessionStateNode(state).edges.map((edge) => edge.action);
}

export function nextSessionFlowState(state: SessionFlowState, action: SessionFlowAction): SessionFlowState {
  const edge = sessionStateNode(state).edges.find((item) => item.action === action);
  if (!edge) {
    throw new Error(`Action ${action} is not allowed from ${state}.`);
  }
  return edge.to;
}

export function canApplySessionFlowAction(state: SessionFlowState, action: SessionFlowAction): boolean {
  return availableSessionFlowActions(state).includes(action);
}
