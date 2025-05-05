import { seiLocal } from '@sei-js/evm'

// Set your selected chain here
// To point to mainnet, use sei.
// To point to testnet, use seiTestnet.
const customChain = {
    ...seiLocal,
    rpcUrls: {
        default: {
            http: ["http://3.22.98.183:8545"],
        },
    },
}
export const selectedChain = customChain