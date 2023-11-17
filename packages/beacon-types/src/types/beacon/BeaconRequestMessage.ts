import {
  PermissionRequest,
  OperationRequest,
  SignPayloadRequest,
  BroadcastRequest
  // EncryptPayloadRequest
} from '@sparkdreamnft/beacon-types'

/**
 * @internalapi
 */
export type BeaconRequestMessage =
  | PermissionRequest
  | OperationRequest
  | SignPayloadRequest
  // | EncryptPayloadRequest
  | BroadcastRequest
