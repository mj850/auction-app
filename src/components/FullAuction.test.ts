// import { ethers } from "hardhat";
// import { expect } from "chai";
// const seiJs = await import("@sei-js/confidential-transfers");
// import {
//   getDenomToSignEthers,
//   initializeAccountEthers,
//   depositToPrivateBalanceEthers,
//   applyPendingBalanceEthers,
//   confidentialTransferEthers,
//   queryAccountEthers,
//   decryptPendingBalancesEthers
// } from "@sei-js/confidential-transfers";
// import { keccak256, Wallet } from "ethers";

// describe("Confidential Auction - End to End", function () {
//   this.timeout(60_000); // Increase timeout for async steps

//   const denom = "usei";
//   let owner: any, bidder1: any, bidder2: any;
//   let auction: any;

//   it("Initializes the auction and confidential accounts", async () => {
//     const signers = await ethers.getSigners();
//     owner = signers[0];
//     bidder1 = signers[1];
//     bidder2 = signers[2];

//     // Deploy auction
//     const AuctionFactory = await ethers.getContractFactory("Auction", owner);
//     auction = await AuctionFactory.deploy(denom);
//     await auction.waitForDeployment();

//     // Derive signed denoms
//     const denomHash1 = getDenomToSignEthers(denom);
//     const signedDenom1 = await bidder1.signMessage(ethers.getBytes(denomHash1));

//     const denomHash2 = getDenomToSignEthers(denom);
//     const signedDenom2 = await bidder2.signMessage(ethers.getBytes(denomHash2));

//     const denomHashOwner = getDenomToSignEthers(denom);
//     const signedDenomOwner = await owner.signMessage(ethers.getBytes(denomHashOwner));

//     // Initialize confidential accounts
//     await initializeAccountEthers(signedDenom1, bidder1.address, denom, bidder1);
//     await initializeAccountEthers(signedDenom2, bidder2.address, denom, bidder2);
//     await initializeAccountEthers(signedDenomOwner, owner.address, denom, owner);
//   });

//   it("Bidder1 and Bidder2 deposit and apply balance", async () => {
//     await depositToPrivateBalanceEthers(denom, 1000, bidder1);
//     await depositToPrivateBalanceEthers(denom, 1200, bidder2);

//     const signedDenom1 = await bidder1.signMessage(ethers.getBytes(getDenomToSignEthers(denom)));
//     const signedDenom2 = await bidder2.signMessage(ethers.getBytes(getDenomToSignEthers(denom)));

//     await applyPendingBalanceEthers(bidder1.address, denom, signedDenom1, bidder1);
//     await applyPendingBalanceEthers(bidder2.address, denom, signedDenom2, bidder2);
//   });

//   it("Bidders transfer to owner and register txHash", async () => {
//     const signedDenom1 = await bidder1.signMessage(ethers.getBytes(getDenomToSignEthers(denom)));
//     const signedDenom2 = await bidder2.signMessage(ethers.getBytes(getDenomToSignEthers(denom)));

//     const tx1 = await confidentialTransferEthers(
//       bidder1.address, owner.address, denom, 500, signedDenom1, bidder1
//     );

//     const tx2 = await confidentialTransferEthers(
//       bidder2.address, owner.address, denom, 700, signedDenom2, bidder2
//     );

//     await auction.connect(bidder1).submitBid(tx1.hash);
//     await auction.connect(bidder2).submitBid(tx2.hash);
//   });

// it("Owner decrypts each bid and declares the winner", async () => {
//     // Get all submitted bids from the contract
//     const allBids = await auction.getAllBids();

//     // Ensure both bids are present
//     expect(allBids.length).to.equal(2);

//     // Fetch and decrypt both bids using Sei RPC and the owner's key
//     const signedDenomOwner = await owner.signMessage(ethers.getBytes(getDenomToSignEthers(denom)));
//     let bidResults: { bidder: string; amount: number }[] = [];

//     for (const bid of allBids) {
//       const txHash = bid.txHash;

//       // Fetch the transaction using your Sei RPC client (not shown here)
//       const tx = await owner.getTx(txHash);
//       console.log(tx);
//       // const encodedAmount = extractEncryptedAmountFromTx(tx); // Custom helper to locate the ciphertext
//       // const ctAccount = await queryAccountEthers(owner.address, denom, owner);
//       // const decrypted = await decryptPendingBalancesEthers(signedDenomOwner, ctAccount!);

//       // const totalAmount = Number(decrypted.totalPendingBalance);
//       // bidResults.push({ bidder: bid.bidder, amount: totalAmount });
//     }

//     // Determine winner based on max amount
//     const winningBid = bidResults.reduce((prev, curr) => (curr.amount > prev.amount ? curr : prev));

//     // Declare winner on the auction contract
//     await auction.connect(owner).declareWinner(
//       winningBid.bidder,
//       winningBid.amount,
//       signedDenomOwner
//     );

//     expect(await auction.declaredWinner()).to.equal(winningBid.bidder);
//     expect(await auction.declaredAmount()).to.equal(winningBid.amount);
//   });

// });