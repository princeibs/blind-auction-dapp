// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Auction.sol";

/// @notice Create blind auctions
contract AuctionFactory {

    /// @notice Auction data structure
    /// @param id auction unique identifier
    /// @param title short description about auction
    /// @param long description about auction
    /// @param auction contract address of newly created auction
    struct AuctionType {
        uint256 id;   
        string title;
        string description;
        Auction auction;     
    }

    /// keeps track of auctions created
    mapping (uint256 => AuctionType) auctions;
    /// generate Ids for new auctions
    uint256 auctionIds;

    /// @notice creates a new auction
    /// @param _biddingDuration time in seconds which the bidding phase lasts
    /// @param _revealDuration time in seconds which the reveal phase lasts
    /// @param _beneficiary address of auction beneficiary
    /// @param _title AuctionType title
    /// @param _description AuctionType description
    function createAuction(
        uint256 _biddingDuration,
        uint256 _revealDuration,
        address payable _beneficiary,
        string calldata _title,
        string calldata _description
    ) public {
        Auction auction = new Auction(_biddingDuration, _revealDuration, _beneficiary);
        auctions[auctionIds] = AuctionType(auctionIds, _title, _description, auction);
        auctionIds++;
    }

    /// @notice Get a single auction
    /// @return auction contract address
    /// @param auctionId auction unique identifier
    function getAuction(uint256 auctionId) public view returns (AuctionType memory) {
        return auctions[auctionId];
    }
}