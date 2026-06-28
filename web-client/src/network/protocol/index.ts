import {
  isClientMessage,
  isCompatibleProtocolVersion,
  isServerMessage,
  PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage
} from "./schemas";
import {
  classifySystemMessage,
  convertNativePlayers,
  nativePacketMessages,
  parseChatPacket,
  parsePlayersPacket,
  parseSystemPacket,
  type ClassifiedSystemMessage,
  type NativeChatPacket,
  type NativeLaunchInfo,
  type NativeMovementInput,
  type NativePlayerRecord,
  type NativePlayerState,
  type NativeSystemPacket
} from "./nativePackets";
import { encodeChatPacket, encodeHeartbeat, encodeMovementPacket } from "./encoders";

export { PROTOCOL_VERSION, isClientMessage, isServerMessage, isCompatibleProtocolVersion };
export type {
  ClientMessage,
  ServerMessage,
  NativeLaunchInfo,
  NativeMovementInput,
  NativePlayerRecord,
  NativePlayerState,
  NativeChatPacket,
  NativeSystemPacket,
  ClassifiedSystemMessage
};

export type ProtocolService = {
  version: number;
  isClientMessage(value: unknown): value is ClientMessage;
  isServerMessage(value: unknown): value is ServerMessage;
  isCompatible(remoteVersion: unknown): boolean;
  parsePlayersPacket(buffer: ArrayBuffer): NativePlayerRecord[] | null;
  parseChatPacket(buffer: ArrayBuffer): NativeChatPacket | null;
  parseSystemPacket(buffer: ArrayBuffer): NativeSystemPacket | null;
  classifySystemMessage(message: unknown): ClassifiedSystemMessage;
  convertNativePlayers(players: NativePlayerRecord[], selfId: unknown): NativePlayerState[];
  nativePacketMessages(buffer: ArrayBuffer, options: { selfId: unknown; hasRemote(id: unknown): boolean }): ServerMessage[];
  encodeMovementPacket(data: NativeMovementInput, launchInfo: NativeLaunchInfo, animClock: number): { buffer: ArrayBuffer; animClock: number };
  encodeHeartbeat(launchInfo: Pick<NativeLaunchInfo, "clientToken">): ArrayBuffer;
  encodeChatPacket(message: unknown, launchInfo: Pick<NativeLaunchInfo, "id" | "username">): ArrayBuffer;
};

export function createProtocolService(): ProtocolService {
  return {
    version: PROTOCOL_VERSION,
    isClientMessage,
    isServerMessage,
    isCompatible: isCompatibleProtocolVersion,
    parsePlayersPacket,
    parseChatPacket,
    parseSystemPacket,
    classifySystemMessage,
    convertNativePlayers,
    nativePacketMessages,
    encodeMovementPacket,
    encodeHeartbeat,
    encodeChatPacket
  };
}
