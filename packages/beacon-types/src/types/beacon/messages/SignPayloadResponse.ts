import { BeaconBaseMessage, BeaconMessageType, SigningType } from '@sparkdreamnft/beacon-types'

/**
 * @category Message
 */
export interface SignPayloadResponse extends BeaconBaseMessage {
  type: BeaconMessageType.SignPayloadResponse
  signingType: SigningType
  signature: string // Signature of the payload
}
