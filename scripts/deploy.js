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
  storeContractData(auction)
}

function storeContractData(contract) {
  const fs = require("fs");
  const contractsDir = __dirname + "/../src/contracts";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    contractsDir + "/Auction-address.json",
    JSON.stringify({ Auction: contract.address }, undefined, 2)
  );

  const artifacts = hre.artifacts.readArtifactSync("Auction"); 

  fs.writeFileSync(
    contractsDir + "/Auction.json",
    JSON.stringify(artifacts, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
