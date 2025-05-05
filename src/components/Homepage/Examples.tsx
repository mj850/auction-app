import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWriteContract, useSignMessage } from "wagmi";
import { CtAccountResponse, getApplyPendingBalancesViemArgs, getInitializeAccountViemArgs, queryAccountViem, decryptAccountViem, getDenomToSignViem, getWithdrawFromPrivateBalanceViemArgs, DecryptedAccount, getDepositToPrivateBalanceViemArgs, getConfidentialTransferViemArgs, ConfidentialTransfersWrapper } from "@sei-js/confidential-transfers"
import { auctionAbi } from './abi'; // Adjust the import path as necessary

import "./Homepage.css";
import { decodeFunctionData, hexToBytes } from "viem";
import { CONFIDENTIAL_TRANSFERS_PRECOMPILE_ABI } from "@sei-js/evm";

function Examples() {
    const [activeTab, setActiveTab] = useState<"confidential" | "auction">("confidential");

    const [depositAmount, setDepositAmount] = useState(0);
    const [withdrawAmount, setWithdrawAmount] = useState(0);
    const [transferAmount, setTransferAmount] = useState(0);
    const [transferRecipient, setTransferRecipient] = useState("")
    const [userTransferTxs, setUserTransferTxs] = useState<{ hash: string; amount: bigint }[]>()
    const [account, setAccount] = useState<CtAccountResponse | null>(null);
    const [decryptedAccount, setDecryptedAccount] = useState<DecryptedAccount | string>("Not Decrypted");

    // Auction variables
    const [bidsByRound, setBidsByRound] = useState<Record<number, any[]>>({});
    const [txHashes, setTxHashes] = useState<Record<number, string>>({});
    const AuctionAddress = "0xFE5ea74f2425a8d606c02c4e8151b60436Ea5C59"
    const [roundStatuses, setRoundStatuses] = useState<Record<number, { settled: boolean, prize: bigint }>>({});
    const [numRounds, setNumRounds] = useState<number>(0);
    const [leaderboardOpen, setLeaderboardOpen] = useState(false);
    const [leaderboard, setLeaderboard] = useState<{ address: string; balance: bigint }[]>([]);

    const [generatingPayload, setGeneratingPayload] = useState(false);
    const publicClient = usePublicClient();
    const signMessage = useSignMessage();
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();

    const [contractOwner, setContractOwner] = useState<string | null>(null);

    useEffect(() => {
        const fetchContractOwner = async () => {
            try {
                const owner = await publicClient?.readContract({
                    address: AuctionAddress,
                    abi: [
                        {
                            name: "owner",
                            type: "function",
                            stateMutability: "view",
                            inputs: [],
                            outputs: [{ name: "", type: "address" }],
                        },
                    ],
                    functionName: "owner",
                });
                if (owner) setContractOwner(owner as string);
            } catch (e) {
                console.error("Failed to fetch contract owner", e);
            }
        };

        if (activeTab === "confidential") {
            fetchContractOwner();
        }
    }, [publicClient, activeTab]);

    useEffect(() => {
        const fetchNumRounds = async () => {
            if (!publicClient) return;
            const numRound = await publicClient.readContract({
                address: AuctionAddress,
                abi: auctionAbi,
                functionName: "numRounds",
            });
            console.log("NUM ROUNDS", numRound)
            setNumRounds(Number(numRound));
        };

        const fetchRoundData = async () => {
            if (!publicClient) return;
            const statusMap: Record<number, { settled: boolean, prize: bigint }> = {};
            await fetchNumRounds();
            for (let round = 0; round < Number(numRounds); round++) {
                try {
                    const roundStatus = await publicClient.readContract({
                        address: AuctionAddress,
                        abi: auctionAbi,
                        functionName: "rounds",
                        args: [BigInt(round)],
                    })
                    console.log("ROUND STATUS", roundStatus)
                    if (Array.isArray(roundStatus) && typeof roundStatus[2] === 'boolean' && typeof roundStatus[0] === 'bigint') {
                        statusMap[round] = {
                            settled: roundStatus[2],
                            prize: roundStatus[0],
                        };
                    } else {
                        console.error(`Unexpected roundStatus format for round ${round}`, roundStatus);
                    }
                } catch (e) {
                    console.error(`Failed to fetch round ${round} status`, e);
                }
            }
            setRoundStatuses(statusMap);
        };
        if (activeTab === "auction") {
            fetchRoundData();
        }

    }, [publicClient, activeTab]);

    // Example of using precompiles to query native Sei modules.
    const getConfidentialAccount = async () => {
        if (!publicClient) {
            return;
        }

        try {
            const response = await queryAccountViem(publicClient, String(address), "usei");
            setAccount(response);
        } catch (e) {
            console.log(e);
        }
    }

    const decryptAccount = async () => {
        if (account === null) {
            setDecryptedAccount("No Account")
            return
        }

        // 1. Base64 encode the signature.
        const ctdenom = getDenomToSignViem("usei")
        const signedDenom = await signMessage.signMessageAsync({
            account: address,
            message: ctdenom
        })
        const timeStart = performance.now();
        const decryptedAccount = await decryptAccountViem(signedDenom, account, true);
        const timeEnd = performance.now();
        console.log(`Time taken: ${timeEnd - timeStart} milliseconds`);
        setDecryptedAccount(decryptedAccount);
    }

    const renderAccountExample = () => {
        const bigIntReplacer = (_: any, value: any) => {
            return typeof value === 'bigint' ? value.toString() : value;
        };

        return (
            <div className="card">
                <div className="card-header">
                    <p className="card__title">Query Confidential Account (Encrypted)</p>
                    <small className="card__description">
                        <a
                            href="https://www.docs.sei.io/dev-interoperability/precompiles/bank"
                            target="_blank"> Confidential Transfers Precompile
                        </a> example for querying Account
                    </small>
                </div>
                <div className="card-body">
                    <a>Encrypted</a>
                    <div className="content-background space-between">
                        <pre>{JSON.stringify(account, null, 4)}</pre>
                    </div>
                </div>
                <div className="card-body">
                    <a>Decrypted</a>
                    <div className="content-background space-between">
                        <pre>{JSON.stringify(decryptedAccount, bigIntReplacer, 4)}</pre>
                    </div>
                </div>
                <div className="card-footer">
                    <button onClick={getConfidentialAccount}>View Account</button>
                    <button onClick={decryptAccount}>Decrypt</button>
                </div>
            </div>
        )
    }

    // Example of using precompiles to query native Sei modules.
    const initializeCt = async () => {
        if (!publicClient) {
            return;
        }

        // 1. Base64 encode the signature.
        const ctdenom = getDenomToSignViem("usei")
        const signedDenom = await signMessage.signMessageAsync({
            account: address,
            message: ctdenom
        })

        const generatedParams = await getInitializeAccountViemArgs(signedDenom, String(address), "usei")
        console.log("GeNPa", generatedParams)
        await estimateAndCall(generatedParams)
    }

    const renderConfidentialInitializeExample = () => {
        return (
            <div className="card">
                <div className="card-header">
                    <p className="card__title">Initialize Confidential Account</p>
                    <small>
                        <a
                            href="https://www.docs.sei.io/dev-interoperability/precompiles/cosmwasm"
                            target="_blank">
                            CT Initialize
                        </a> example of Confidential Transfers interaction
                    </small>
                </div>
                <div className="card-body">
                    <div className="content-background space-between">
                        Initialize CT Account
                    </div>
                </div>
                <div className="card-footer">
                    <button onClick={initializeCt}>Initialize CT Account</button>
                </div>
            </div>
        )
    }

    // Example of using precompiles to query native Sei modules.
    const depositCt = async () => {
        if (!publicClient) {
            return;
        }

        const generatedParams = await getDepositToPrivateBalanceViemArgs(address, "usei", BigInt(depositAmount))
        await estimateAndCall(generatedParams)
    }

    const renderDepositButton = () => {
        return (
            <div className="card">
                <div className="card-header">
                    <p className="card__title">Deposit to Confidential Account</p>
                    <small>
                        <a
                            target="_blank">
                            CT Deposit
                        </a> example of Confidential Transfers deposit
                    </small>
                </div>
                <div className="card-body">
                    <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(Number(e.target.value))}
                        placeholder="Enter deposit amount"
                        className="deposit-input"
                    />
                </div>
                <div className="card-footer">
                    <button onClick={depositCt}>Deposit</button>
                </div>
            </div>
        )
    }

    // Example of using precompiles to query native Sei modules.
    const applyPendingBalances = async () => {
        if (!publicClient) {
            return;
        }

        const ctdenom = getDenomToSignViem("usei")
        const signedDenom = await signMessage.signMessageAsync({
            account: address,
            message: ctdenom
        })

        let generatedParams;
        try {
            setGeneratingPayload(true);
            generatedParams = await getApplyPendingBalancesViemArgs(String(address), "usei", publicClient, signedDenom)
        } finally {
            setGeneratingPayload(false);
        }
        await estimateAndCall(generatedParams)

    }

    const renderApplyPendingBalancesButton = () => {
        return (
            <div className="card">
                <div className="card-header">
                    <p className="card__title">Apply Pending Balances of Confidential Account</p>
                    <small>
                        <a
                            target="_blank">
                            CT Apply Pending Balances
                        </a> example of Confidential Transfers Apply Pending Balance
                    </small>
                </div>
                <div className="card-body">
                </div>
                <div className="card-footer">
                    <button onClick={applyPendingBalances}>
                        {generatingPayload ? "Loading..." : "Apply Pending Balances"}
                    </button>
                </div>
            </div>
        )
    }

    // Example of using precompiles to query native Sei modules.
    const withdraw = async () => {
        if (!publicClient) {
            return;
        }

        const ctdenom = getDenomToSignViem("usei")
        const signedDenom = await signMessage.signMessageAsync({
            account: address,
            message: ctdenom
        })

        const generatedParams = await getWithdrawFromPrivateBalanceViemArgs(String(address), "usei", withdrawAmount, publicClient, signedDenom)
        await estimateAndCall(generatedParams)

    }

    const renderWithdrawButton = () => {
        return (
            <div className="card">
                <div className="card-header">
                    <p className="card__title">Withdraw from Confidential Account</p>
                    <small>
                        <a
                            target="_blank">
                            CT Withdraw
                        </a> example of Confidential Transfers withdraw
                    </small>
                </div>
                <div className="card-body">
                    <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                        placeholder="Enter withdraw amount"
                        className="withdraw-input"
                    />
                </div>
                <div className="card-footer">
                    <button onClick={withdraw}>Withdraw</button>
                </div>
            </div>
        )
    }

    // Example of using precompiles to query native Sei modules.
    const transfer = async () => {
        if (!publicClient) {
            return;
        }

        const ctdenom = getDenomToSignViem("usei")
        const signedDenom = await signMessage.signMessageAsync({
            account: address,
            message: ctdenom
        })

        const generatedParams = await getConfidentialTransferViemArgs(String(address), String(transferRecipient), "usei", transferAmount, publicClient, signedDenom)
        console.log("GENERATED PARAMS", generatedParams)
        const result = await estimateAndCall(generatedParams)
        if (result) {
            const newTxHashes = [...(userTransferTxs || []), { hash: result, amount: BigInt(transferAmount) }]
            setUserTransferTxs(newTxHashes)
        }
    }

    const renderTransferButton = () => {
        return (
            <div className="card">
                <div className="card-header">
                    <p className="card__title">Make Confidential Transfer</p>
                    <small>
                        <a
                            target="_blank">
                            CT Transfer
                        </a> example of Confidential Transfers
                    </small>
                </div>
                <div className="card-body">
                    <input
                        type="string"
                        value={transferRecipient}
                        onChange={(e) => setTransferRecipient(e.target.value)}
                        placeholder="Enter transfer recipient"
                        className="transfer-input"
                    />
                    <input
                        type="number"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(Number(e.target.value))}
                        placeholder="Enter transfer amount"
                        className="transfer-input"
                    />
                </div>
                <div className="card-footer">
                    <button onClick={transfer}>Transfer</button>
                </div>
                {
                    userTransferTxs && userTransferTxs.length > 0 && (
                        <table className="content-background-table">
                            <thead>
                                <tr>
                                    <th>Tx Hash</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(userTransferTxs || []).map(({ hash, amount }) => (
                                    <tr key={hash}>
                                        <td>
                                            <span
                                                title="Click to copy"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(hash);
                                                    alert('Copied to clipboard!');
                                                }}
                                                style={{
                                                    cursor: "pointer",
                                                    color: "#007bff",
                                                    textDecoration: "underline",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                }}
                                            >
                                                {hash.slice(0, 6)}...{hash.slice(-4)}
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="16"
                                                    height="16"
                                                    fill="currentColor"
                                                    className="bi bi-clipboard"
                                                    viewBox="0 0 16 16"
                                                    style={{ marginLeft: "4px" }}
                                                >
                                                    <path d="M10 1.5v1H6v-1a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5z" />
                                                    <path d="M9.5 0a1.5 1.5 0 0 1 1.5 1.5V2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h1v-.5A1.5 1.5 0 0 1 6.5 0h3zM4 3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4z" />
                                                </svg>
                                            </span>
                                        </td>
                                        <td>{amount.toString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                }

            </div>
        )
    }

    const getBids = async (round: number) => {
        type Bid = {
            bidder: string;
            txHash: string;
            revealedAmount: bigint;
            revealed: boolean;
            prizeDisbursed: bigint;
        };

        try {
            const bids = await publicClient!.readContract({
                address: AuctionAddress,
                abi: auctionAbi,
                functionName: "getBids",
                args: [BigInt(round)],
            }) as Bid[];

            setBidsByRound((prev) => ({ ...prev, [round]: [...bids] }));
        } catch (e) {
            console.error(`Failed to fetch bids for round ${round}`, e);
        }
    };

    const submitBid = async (round: number) => {
        const txHash = txHashes[round];
        if (!publicClient || !txHash) return;

        try {
            const result = await writeContractAsync({
                address: AuctionAddress,
                abi: auctionAbi,
                functionName: "submitBid",
                args: [BigInt(round), txHash as `0x${string}`],
            });

            console.log("Bid submitted, tx:", result);
        } catch (e) {
            console.error("Bid submission failed:", e);
        }
    };

    const renderAllBidCards = () => {

        return Array.from({ length: Number(numRounds) }, (_, round) => {
            const settled = roundStatuses[round]?.settled ?? false;
            const prizeAmount = roundStatuses[round]?.prize ?? 0n;

            return (
                <div key={round} className="card">
                    <div className="card-header">
                        <p className="card__title">
                            Round {round + 1}: Submit Bid {settled && <span style={{ color: "red" }}>[CLOSED]</span>}
                        </p>
                        <small>Prize Pool: <strong>{prizeAmount.toString()}</strong> PRZ tokens</small>
                    </div>

                    <div className="card-body-table">
                        {/* Bids table */}
                        <table className="content-background-table">
                            <thead>
                                <tr>
                                    <th>Bidder</th>
                                    <th>Tx Hash</th>
                                    <th>Amount</th>
                                    <th>Revealed</th>
                                    <th>Prize Disbursed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(bidsByRound[round] || []).map((bid, index) => (
                                    <tr key={index}>
                                        <td>
                                            <span
                                                title={bid.bidder}
                                                onClick={() => navigator.clipboard.writeText(bid.bidder)}
                                                style={{ cursor: "pointer", color: "#007bff" }}
                                            >
                                                {bid.bidder.slice(0, 6)}...{bid.bidder.slice(-4)}
                                            </span>
                                        </td>
                                        <td>
                                            <span
                                                title={bid.txHash}
                                                onClick={() => navigator.clipboard.writeText(bid.txHash)}
                                                style={{ cursor: "pointer", color: "#007bff" }}
                                            >
                                                {bid.txHash.slice(0, 6)}...{bid.txHash.slice(-4)}
                                            </span>
                                        </td>
                                        <td>{bid.revealed ? bid.revealedAmount.toString() : "-"}</td>
                                        <td>{bid.revealed ? "Yes" : "No"}</td>
                                        <td>{bid.revealed && bid.prizeDisbursed !== undefined ? bid.prizeDisbursed.toString() : "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <input
                            type="text"
                            placeholder="Enter tx hash (0x...)"
                            className="transfer-input"
                            value={txHashes[round] || ""}
                            onChange={(e) => setTxHashes((prev) => ({ ...prev, [round]: e.target.value }))}
                        />
                    </div>

                    <div className="card-footer">
                        <button onClick={() => getBids(round)}>Get Bids</button>
                        {!settled && <button onClick={() => submitBid(round)}>Submit Bid</button>}
                        {address === contractOwner && (
                            <>
                                <button onClick={() => revealBids(round)}>Reveal Bids</button>
                                <button onClick={() => settleRound(round)}>Settle</button>
                            </>
                        )}
                    </div>
                </div>
            );
        });
    };


    const estimateAndCall = async (generatedParams: any) => {
        try {
            const estimatedGas = await publicClient!.estimateContractGas(generatedParams);
            console.log("ESTGAS", estimatedGas)

            // Call smart contract execute msg
            const result = await writeContractAsync({ ...generatedParams, gas: estimatedGas });
            // Wait for 1 block to confirm transaction
            setTimeout(() => { }, 400);
            console.log("RESULT", result)
            return result;
        } catch (e) {
            console.log(e);
        }
    }
    const revealBids = async (round: number) => {
        if (!contractOwner || !publicClient || address != contractOwner) return;

        const api = new ConfidentialTransfersWrapper();
        await api.initialize();
        const denomToSign = getDenomToSignViem("usei")
        const signedDenom = await signMessage.signMessageAsync({ account: address, message: denomToSign });
        const signedDenomBytes = hexToBytes(signedDenom);
        
        const bids = bidsByRound[round] || [];
        for (const bid of bids) {
            let amount = 0n;
            try {
                const tx = await publicClient.getTransaction({ hash: bid.txHash });
                if (tx.from != bid.bidder) {
                    console.warn("Tx from is not bidder", tx.from, bid.bidder)
                    await writeContractAsync({
                        address: AuctionAddress,
                        abi: auctionAbi,
                        functionName: "revealBid",
                        args: [BigInt(round), bid.bidder, amount],
                    });
                    continue;
                }
                
                console.log(tx)
                const amounts = extractTransferAmounts(tx);
                console.log(amounts)
                if (amounts && amounts.toAddress == address) {
                    const loBytes = hexToBytes(amounts.toAmountLo as `0x${string}`)
                    const lo = api.decryptCiphertext(signedDenomBytes, loBytes);
                    console.log("LO", lo)
                    const hiBytes = hexToBytes(amounts.toAmountHi as `0x${string}`)
                    const hi = api.decryptCiphertext(signedDenomBytes, hiBytes);
                    console.log("HI", hi)
                    amount = lo + (hi << 16n);
                } else {
                    console.warn("Failed to extract amounts from tx", bid.txHash);
                    await writeContractAsync({
                        address: AuctionAddress,
                        abi: auctionAbi,
                        functionName: "revealBid",
                        args: [BigInt(round), bid.bidder, amount],
                    });
                    throw new Error("Failed to extract amounts from tx");
                }

            } catch (err) {
                console.warn("Decryption or parsing failed for tx", bid.txHash, err);
            }

            await writeContractAsync({
                address: AuctionAddress,
                abi: auctionAbi,
                functionName: "revealBid",
                args: [BigInt(round), bid.bidder, amount],
            });
        }
    };

    const settleRound = async (round: number) => {
        await writeContractAsync({
            address: AuctionAddress,
            abi: auctionAbi,
            functionName: "settleRound",
            args: [BigInt(round)],
        });
    }

    /**
     * Extracts the toAmountLo and toAmountHi fields from a confidential transfer transaction.
     * @param tx - A transaction object from publicClient.getTransaction()
     * @returns The two fields as bytes or null if not a valid transfer tx.
     */
    function extractTransferAmounts(tx: { input: `0x${string}` }): {
        toAddress: string;
        toAmountLo: string;
        toAmountHi: string;
    } | null {
        try {
            const result = decodeFunctionData({
                abi: CONFIDENTIAL_TRANSFERS_PRECOMPILE_ABI,
                data: tx.input,
            });

            if (result.functionName !== 'transfer') return null;

            const args = result.args as unknown as any[];
            console.log("ARGS", args)
            console.log("ARGS[0]", args[0])
            console.log("ARGS[4]", args[4])
            console.log("ARGS[5]", args[5])
            return {
                toAddress: args[0],
                toAmountLo: args[4],
                toAmountHi: args[5],
            };
        } catch (e) {
            console.warn('Failed to decode confidential transfer input:', e);
            return null;
        }
    }
    const renderLeaderboard = () => {
        return (
            <div className="card">
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between" }}>
                    <p className="card__title">🏆 Leaderboard</p>
                    <button onClick={() => {
                        setLeaderboardOpen(!leaderboardOpen);
                        if (!leaderboardOpen && leaderboard.length === 0) fetchLeaderboard();
                    }}>
                        {leaderboardOpen ? "Hide" : "Show"}
                    </button>
                </div>
                {leaderboardOpen && (
                    <div className="card-body">
                        <table className="content-background-table">
                            <thead>
                                <tr>
                                    <th>Address</th>
                                    <th>Prize Token Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map(({ address, balance }) => (
                                    <tr key={address}>
                                        <td>
                                            <span
                                                title={address}
                                                onClick={() => navigator.clipboard.writeText(address)}
                                                style={{ cursor: "pointer", color: "#007bff" }}
                                            >
                                                {address.slice(0, 6)}...{address.slice(-4)}
                                            </span>
                                        </td>
                                        <td>{balance.toString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )
    }

    const fetchLeaderboard = async () => {
        try {
            const [addresses, balances] = await publicClient!.readContract({
                address: AuctionAddress,
                abi: auctionAbi,
                functionName: "getAllBidderBalances",
            }) as [string[], bigint[]];

            const map = new Map<string, bigint>();
            for (let i = 0; i < addresses.length; i++) {
                const addr = addresses[i];
                const balance = balances[i];
                map.set(addr, (map.get(addr) || 0n) + balance);
            }

            const result = Array.from(map.entries()).map(([address, balance]) => ({ address, balance }));
            result.sort((a, b) => (b.balance > a.balance ? 1 : -1));

            setLeaderboard(result);
        } catch (e) {
            console.error("Failed to fetch leaderboard", e);
        }
    };

    return (
        <>
            <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginBottom: "1rem" }}>
                <button onClick={() => setActiveTab("confidential")}>
                    Confidential Transfers
                </button>
                <button onClick={() => setActiveTab("auction")}>
                    Auction
                </button>
            </div>
            <div className="container">
                {activeTab === "confidential" && (
                    <>
                        {contractOwner && (
                            <div className="card">
                                <div className="card-header">
                                    <p className="card__title">How to Participate</p>
                                    <small>Follow these steps to enter the auction:</small>
                                </div>
                                <div className="card-body">
                                    <ol>
                                        <li>
                                            <strong>Send a confidential transfer</strong> to{" "}
                                            <code>{contractOwner}</code>
                                        </li>
                                        <li>
                                            After the transaction confirms, <strong>copy the transaction hash</strong> and submit your bid on the <strong>Auction</strong> tab.
                                        </li>
                                    </ol>
                                </div>
                            </div>
                        )}
                        {/* Third card */}
                        {renderAccountExample()}

                        {/* Fourth card */}
                        {renderConfidentialInitializeExample()}

                        {renderDepositButton()}

                        {renderApplyPendingBalancesButton()}

                        {renderWithdrawButton()}

                        {renderTransferButton()}
                    </>
                )}
                {activeTab === "auction" && (
                    <>
                        {renderLeaderboard()}
                        {renderAllBidCards()}
                        {/* Add more auction-related components here later */}
                    </>
                )}
            </div>
        </>
    )
}

export default Examples;
