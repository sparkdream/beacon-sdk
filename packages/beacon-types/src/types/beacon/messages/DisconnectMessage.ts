import { BeaconBaseMessage, BeaconMessageType } from '@sparkdreamnft/beacon-types'

/**
 * @category Message
 */
export interface DisconnectMessage extends BeaconBaseMessage {
  type: BeaconMessageType.Disconnect
}
