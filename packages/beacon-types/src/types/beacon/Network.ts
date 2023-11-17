import { NetworkType } from '@sparkdreamnft/beacon-types'

export interface Network {
  type: NetworkType
  name?: string
  rpcUrl?: string
}
