require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        //settings: {
          //viaIR: true,
          //optimizer: {
           // enabled: true,
            //runs: 200
          //}
        //}
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests:   "./test",
    cache:   "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  }
};
