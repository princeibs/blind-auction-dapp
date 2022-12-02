const {loadFixture, time} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const TIME_IN = 10; // time into the future (in seconds)

describe("Auction", function () {
    async function deployFixture() {
        const [deployer, beneficiary, acc1, acc2] = await ethers.getSigners();
        const [biddingDuration, revealDuration] = [60, 60];
        const Auction = await ethers.getContractFactory("Auction");
        const auction = await Auction.deploy(biddingDuration, revealDuration, beneficiary.address);

        return {auction, biddingDuration, revealDuration, beneficiary, acc1, acc2};
    }

    async function revealFixture() {
        const {auction, acc1} = await loadFixture(deployFixture);        
        const [val, fake] = ["5", false];
        const bigValue = ethers.utils.parseUnits(val);
        const blindedBid = await auction.blindABid(val, fake);
        await auction.connect(acc1).bid(blindedBid, {value: bigValue})

        return {auction, acc1, val, fake}
    }

    describe("Constructor", function () {
        it("Should set the correct value for `biddingEnd`", async function () {
            const {auction, biddingDuration} = await loadFixture(deployFixture);
            const biddingEnd = biddingDuration + await time.latest();

            expect(await auction.biddingEnd()).to.equal(biddingEnd);
        })
        it("Should set the correct value for `revealEnd`", async function () {
            const {auction, revealDuration} = await loadFixture(deployFixture);
            const revealEnd = revealDuration + Number(await auction.biddingEnd());

            expect(await auction.revealEnd()).to.equal(revealEnd);
        })
        it("Should set the correct beneficiary", async function () {
            const {auction, beneficiary} = await loadFixture(deployFixture);

            expect(await auction.beneficiary()).to.equal(beneficiary.address);
        })
    })

    describe("Functions", function () {
        describe("blindABid", function () {
            it("Should correctly blind a bid", async function () {
                const {auction} = await loadFixture(deployFixture);
                const [value, fake] = [5, false];
                const bigValue = ethers.utils.parseUnits(ethers.BigNumber.from(value).toString())
                // ethers.utils.solidityKeccak256 equivalent to keccak256(abi.encodePacked(...args)) in solidity
                const blindedBid = ethers.utils.solidityKeccak256(["uint256", "bool"], [bigValue, fake])               

                expect(await auction.blindABid(value, fake)).to.equal(blindedBid);
            })
        })
        describe("bid", function () {
            it("Should fail if called after bidding time is over", async function() {
                const {auction} = await loadFixture(deployFixture);
                const biddingEndTime = await auction.biddingEnd()                
                await time.increaseTo(biddingEndTime);
                const [val, fake] = ["5", false];
                const bigValue = ethers.utils.parseUnits(val);
                const blindedBid = await auction.blindABid(val, fake);

                await expect(auction.bid(blindedBid, {value: bigValue})).to.be.revertedWithCustomError(auction, "TooLate");
            })
            it("Should add new bid to storage", async function () {
                const {auction, acc1} = await loadFixture(deployFixture);
                const [val, fake] = ["5", false];
                const bigValue = ethers.utils.parseUnits(val); // convert `val` to ether value
                const blindedBid = await auction.blindABid(val, fake)  // blind bid and return bytes32 string
                await auction.connect(acc1).bid(blindedBid, {value: bigValue})// place a new bid
                const createdBid = await auction.bids(acc1.address, 0); // get bid values

                const actual = [createdBid.blindedBid, createdBid.deposit.toString()];
                const expected = [blindedBid, bigValue.toString()];
                expect(actual).to.have.members(expected)                                         
            })
        })  
        describe("reveal", function () {
            it("Should fail in attempt to reveal bid before bidding time ends", async function () {
                const {auction, val, fake, acc1} = await loadFixture(revealFixture);                 
                const actual = auction.connect(acc1).reveal([val], [fake]);             
                
                await expect(actual).to.be.revertedWithCustomError(auction, "TooEarly").withArgs(anyValue)
            })
            it("Should fail in attempt to reveal a bid after reveal time ends", async function () {
                const {auction, val, fake, acc1} = await loadFixture(revealFixture);
                await time.increaseTo(await auction.revealEnd())
                const actual = auction.connect(acc1).reveal([val], [fake]);

                await expect(actual).to.be.revertedWithCustomError(auction, "TooLate").withArgs(anyValue);                
            })
            it("Should set all sender's blinded bids to bytes32(0) after reveal", async function () {
                const {auction, val, fake, acc1} = await loadFixture(revealFixture);
                await time.increaseTo(Number(await auction.biddingEnd()) + TIME_IN);
                await auction.connect(acc1).reveal([val], [fake]);

                const bid = await auction.bids(acc1.address, 0)
                
                expect(Number(bid.blindedBid)).to.equal(0);

            })
            it("Should transfer the correct refund amount to sender", async function() {
                const {auction, acc1} = await loadFixture(deployFixture);        
                const [val, fake] = ["5", false];
                const bigValue = ethers.utils.parseUnits("8"); // extra 3 ether will be returned during reveal phase
                const blindedBid = await auction.blindABid(val, fake);
                await expect(await auction.connect(acc1).bid(blindedBid, {value: bigValue})).to.changeEtherBalance(acc1, ethers.BigNumber.from(ethers.utils.parseUnits("-8")))                

                await time.increaseTo(Number(await auction.biddingEnd()) + TIME_IN);
                await expect(await auction.connect(acc1).reveal([val], [fake])).to.changeEtherBalance(acc1, ethers.BigNumber.from(ethers.utils.parseUnits("3")))
            })
        })  
        describe("withdraw", function () {
            it("Should withdraw the correct amount to sender", async function () {
                const {auction, acc1, acc2} = await loadFixture(deployFixture)
                const [acc1Val, acc1Fake, acc2Val, acc2Fake] = ["5", false, "7", false];
                const bigValue1 = ethers.utils.parseUnits(acc1Val);
                const bigValue2 = ethers.utils.parseUnits(acc2Val);
                const blindedBid1 = await auction.blindABid(acc1Val, acc1Fake);
                const blindedBid2 = await auction.blindABid(acc2Val, acc2Fake);

                // Account 1 and Account 2 place bids (Account 2 placed the highest)
                await auction.connect(acc1).bid(blindedBid1, {value: bigValue1})
                await auction.connect(acc2).bid(blindedBid2, {value: bigValue2})

                // Travel `TIME_IN` seconds into the revealing period
                await time.increaseTo(Number(await auction.biddingEnd()) + TIME_IN);

                // Account 1 and Account 2 reveal
                await auction.connect(acc1).reveal([acc1Val], [acc1Fake]);
                await auction.connect(acc2).reveal([acc2Val], [acc2Fake]);

                // Confirm the highest bidder
                expect(await auction.highestBidder()).to.equal(await acc2.getAddress())
                // Confirm the highest bid
                expect(await auction.highestBid()).to.be.equal(ethers.BigNumber.from(bigValue2))

                // Account 2 won the auction

                // Confirm if bid amount is returned to Account 1 on withdraw
                await expect(await auction.connect(acc1).withdraw()).to.changeEtherBalance(acc1, ethers.BigNumber.from(bigValue1))
                // Confirm if nothing (0 wei) is returned to Account 2 (bid winner) on withdraw
                await expect(await auction.connect(acc2).withdraw()).to.changeEtherBalance(acc2, ethers.BigNumber.from("0"))

            })
        })  
        describe("auctionEnd", function() {
            it("Should fail if called before reveal time ends", async function () {  
                const {auction} = await loadFixture(deployFixture)
                await expect(auction.auctionEnd()).to.be.revertedWithCustomError(auction, "TooEarly").withArgs(anyValue)
            })
            it("Should end the auction", async function () {
                const {auction} = await loadFixture(deployFixture);
                await time.increaseTo(await auction.revealEnd());
                await expect(await auction.auctionEnd()).to.not.be.reverted;
            })
            it("Should fail if called when auction has ended", async function () {
                const {auction} = await loadFixture(deployFixture);
                await time.increaseTo(await auction.revealEnd());
                await auction.auctionEnd();
                // calling `auctionEnd` function the second time
                await expect(auction.auctionEnd()).to.be.revertedWithCustomError(auction, "AuctionEndAlreadyCalled")
            })
            it("Should transfer the right amount to the beneficiary", async function () {
                const {auction, acc1, beneficiary} = await loadFixture(deployFixture);        
                const [val, fake] = ["5", false];
                const bigValue = ethers.utils.parseUnits(val);
                const blindedBid = await auction.blindABid(val, fake);
                await auction.connect(acc1).bid(blindedBid, {value: bigValue})
                // `TIME_IN` seconds into the reveal time
                await time.increaseTo(Number(await auction.biddingEnd()) + TIME_IN);
                await auction.connect(acc1).reveal([val], [fake])
                // `TIME_IN` seconds after the reveal time
                await time.increaseTo(Number(await auction.revealEnd()) + TIME_IN);

                await expect(await auction.auctionEnd()).to.changeEtherBalance(beneficiary, ethers.BigNumber.from(bigValue));
            })
            it("Should emit the right event", async function () {
                const {auction, acc1, beneficiary} = await loadFixture(deployFixture);        
                const [val, fake] = ["5", false];
                const bigValue = ethers.utils.parseUnits(val);
                const blindedBid = await auction.blindABid(val, fake);
                await auction.connect(acc1).bid(blindedBid, {value: bigValue})
                // `TIME_IN` seconds into the reveal time
                await time.increaseTo(Number(await auction.biddingEnd()) + TIME_IN);
                await auction.connect(acc1).reveal([val], [fake])
                // `TIME_IN` seconds after the reveal time
                await time.increaseTo(Number(await auction.revealEnd()) + TIME_IN);

                await expect(await auction.auctionEnd()).to.emit(auction, "AuctionEnded").withArgs(acc1.address, ethers.BigNumber.from(bigValue))
            })
        })
    })
})