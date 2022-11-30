// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  const Auction = await hre.ethers.getContractFactory("Auction");
  const auction = await Auction.deploy(0, 0, "0x00");

  await auction.deployed();

  console.log("Auction contract deployed to: " + auction.address)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
