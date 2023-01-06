// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

/// @title Blind Auction Contract
/// @notice The Blind Auction Contract enables an auction system where the bid amounts are known to the bidders only
contract Auction {

    /// @notice Bid structure
    /// @param blindedBid bytes32 representation of a blinded bid
    /// @param deposit amount sent along with bid
    struct Bid {
        bytes32 blindedBid;
        uint256 deposit;
    }
    /// @notice contract deployer
    address payable internal owner;
    /// @notice account to receive the highest bid
    address payable public beneficiary;
    /// @notice timestamp when the bidding phase ends
    uint256 public biddingEnd;
    /// @notice timestamp when the reveal phase ends
    uint256 public revealEnd;
    /// @notice true if auction is still active, false otherwise
    bool public ended;
    /// @notice all bids created for this auction
    mapping(address => Bid[]) public bids;

    /// @notice address of highest bidder
    address public highestBidder;
    /// @notice highest bid amount
    uint256 public highestBid;
    /// @notice keeps track of amount others (except highest bidder) have placed as bids
    mapping(address => uint256) pendingReturns;
    /// @notice Emitted when an auction has ended
    /// @param winner address of auction winner
    /// @param highestBid highest bid amount
    event AuctionEnded(address winner, uint256 highestBid);

    /// @notice Function should be called after `time`.
    /// @param time seconds remaining before function can be called
    error TooEarly(uint256 time);
    /// Function should be called before `time`.
    /// @param time seconds past after function can be called 
    error TooLate(uint256 time);
    /// @notice The function `auctionEnd` has already been called.
    error AuctionEndAlreadyCalled();

    modifier onlyBefore(uint256 time) {
        if (block.timestamp >= time) revert TooLate(block.timestamp - time);
        _;
    }

    modifier onlyAfter(uint256 time) {
        if (block.timestamp <= time) revert TooEarly(time - block.timestamp);
        _;
    }

    /// @notice sSd
    /// @param _biddingDuration time in seconds which the bidding phase lasts
    /// @param _revealDuration time in seconds which the reveal phase lasts
    /// @param _beneficiary address of auction beneficiary
    constructor(
        uint256 _biddingDuration,
        uint256 _revealDuration,
        address payable _beneficiary
    ) {
        biddingEnd = block.timestamp + _biddingDuration;
        revealEnd = biddingEnd + _revealDuration;
        beneficiary = _beneficiary;
    }

    /// @notice helper function to blind a bid
    /// @param value amount to be placed a bid. This is subtracted from the ethers sent (`deposit`) when making bid
    /// @param fake boolean indication if bid is to be considered or ignored (during reveal phase)
    function blindBid(uint256 value, bool fake) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(value * (1 ether), fake));
    }

    /// @notice make a bid
    /// @param _blindedBid bytes32 hash of blinded bid
    function bid(bytes32 _blindedBid) external payable onlyBefore(biddingEnd) {
        bids[msg.sender].push(
            Bid({blindedBid: _blindedBid, deposit: msg.value})
        );
    }

    /// @notice reveal blinded bids
    /// @param values array of all bids amount placed by caller   
    /// @param fakes array of all bid fake values placed by caller
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
            value = value * (1 ether);
            if (bidToCheck.blindedBid != blindBid(value, fake)) {
                // Bid was not correctly revealed
                // Burn deposit
                continue;
            }
            refund += bidToCheck.deposit;
            // Bid should not be fake
            // Deposited ether should not be less than proposed bid value
            if (!fake && bidToCheck.deposit >= value) {
                if (placeBid(msg.sender, value))
                    refund -= value;
            }
            // Delete bid
            bidToCheck.blindedBid = bytes32(0);
        }
        // Transfer remaining balance to caller after subtracting bid amount
        payable(msg.sender).transfer(refund);
    }

    /// @notice withdraw bids amounts accumulated
    function withdraw() external {
        uint256 amount = pendingReturns[msg.sender];
        if (amount > 0) {
            pendingReturns[msg.sender] = 0;
            payable(msg.sender).transfer(amount);
        }
    }

    /// @notice end auction and send highest bid amount to `beneficiary`
    function auctionEnd() external onlyAfter(revealEnd) {
        if (ended) revert AuctionEndAlreadyCalled();
        emit AuctionEnded(highestBidder, highestBid);
        ended = true;
        beneficiary.transfer(highestBid);
    }

    /// @notice helper function to place a bid
    /// @param bidder address of bidder
    /// @param value amount to be placed as bid
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

    /// @notice withdraw burnt funds  contract
    function withdrawBurntFunds() external onlyAfter(revealEnd) {
        require(msg.sender == owner, "Not owner.");
        uint256 bal = address(this).balance;
        owner.transfer(bal);
    }


}
