export interface WorkerMessage<TType extends string, TPayload> {
  type: TType;
  payload: TPayload;
}

export interface WorkerResult<TType extends string, TPayload> {
  type: TType;
  payload: TPayload;
}

export type AnyMessage = WorkerMessage<string, unknown>;
export type AnyResult = WorkerResult<string, unknown>;
