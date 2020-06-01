export interface IRenderResult {
  statusCode: number;
  headers: Map<string, string>;
  content: string;
};
