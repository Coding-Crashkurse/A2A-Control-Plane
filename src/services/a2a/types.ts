export type TaskState = "submitted"|"working"|"input-required"|"completed"|"canceled"|"failed";
export interface TextPart { kind:"text"; text:string; metadata?:Record<string,any>; }
export interface FilePart { kind:"file"; file:{ name?:string; mimeType?:string; uri?:string; bytes?:string }; metadata?:Record<string,any>; }
export interface DataPart { kind:"data"; data:Record<string,any>; metadata?:Record<string,any>; }
export type Part = TextPart | FilePart | DataPart;

export interface Message {
  kind:"message"; role:"user"|"agent"; parts:Part[]; messageId:string; taskId?:string; contextId?:string; metadata?:Record<string,any>;
}
export interface TaskStatus { state:TaskState; message?:Message; timestamp?:string; }
export interface Artifact { artifactId:string; name?:string; description?:string; parts:Part[]; metadata?:Record<string,any>; }
export interface Task {
  kind:"task"; id:string; contextId:string; status:TaskStatus; history?:Message[]; artifacts?:Artifact[]; metadata?:Record<string,any>;
}
export interface SendParams { message:Message; configuration?:{ acceptedOutputModes?:string[]; historyLength?:number; pushNotificationConfig?:PushConfig; blocking?:boolean }; metadata?:Record<string,any>; }
export interface PushConfig { id?:string; url:string; token?:string; authentication?:{ schemes:string[]; credentials?:string }; }

export interface AgentInterface { url:string; transport:"HTTP+JSON"|"JSONRPC"|"GRPC"|string }
export interface AgentCapabilities { streaming?:boolean; pushNotifications?:boolean; stateTransitionHistory?:boolean; }
export interface AgentCard {
  protocolVersion:string; name:string; description:string; url:string;
  preferredTransport:"HTTP+JSON"|"JSONRPC"|"GRPC"|string;
  additionalInterfaces?:AgentInterface[]; iconUrl?:string; version:string;
  documentationUrl?:string; capabilities:AgentCapabilities;
  defaultInputModes:string[]; defaultOutputModes:string[]; skills:any[]; securitySchemes?:Record<string,any>; security?:Record<string,string[]>[];
}
