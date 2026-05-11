export type StateGraphEdge<State extends string, Action extends string> = {
  action: Action;
  to: State;
};

export type StateGraphNode<
  State extends string,
  Action extends string,
  Edge extends StateGraphEdge<State, Action> = StateGraphEdge<State, Action>
> = {
  state: State;
  edges: Edge[];
};

export type StateGraph<
  State extends string,
  Action extends string,
  Edge extends StateGraphEdge<State, Action> = StateGraphEdge<State, Action>
> = StateGraphNode<State, Action, Edge>[];
