# Blind Auction Decentralised Application (DApp)

A blind auction dapp is an is an auction dapp with a lot of similarities to regular [auction applications](https://en.wikipedia.org/wiki/Auction). The main difference is that the bids placed by the users and cryptographically secured so that nobody, except the user placing the bid knows the bid amount.

## How does it work?

Imagine all the bidders putting some certain amount inside an envelop, and on the top of the envelop is a value representing how much they want to place as bids from the total sum inside the envelop. But instead of writing their bid amount plainly on the envelop, they hashed the bid amount (usually with a secret key) and write the hash output on the top on the envelop, and submit this envelop as their bid. The reason for hashing the amount to bid is because the blockchain as public and transparent ledger, and everybody can see how funds are transferred from one account the other on this ledger. It is practically impossible to hash such kind of value. 

The solution is to put enough funds inside an envelop with the amount to be deducted from the envelop as bid writting as a message on the envelop. This message must be cryptographically hashed with a secret key so only person with the secret key can resolve the hash. So in the process of bidding, people can see how much you sent to the application, but can't see how much you intend to place as bid out of to funds sent.

Unlike regular auction applications where submitting a bid automatically set's the highest bidder and the highest bid amount, in blind auction this happens in two faces. The first face (bid phase) is the bidding face where the bids ("envelops") are submitted (for a certain period of time). In this phase, bids are only submitted and the highest bidder is usually unknown at this phase. The second phase (reveal phase) is where all the bids are revealed and and the highest bidder is determined. When the first phase (bid phase) is over, every bidders reveal their bids by themselves to the application by sending the secret key used to has the bid amount to the application, which in turn resolve the hash, deduct their bid amount from the total funds sent in the envelop, and send the balance back to the user. At this point, the application set's the user as the highest bidder if their bid was greater than the previous bid, else it returns it back to them (or let them withdraw)

By now it is obvious that mere sending a bid to the application does not complete participation. Full participation involves placing a bid and revealing the bid to the application at the appropraite time. Also note the application only determines the highest bidder from those who have revealed their bids.
If a use place a very large bid (higher than the highest bid (i.e it might be the new highest)) and they don't reveal it in the reveal phase, the bid won't be considered.

## How to test

You can test in two ways
1. Using the predefined test cases defined in the test folder. To achieve this run the command 
```bash
npx hardhat test
``` 
2. Testing manually using the [Remix IDE](https://remix.ethereum.org). Below is a sample test flow
  - Deploy the contract setting bidding duration and reveal duration to 60 seconds each (you can set it to how long you want), and Account 0 as the beneficiary contract.
  - In the first 60 seconds of the app's deployment, place some bids with Account 1.
  - Place some bids with Account 2 as well before the end of the 60 seconds time limit
  - When the first 60 seconds (bidding time) is over, reveal the bids of each accounts respectively using the `reveal` function. 
  - Check the balance of both Account 1 and Account 2 and notice the difference.
  - Use the `highestBidder` public function to check who made the highest bid
  - Switch to the other account (the one without the highest bid) and using the `withdraw` function to withdraw funds from the contract.

By now you should have understood how a blind auction application works.
