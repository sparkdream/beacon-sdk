import { CommunicationClient, Serializer } from '@airgap/beacon-core'
import { SignClient } from '@walletconnect/sign-client'
import Client from '@walletconnect/sign-client'
import { SessionTypes } from '@walletconnect/types'
import { getSdkError } from '@walletconnect/utils'
import {
  ActiveAccountUnspecified,
  ActiveNetworkUnspecified,
  InvalidNetworkOrAccount,
  InvalidReceivedSessionNamespace,
  InvalidSession,
  MissingRequiredScope,
  NotConnected
} from '../error'
import {
  AccountInfo,
  BeaconMessageType,
  ConnectionContext,
  DAppClient,
  DAppClientOptions,
  ExtendedWalletConnectPairingResponse,
  getDAppClientInstance,
  OperationRequest,
  Origin,
  PermissionScope,
  SignPayloadRequest,
  SignPayloadResponse
} from '@airgap/beacon-dapp'

const TEZOS_PLACEHOLDER = 'tezos'

export enum NetworkType {
  MAINNET = 'mainnet',
  GHOSTNET = 'ghostnet',
  MONDAYNET = 'mondaynet',
  DAILYNET = 'dailynet',
  KATHMANDUNET = 'kathmandunet',
  LIMANET = 'limanet'
}

export interface PermissionScopeParam {
  networks: NetworkType[]
  methods: PermissionScopeMethods[]
  events?: PermissionScopeEvents[]
}
export enum PermissionScopeMethods {
  OPERATION_REQUEST = 'tezos_sendOperations',
  SIGN = 'tezos_signExpression'
}

export enum PermissionScopeEvents {
  CHAIN_CHANGED = 'chainChanged',
  ACCOUNTS_CHANGED = 'accountsChanged'
}

export class WalletConnectCommunicationClient extends CommunicationClient {
  protected readonly activeListeners: Map<
    string,
    (message: string, context: ConnectionContext) => void
  > = new Map()

  protected readonly channelOpeningListeners: Map<
    string,
    (pairingResponse: ExtendedWalletConnectPairingResponse) => void
  > = new Map()

  private static instance: WalletConnectCommunicationClient
  public signClient: Client | undefined
  private session: SessionTypes.Struct | undefined
  private activeAccount: string | undefined
  private activeNetwork: string | undefined
  private dappClient: DAppClient | undefined

  private currentMessageId: string | undefined // TODO JGD we shouldn't need this

  constructor() {
    super()
  }

  static getInstance(): WalletConnectCommunicationClient {
    if (!WalletConnectCommunicationClient.instance) {
      WalletConnectCommunicationClient.instance = new WalletConnectCommunicationClient()
    }
    return WalletConnectCommunicationClient.instance
  }

  public async listenForEncryptedMessage(
    senderPublicKey: string,
    messageCallback: (message: string, context: ConnectionContext) => void
  ): Promise<void> {
    if (this.activeListeners.has(senderPublicKey)) {
      return
    }

    const callbackFunction = async (message: string, context: ConnectionContext): Promise<void> => {
      messageCallback(message, context)
    }

    this.activeListeners.set(senderPublicKey, callbackFunction)
  }

  public async listenForChannelOpening(
    messageCallback: (pairingResponse: ExtendedWalletConnectPairingResponse) => void
  ): Promise<void> {
    const callbackFunction = async (
      pairingResponse: ExtendedWalletConnectPairingResponse
    ): Promise<void> => {
      messageCallback(pairingResponse)
    }
    this.channelOpeningListeners.set('JGD', callbackFunction) // TODO JGD
  }

  async unsubscribeFromEncryptedMessages(): Promise<void> {
    // implementation
  }

  async unsubscribeFromEncryptedMessage(_senderPublicKey: string): Promise<void> {
    // implementation
  }

  async sendMessage(_message: string, _peer?: any): Promise<void> {
    const serializer = new Serializer()
    const message = (await serializer.deserialize(_message)) as any

    this.currentMessageId = message.id
    console.log('❗️❗️❗️❗️❗️currentMessageId❗️❗️❗️❗️❗️', this.currentMessageId)

    if (message?.type === BeaconMessageType.OperationRequest) {
      this.sendOperations(message)
    }

    if (message?.type === BeaconMessageType.SignPayloadRequest) {
      this.signPayload(message)
    }

    console.log('🗝️ PAIR', this.keyPair)
    if (message?.type === BeaconMessageType.PermissionRequest) {
      // TODO JGD refactor
      const serializer = new Serializer()
      const serialized = await serializer.serialize({
        type: BeaconMessageType.PermissionResponse,
        appMetadata: {
          senderId: '25GYmjPnLm5HF',
          name: 'Kukai'
        },
        publicKey: '444e1f4ab90c304a5ac003d367747aab63815f583ff2330ce159d12c1ecceba1', // TODO JGD where to get this from?
        network: NetworkType.GHOSTNET as any,
        scopes: [PermissionScope.SIGN, PermissionScope.OPERATION_REQUEST],
        id: this.currentMessageId!
      })
      this.activeListeners.forEach((listener) => {
        listener(serialized, {
          origin: Origin.EXTENSION,
          id: this.currentMessageId!
        })
      })
    }
  }

  /**
   * @description Once the session is establish, send payload to be approved and signed by the wallet.
   * @error MissingRequiredScope is thrown if permission to sign payload was not granted
   */
  async signPayload(signPayloadRequest: SignPayloadRequest) {
    const session = this.getSession()
    if (!this.getPermittedMethods().includes(PermissionScopeMethods.SIGN)) {
      throw new MissingRequiredScope(PermissionScopeMethods.SIGN)
    }
    const network = this.getActiveNetwork()
    const account = await this.getPKH()
    this.validateNetworkAndAccount(network, account)

    const signature = await this.signClient?.request<string>({
      topic: session.topic,
      chainId: `${TEZOS_PLACEHOLDER}:${network}`,
      request: {
        method: PermissionScopeMethods.SIGN,
        params: {
          account: account,
          expression:
            '05010000004254657a6f73205369676e6564204d6573736167653a207465737455726c20323032332d30322d30385431303a33363a31382e3435345a2048656c6c6f20576f726c64', // TODO JGD hexify signPayloadRequest.payload,
          signingType: signPayloadRequest.signingType
        }
      }
    })

    const serializer = new Serializer()
    const signPayloadResponse = {
      type: BeaconMessageType.SignPayloadResponse,
      signingType: signPayloadRequest.signingType,
      signature,
      id: this.currentMessageId!
    } as SignPayloadResponse

    const serialized = await serializer.serialize(signPayloadResponse)

    this.activeListeners.forEach((listener) => {
      listener(serialized, {
        origin: Origin.EXTENSION,
        id: this.currentMessageId!
      })
    })
  }

  /**
   * @description Once the session is established, send Tezos operations to be approved, signed and inject by the wallet.
   * @error MissingRequiredScope is thrown if permission to send operation was not granted
   */
  async sendOperations(operationRequest: OperationRequest) {
    // TODO JGD type

    const session = this.getSession()

    if (!this.getPermittedMethods().includes(PermissionScopeMethods.OPERATION_REQUEST)) {
      throw new MissingRequiredScope(PermissionScopeMethods.OPERATION_REQUEST)
    }
    const network = this.getActiveNetwork() // TODO JGD
    const account = await this.getPKH()
    this.validateNetworkAndAccount(network, account)
    const hash = await this.signClient?.request<string>({
      topic: session.topic,
      chainId: `${TEZOS_PLACEHOLDER}:${network}`,
      request: {
        method: PermissionScopeMethods.OPERATION_REQUEST,
        params: {
          account,
          operations: operationRequest.operationDetails
        }
      }
    })

    if (hash) {
      const serializer = new Serializer()
      const serialized = await serializer.serialize({
        type: BeaconMessageType.OperationResponse,
        transactionHash: hash,
        id: this.currentMessageId!
      })
      this.activeListeners.forEach((listener) => {
        listener(serialized, {
          origin: Origin.EXTENSION,
          id: this.currentMessageId!
        })
      })
    }
    return hash
  }

  public async init(): Promise<string | undefined> {
    const connectParams = {
      permissionScope: {
        networks: [NetworkType.GHOSTNET],
        events: [],
        methods: [PermissionScopeMethods.OPERATION_REQUEST, PermissionScopeMethods.SIGN]
      },
      pairingTopic: undefined
    }
    const initParams = {
      projectId: '97f804b46f0db632c52af0556586a5f3',
      relayUrl: 'wss://relay.walletconnect.com',
      logger: 'debug',
      metadata: {
        name: 'Kukai Wallet',
        description:
          'Manage your digital assets and seamlessly connect with experiences and apps on Tezos.',
        url: 'https://wallet.kukai.app',
        icons: []
      }
    }
    this.signClient = await SignClient.init(initParams)

    this.signClient.on('session_delete', ({ topic }) => {
      console.log('############# session_delete #############')
      if (this.session?.topic === topic) {
        this.session = undefined
      }
    })

    this.signClient.on('session_expire', ({ topic }) => {
      console.log('############# session_expire #############')

      if (this.session?.topic === topic) {
        this.session = undefined
      }
    })

    this.signClient.on('session_update', ({ params, topic }) => {
      console.log('############# session_update #############')

      if (this.session?.topic === topic) {
        this.session.namespaces = params.namespaces
        // TODO determine if we need validation on the namespace here
      }
    })

    this.signClient.on('session_event', () => {
      console.log('############# session_event #############')

      // TODO Do we need to handle other session events, such as "chainChanged", "accountsChanged", etc.
    })
    const defaultMatrixNode = 'beacon-node-1.sky.papers.tech'

    const dappClientOptions: DAppClientOptions = {
      name: 'WalletConnect DAppClient',
      matrixNodes: [defaultMatrixNode] as any,
      preferredNetwork: NetworkType.GHOSTNET // TODO JGD change
    }
    this.dappClient = getDAppClientInstance(dappClientOptions)

    console.log(this.dappClient)
    const { uri, approval } = await this.signClient.connect({
      requiredNamespaces: {
        [TEZOS_PLACEHOLDER]: {
          chains: connectParams.permissionScope.networks.map(
            (network) => `${TEZOS_PLACEHOLDER}:${network}`
          ),
          methods: connectParams.permissionScope.methods,
          events: connectParams.permissionScope.events ?? []
        }
      },
      pairingTopic: connectParams.pairingTopic
    })

    approval().then(async (session) => {
      this.session = session
      this.validateReceivedNamespace(connectParams.permissionScope, this.session.namespaces)
      this.setDefaultAccountAndNetwork()

      const accountInfo = {
        accountIdentifier: 'X3yvif1yG6EJi2eNgsG',
        senderId: '25GYmjPnLm5HF',
        origin: {
          type: Origin.WALLETCONNECT,
          id: '1c9774ab70053b2d69003570813a70990e90e7f5a64ddb6050ec2fe2eea89c15'
        },
        address: this.activeAccount,
        publicKey: '',
        network: { type: 'mainnet' },
        scopes: ['sign', 'operation_request'],
        connectedAt: 1675249368999
      } as AccountInfo

      const pairingResponse = {
        id: '12345678',
        type: 'walletconnect-pairing-response',
        name: 'Kukai',
        publicKey: '',
        senderId: '25GYmjPnLm5HF', // TODO JGD where do we get this from
        extensionId: '1c9774ab70053b2d69003570813a70990e90e7f5a64ddb6050ec2fe2eea89c15' // TODO JGD where do we get this from
      } as any

      this.dappClient?.setActiveAccount(accountInfo) // TODO this shouldn't be necessary

      this.channelOpeningListeners.forEach((listener) => {
        listener({
          ...pairingResponse,
          senderId: '25GYmjPnLm5HF', // TODO await getSenderId(pairingResponse.publicKey),
          extensionId: '1c9774ab70053b2d69003570813a70990e90e7f5a64ddb6050ec2fe2eea89c15'
        })
      })
    })

    return uri
  }

  private validateReceivedNamespace(
    scope: PermissionScopeParam,
    receivedNamespaces: Record<string, SessionTypes.Namespace>
  ) {
    if (receivedNamespaces[TEZOS_PLACEHOLDER]) {
      this.validateMethods(scope.methods, receivedNamespaces[TEZOS_PLACEHOLDER].methods)
      if (scope.events) {
        this.validateEvents(scope.events, receivedNamespaces['tezos'].events)
      }
      this.validateAccounts(scope.networks, receivedNamespaces[TEZOS_PLACEHOLDER].accounts)
    } else {
      this.clearState()
      throw new InvalidReceivedSessionNamespace(
        'All namespaces must be approved',
        getSdkError('USER_REJECTED').code,
        'incomplete',
        'tezos'
      )
    }
  }

  private validateMethods(requiredMethods: string[], receivedMethods: string[]) {
    const missingMethods: string[] = []
    requiredMethods.forEach((method) => {
      if (!receivedMethods.includes(method)) {
        missingMethods.push(method)
      }
    })
    if (missingMethods.length > 0) {
      this.clearState()
      throw new InvalidReceivedSessionNamespace(
        'All methods must be approved',
        getSdkError('USER_REJECTED_METHODS').code,
        'incomplete',
        missingMethods
      )
    }
  }

  private validateEvents(requiredEvents: string[], receivedEvents: string[]) {
    const missingEvents: string[] = []
    requiredEvents.forEach((method) => {
      if (!receivedEvents.includes(method)) {
        missingEvents.push(method)
      }
    })
    if (missingEvents.length > 0) {
      this.clearState()
      throw new InvalidReceivedSessionNamespace(
        'All events must be approved',
        getSdkError('USER_REJECTED_EVENTS').code,
        'incomplete',
        missingEvents
      )
    }
  }

  private validateAccounts(requiredNetwork: string[], receivedAccounts: string[]) {
    if (receivedAccounts.length === 0) {
      this.clearState()
      throw new InvalidReceivedSessionNamespace(
        'Accounts must not be empty',
        getSdkError('USER_REJECTED_CHAINS').code,
        'incomplete'
      )
    }
    const receivedChains: string[] = []
    const invalidChains: string[] = []
    const missingChains: string[] = []
    const invalidChainsNamespace: string[] = []

    receivedAccounts.forEach((chain) => {
      const accountId = chain.split(':')
      if (accountId.length !== 3) {
        invalidChains.push(chain)
      }
      if (accountId[0] !== TEZOS_PLACEHOLDER) {
        invalidChainsNamespace.push(chain)
      }
      const network = accountId[1]
      if (!receivedChains.includes(network)) {
        receivedChains.push(network)
      }
    })

    if (invalidChains.length > 0) {
      this.clearState()
      throw new InvalidReceivedSessionNamespace(
        'Accounts must be CAIP-10 compliant',
        getSdkError('USER_REJECTED_CHAINS').code,
        'invalid',
        invalidChains
      )
    }

    if (invalidChainsNamespace.length > 0) {
      this.clearState()
      throw new InvalidReceivedSessionNamespace(
        'Accounts must be defined in matching namespace',
        getSdkError('UNSUPPORTED_ACCOUNTS').code,
        'invalid',
        invalidChainsNamespace
      )
    }
    requiredNetwork.forEach((network) => {
      if (!receivedChains.includes(network)) {
        missingChains.push(network)
      }
    })
    if (missingChains.length > 0) {
      this.clearState()
      throw new InvalidReceivedSessionNamespace(
        'All chains must have at least one account',
        getSdkError('USER_REJECTED_CHAINS').code,
        'incomplete',
        missingChains
      )
    }
  }
  private validateNetworkAndAccount(network: string, account: string) {
    if (!this.getTezosNamespace().accounts.includes(`${TEZOS_PLACEHOLDER}:${network}:${account}`)) {
      throw new InvalidNetworkOrAccount(network, account)
    }
  }
  /**
   * @description Access the active network
   * @error ActiveNetworkUnspecified thorwn when there are multiple Tezos netwroks in the session and none is set as the active one
   */
  getActiveNetwork() {
    if (!this.activeNetwork) {
      this.getSession()
      throw new ActiveNetworkUnspecified()
    }
    return this.activeNetwork
  }

  private setDefaultAccountAndNetwork() {
    const activeAccount = this.getAccounts()
    if (activeAccount.length === 1) {
      this.activeAccount = activeAccount[0]
    }
    const activeNetwork = this.getNetworks()
    if (activeNetwork.length === 1) {
      this.activeNetwork = activeNetwork[0]
    }
  }

  /**
   * @description Return all connected accounts from the active session
   * @error NotConnected if no active session
   */
  getAccounts() {
    return this.getTezosNamespace().accounts.map((account) => account.split(':')[2])
  }

  /**
   * @description Return all networks from the namespace of the active session
   * @error NotConnected if no active session
   */
  getNetworks() {
    return this.getPermittedNetwork()
  }

  private getTezosNamespace(): {
    accounts: string[]
    methods: string[]
    events: string[]
  } {
    if (TEZOS_PLACEHOLDER in this.getSession().namespaces) {
      return this.getSession().namespaces[TEZOS_PLACEHOLDER]
    } else {
      throw new InvalidSession('Tezos not found in namespaces')
    }
  }
  private getPermittedMethods() {
    return this.getTezosRequiredNamespace().methods
  }

  private getPermittedNetwork() {
    return this.getTezosRequiredNamespace().chains.map((chain) => chain.split(':')[1])
  }

  private getTezosRequiredNamespace(): {
    chains: string[]
    methods: string[]
    events: string[]
  } {
    if (TEZOS_PLACEHOLDER in this.getSession().requiredNamespaces) {
      return this.getSession().requiredNamespaces[TEZOS_PLACEHOLDER]
    } else {
      throw new InvalidSession('Tezos not found in requiredNamespaces')
    }
  }

  getSession() {
    if (!this.session) {
      throw new NotConnected()
    }
    return this.session
  }

  /**
   * @description Access the public key hash of the active account
   * @error ActiveAccountUnspecified thrown when there are multiple Tezos account in the session and none is set as the active one
   */
  async getPKH() {
    if (!this.activeAccount) {
      this.getSession()
      throw new ActiveAccountUnspecified()
    }
    return this.activeAccount
  }

  private clearState() {
    this.session = undefined
    this.activeAccount = undefined
    this.activeNetwork = undefined
  }
}
