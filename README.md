![tracer_banner](https://github.com/user-attachments/assets/755487a4-8af5-45ca-9ca8-577241136657)

Welcome to the Product Tracer System repository. This is a blockchain-based system that traces products using simulated simulated PUD IDs.

## Getting Started

To run the project locally, perform the following steps:

1. Clone this repository
2. In the root directory, run `npm install` (make sure you have npm installed). This will install all node modules and Hardhat as well.
3. After that, run `foundryup` to install the foundry testing framework as well.

Now, you can investigate the contracts and run the tests using the following commands:

1. `npx hardhat test` to run the Hardhat test suite and also generate a gas report at the end (remember to input your CoinMarketCap and Etherscan API keys in the .env file.
2. `forge test --gas-reoport` to run the foundry test suite and get a gas report at the end. You have to manually multiply the gas amounts for each function call to calculate the USD cost of execution.

[This is a work-in-progress repository]
