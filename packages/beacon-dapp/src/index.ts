export * from '@sparkdreamnft/beacon-core'
export * from '@sparkdreamnft/beacon-transport-matrix'
export * from '@sparkdreamnft/beacon-transport-postmessage'
export * from '@sparkdreamnft/beacon-types'
export * from '@sparkdreamnft/beacon-utils'
export * from '@sparkdreamnft/beacon-ui'

import { DAppClient } from './dapp-client/DAppClient'
import { DAppClientOptions } from './dapp-client/DAppClientOptions'
import { BeaconEvent, BeaconEventHandler, defaultEventCallbacks } from './events'
import { BlockExplorer } from './utils/block-explorer'
import { TzktBlockExplorer } from './utils/tzkt-blockexplorer'
import { getDAppClientInstance } from './utils/get-instance'

export { DAppClient, DAppClientOptions, getDAppClientInstance }

// Events
export { BeaconEvent, BeaconEventHandler, defaultEventCallbacks }

// BlockExplorer
export { BlockExplorer, TzktBlockExplorer, TzktBlockExplorer as TezblockBlockExplorer }
