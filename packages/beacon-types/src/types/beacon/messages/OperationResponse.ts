import { BeaconBaseMessage, BeaconMessageType } from '@sparkdreamnft/beacon-types'

/**
 * @category Message
 */
export interface OperationResponse extends BeaconBaseMessage {
  type: BeaconMessageType.OperationResponse
  transactionHash: string // Hash of the broadcast transaction
}
