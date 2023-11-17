import { BeaconBaseMessage, BeaconMessageType } from '@sparkdreamnft/beacon-types'

/**
 * @category Message
 */
export interface AcknowledgeResponse extends BeaconBaseMessage {
  type: BeaconMessageType.Acknowledge
}
