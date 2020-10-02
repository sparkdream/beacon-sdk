import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import 'mocha'
import { getAccountIdentifier } from '../../src/utils/get-account-identifier'
import { Network, NetworkType } from '../../src'

// use chai-as-promised plugin
chai.use(chaiAsPromised)
const expect = chai.expect

describe(`AccountIdentifier`, () => {
  describe('getAccountIdentifier', () => {
    it(`should return the account identifier for an address on mainnet`, async () => {
      const address: string = 'tz1d75oB6T4zUMexzkr5WscGktZ1Nss1JrT7'
      const network: Network = { type: NetworkType.MAINNET }

      const accountIdentifier: string = await getAccountIdentifier(address, network)

      expect(accountIdentifier).to.deep.equal('yQxM85PrJ718CA1N6oz')
    })

    it(`should return the account identifier for an address on carthagenet`, async () => {
      const address: string = 'tz1d75oB6T4zUMexzkr5WscGktZ1Nss1JrT7'
      const network: Network = { type: NetworkType.CARTHAGENET }

      const accountIdentifier: string = await getAccountIdentifier(address, network)

      expect(accountIdentifier).to.deep.equal('YRiyvQRFbUmq5bqzVyK')
    })

    it(`should return the account identifier for an address on custom net`, async () => {
      const address: string = 'tz1d75oB6T4zUMexzkr5WscGktZ1Nss1JrT7'
      const network: Network = {
        type: NetworkType.CUSTOM,
        name: 'Test',
        rpcUrl: 'http://localhost:8080/'
      }

      const accountIdentifier: string = await getAccountIdentifier(address, network)

      expect(accountIdentifier).to.deep.equal('2BvmGNNovaYxXo879r6j')
    })

    it(`should return different account identifier for different network names`, async () => {
      const address: string = 'tz1d75oB6T4zUMexzkr5WscGktZ1Nss1JrT7'
      const network1: Network = { type: NetworkType.MAINNET, name: 'Mainnet 1' }
      const network2: Network = { type: NetworkType.MAINNET, name: 'Mainnet 2' }

      const accountIdentifier1: string = await getAccountIdentifier(address, network1)
      const accountIdentifier2: string = await getAccountIdentifier(address, network2)

      expect(accountIdentifier1).to.not.equal(accountIdentifier2)
    })

    it(`should return different account identifier for different network rpcUrls`, async () => {
      const address: string = 'tz1d75oB6T4zUMexzkr5WscGktZ1Nss1JrT7'
      const network1: Network = { type: NetworkType.MAINNET, rpcUrl: 'http://localhost/' }
      const network2: Network = { type: NetworkType.MAINNET, rpcUrl: 'http://localhost:8080/' }

      const accountIdentifier1: string = await getAccountIdentifier(address, network1)
      const accountIdentifier2: string = await getAccountIdentifier(address, network2)

      expect(accountIdentifier1).to.not.equal(accountIdentifier2)
    })

    it(`should return different account identifier for same name or rpcUrl`, async () => {
      const address: string = 'tz1d75oB6T4zUMexzkr5WscGktZ1Nss1JrT7'
      const network1: Network = { type: NetworkType.MAINNET, name: 'http://localhost:8080/' }
      const network2: Network = { type: NetworkType.MAINNET, rpcUrl: 'http://localhost:8080/' }

      const accountIdentifier1: string = await getAccountIdentifier(address, network1)
      const accountIdentifier2: string = await getAccountIdentifier(address, network2)

      expect(accountIdentifier1).to.not.equal(accountIdentifier2)
    })
  })
})
