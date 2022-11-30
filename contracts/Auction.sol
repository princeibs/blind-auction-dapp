// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Auction {
    struct Bid {
        bytes32 blindedBid;
        uint256 deposit;
    }

    address payable public beneficiary;
    uint256 public biddingEnd;
    uint256 public revealEnd;
    bool public ended;

    mapping(address => Bid[]) public bids;

    address public highestBidder;
    uint256 public highestBid;

    mapping(address => uint256) pendingReturns;

    event AuctionEnded(address winner, uint256 highestBid);

    /// Function should be called after `time`.
    error TooEarly(uint256 time);
    /// Function should be called before `time`.
    error TooLate(uint256 time);
    /// The function "auctionEnd" has already been called.
    error AuctionEndAlreadyCalled();

    modifier onlyBefore(uint256 time) {
        if (block.timestamp >= time) revert TooLate(block.timestamp - time);
        _;
    }

    modifier onlyAfter(uint256 time) {
        if (block.timestamp <= time) revert TooEarly(block.timestamp - time);
        _;
    }

    constructor(
        uint256 _biddingDuration,
        uint256 _revealDuration,
        address payable _beneficiary
    ) {
        biddingEnd = block.timestamp + _biddingDuration;
        revealEnd = biddingEnd + _revealDuration;
        beneficiary = _beneficiary;
    }

    /// Helper function to blind a bid
    function blindABid(uint256 value, bool fake) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(value * (1 ether), fake));
    }

    /// Place a blinded bid
    function bid(bytes32 _blindedBid) external payable onlyBefore(biddingEnd) {
        bids[msg.sender].push(
            Bid({blindedBid: _blindedBid, deposit: msg.value})
        );
    }

    /// Reveal blinded bids
    function reveal(uint256[] calldata values, bool[] calldata fakes)
        external
        onlyAfter(biddingEnd)
        onlyBefore(revealEnd)
    {
        uint256 length = bids[msg.sender].length;
        require(values.length == length);
        require(fakes.length == length);

        uint256 refund;
        for (uint256 i = 0; i < length; i++) {
            Bid storage bidToCheck = bids[msg.sender][i];
            (uint256 value, bool fake) = (values[i], fakes[i]);
            if (bidToCheck.blindedBid != blindABid(value, fake)) {
                // Bid was not correctly revealed
                // Burn deposit
                continue;
            }
            refund += bidToCheck.deposit;
            if (!fake && bidToCheck.deposit >= value * (1 ether)) {
                if (placeBid(msg.sender, value * (1 ether)))
                    refund -= value * (1 ether);
            }
            bidToCheck.blindedBid = bytes32(0);
        }
        payable(msg.sender).transfer(refund);
    }

    /// Withdraw a bid that was overbid
    function withdraw() external {
        uint256 amount = pendingReturns[msg.sender];
        if (amount > 0) {
            pendingReturns[msg.sender] = 0;
            payable(msg.sender).transfer(amount);
        }
    }

    /// End auction and send highest bid to beneficiary
    function auctionEnd() external onlyAfter(revealEnd) {
        if (ended) revert AuctionEndAlreadyCalled();
        emit AuctionEnded(highestBidder, highestBid);
        ended = true;
        beneficiary.transfer(highestBid);
    }

    /// Helper function to place a bid
    function placeBid(address bidder, uint256 value) internal returns (bool) {
        if (value <= highestBid) {
            return false;
        }
        // if this is not the first bid to be made
        if (highestBidder != address(0)) {
            pendingReturns[highestBidder] += highestBid;
        }
        highestBid = value;
        highestBidder = bidder;
        return true;
    }
}
