import { seiLocal } from '@sei-js/evm'

// Set your selected chain here
// To point to mainnet, use sei.
// To point to testnet, use seiTestnet.
const customChain = {
    ...seiLocal,
    rpcUrls: {
        default: {
            http: ["https://evm-rpc.psu-evm-test-5.sei.io"],
        },
    },
}
export const selectedChain = customChain